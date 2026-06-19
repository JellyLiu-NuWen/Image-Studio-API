import {
  describeProblem,
  isRetryableRaw,
  normalizeAutoRetryCount,
  normalizeBaseURL,
  RETRY_BACKOFF_MS,
} from "../../shared/kernel/requestModel.js";
import { json } from "./http.js";

function copyPassthroughHeaders(request, upstreamApiKey) {
  const headers = new Headers();
  const passThrough = ["content-type", "accept", "user-agent", "openai-beta"];
  for (const name of passThrough) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("authorization", `Bearer ${upstreamApiKey}`);
  return headers;
}

function withGenerationDefaults(body, config) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  return {
    model: body.model || config.defaultImageModel,
    prompt: body.prompt || "",
    size: body.size || config.defaultSize,
    quality: body.quality || config.defaultQuality,
    output_format: body.output_format || body.outputFormat || config.defaultOutputFormat,
    ...body,
  };
}

async function readBodyBuffer(request, config, pathname) {
  if (request.method === "GET" || request.method === "HEAD") return { bodyBuffer: null, parsedBody: null };
  const contentType = request.headers.get("content-type") || "";
  const raw = await request.arrayBuffer();
  if (!contentType.toLowerCase().includes("application/json")) {
    return { bodyBuffer: raw, parsedBody: null };
  }
  let parsedBody = null;
  try {
    parsedBody = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return { bodyBuffer: raw, parsedBody: null };
  }
  if (pathname === "/v1/images/generations") {
    parsedBody = withGenerationDefaults(parsedBody, config);
    return {
      bodyBuffer: new TextEncoder().encode(JSON.stringify(parsedBody)).buffer,
      parsedBody,
    };
  }
  return { bodyBuffer: raw, parsedBody };
}

function bodyRequestsStream(request, bodyBuffer, parsedBody) {
  if (parsedBody?.stream === true) return true;
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("multipart/form-data") || !bodyBuffer) return false;
  const text = new TextDecoder().decode(bodyBuffer);
  return /name="stream"[\s\S]*?\r?\n\r?\ntrue\r?\n/i.test(text);
}

function resolveMaxAttempts(autoRetryCount) {
  if (autoRetryCount === undefined || autoRetryCount === null || autoRetryCount === "") return 1;
  if (Number(autoRetryCount) <= 0) return 1;
  return normalizeAutoRetryCount(autoRetryCount) + 1;
}

async function forwardRawWithRetry({
  fetchImpl,
  upstream,
  pathname,
  search,
  method,
  request,
  bodyBuffer,
  maxAttempts,
  shouldRetry,
  timeoutSeconds,
}) {
  let lastRaw = "";
  let lastStatus = 502;
  let lastContentType = "application/json; charset=utf-8";
  const upstreamBaseURL = normalizeBaseURL(upstream.baseURL);
  const upstreamURL = `${upstreamBaseURL}${pathname}${search}`;
  const headers = copyPassthroughHeaders(request, upstream.apiKey);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response = null;
    try {
      response = await fetchImpl(upstreamURL, {
        method,
        headers,
        body: bodyBuffer,
        signal: createTimeoutSignal(timeoutSeconds),
      });
    } catch (error) {
      lastStatus = 502;
      lastContentType = "application/json; charset=utf-8";
      lastRaw = error?.message || String(error || "Upstream request failed");
      if (attempt < maxAttempts) {
        await sleep(RETRY_BACKOFF_MS);
        continue;
      }
      break;
    }
    lastStatus = response.status;
    lastContentType = response.headers.get("content-type") || lastContentType;
    if (response.ok && lastContentType.toLowerCase().includes("text/event-stream")) {
      const forwarded = new Response(response.body, {
        status: response.status,
        headers: {
          "content-type": lastContentType,
          "cache-control": "no-cache",
          "x-accel-buffering": "no",
        },
      });
      forwarded.headers.set("x-image-studio-upstream-id", upstream.id);
      return forwarded;
    }
    lastRaw = await response.text();
    if (response.ok) {
      const forwarded = new Response(lastRaw, {
        status: response.status,
        headers: {
          "content-type": lastContentType,
        },
      });
      forwarded.headers.set("x-image-studio-upstream-id", upstream.id);
      return forwarded;
    }
    if (attempt < maxAttempts && shouldRetry(lastRaw, response.status)) {
      await sleep(RETRY_BACKOFF_MS);
      continue;
    }
    break;
  }

  const failure = json({
    error: {
      message: lastStatus === 502 && lastRaw && !String(lastRaw).trim().startsWith("{")
        ? `上游请求失败:${lastRaw}`
        : describeProblem(lastRaw),
      upstreamStatus: lastStatus,
      raw: lastRaw.slice(0, 1500),
    },
  }, { status: lastStatus || 502 });
  failure.headers.set("x-image-studio-upstream-id", upstream.id);
  return failure;
}

async function forwardRawAsSSE({
  fetchImpl,
  upstream,
  pathname,
  search,
  method,
  request,
  bodyBuffer,
  timeoutSeconds,
}) {
  const upstreamBaseURL = normalizeBaseURL(upstream.baseURL);
  const upstreamURL = `${upstreamBaseURL}${pathname}${search}`;
  const headers = copyPassthroughHeaders(request, upstream.apiKey);
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": image-studio keepalive\n\n"));
      try {
        const response = await fetchImpl(upstreamURL, {
          method,
          headers,
          body: bodyBuffer,
          signal: createTimeoutSignal(timeoutSeconds),
        });
        const contentType = response.headers.get("content-type") || "";
        if (contentType.toLowerCase().includes("text/event-stream")) {
          const reader = response.body?.getReader();
          if (reader) {
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) break;
              controller.enqueue(chunk.value);
            }
          }
        } else {
          const raw = await response.text();
          controller.enqueue(encoder.encode(`data: ${raw}\n\n`));
        }
      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          error: {
            message: `上游请求失败:${error?.message || String(error || "Unknown error")}`,
            upstreamStatus: 502,
          },
        })}\n\n`));
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  const response = new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      "x-accel-buffering": "no",
    },
  });
  response.headers.set("x-image-studio-upstream-id", upstream.id);
  return response;
}

function createTimeoutSignal(seconds) {
  const timeoutMs = Math.max(1, Number(seconds) || 1) * 1000;
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function forwardOpenAIPath({ request, config, fetchImpl }) {
  const upstreams = Array.isArray(config.upstreams) && config.upstreams.length > 0
    ? config.upstreams
    : [{ id: "default", baseURL: config.upstreamBaseURL, apiKey: config.upstreamApiKey, enabled: true }];
  const enabledUpstreams = upstreams.filter((upstream) => upstream?.enabled !== false);
  if (!enabledUpstreams.some((upstream) => upstream.baseURL)) {
    return json({ error: { message: "Server is missing UPSTREAM_BASE_URL" } }, { status: 400 });
  }
  if (!enabledUpstreams.some((upstream) => upstream.apiKey)) {
    return json({ error: { message: "Server is missing UPSTREAM_API_KEY" } }, { status: 500 });
  }
  const url = new URL(request.url);
  const { bodyBuffer, parsedBody } = await readBodyBuffer(request, config, url.pathname);
  const wantsStream = bodyRequestsStream(request, bodyBuffer, parsedBody);
  const maxAttempts = resolveMaxAttempts(parsedBody?.autoRetryCount);
  const shouldRetry = (raw, status) => isRetryableRaw(raw) || [429, 502, 503, 504, 524].includes(status);
  const retryableStatuses = new Set([429, 502, 503, 504, 524]);
  let lastResponse = null;
  const failoverChain = [];
  let retryCount = 0;
  for (const upstream of enabledUpstreams) {
    if (!upstream.baseURL || !upstream.apiKey) continue;
    failoverChain.push(upstream.id);
    const response = wantsStream
      ? await forwardRawAsSSE({
        fetchImpl,
        upstream,
        pathname: url.pathname,
        search: url.search,
        method: request.method,
        request,
        bodyBuffer,
        timeoutSeconds: config.requestTimeoutSeconds,
      })
      : await forwardRawWithRetry({
        fetchImpl,
        upstream,
        pathname: url.pathname,
        search: url.search,
        method: request.method,
        request,
        bodyBuffer,
        maxAttempts,
        shouldRetry,
        timeoutSeconds: config.requestTimeoutSeconds,
      });
    response.headers.set("x-image-studio-interface-id", config.interfaceId || "");
    response.headers.set("x-image-studio-model", parsedBody?.model || config.defaultImageModel || "");
    response.headers.set("x-image-studio-failover-chain", failoverChain.join(","));
    response.headers.set("x-image-studio-retry-count", String(retryCount));
    lastResponse = response;
    if (response.ok) {
      return response;
    }
    retryCount += 1;
    if (!retryableStatuses.has(response.status)) {
      return response;
    }
  }
  return lastResponse || json({ error: { message: "No enabled upstream is configured" } }, { status: 400 });
}
