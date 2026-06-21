import {
  describeProblem,
  isRetryableRaw,
  normalizeAutoRetryCount,
  normalizeBaseURL,
  RETRY_BACKOFF_MS,
} from "../../shared/kernel/requestModel.js";
import { json } from "./http.js";

function copyPassthroughHeaders(request, upstreamApiKey, overrides = {}) {
  const headers = new Headers();
  const passThrough = ["content-type", "accept", "user-agent", "openai-beta"];
  for (const name of passThrough) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined || value === null || value === "") headers.delete(name);
    else headers.set(name, value);
  }
  headers.set("authorization", `Bearer ${upstreamApiKey}`);
  return headers;
}

function withGenerationDefaults(body, config) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const preset = config.qualityPreset || {};
  const prompt = enhancePrompt(body.prompt || "", preset);
  return {
    model: body.model || config.defaultImageModel,
    prompt,
    size: body.size || preset.size || config.defaultSize,
    quality: body.quality || preset.quality || config.defaultQuality,
    output_format: body.output_format || body.outputFormat || preset.outputFormat || config.defaultOutputFormat,
    ...body,
    prompt,
  };
}

function enhancePrompt(prompt, preset = {}) {
  const base = String(prompt || "").trim();
  const template = String(preset.template || "").trim();
  if (!preset.promptEnhance || !template) return base;
  if (!base) return template;
  return `${base}\n\nQuality preset guidance: ${template}`;
}

async function readBodyBuffer(request, config, pathname) {
  if (request.method === "GET" || request.method === "HEAD") return { bodyBuffer: null, parsedBody: null };
  const contentType = request.headers.get("content-type") || "";
  const raw = await request.arrayBuffer();
  if (pathname === "/v1/images/edits" && contentType.toLowerCase().includes("multipart/form-data")) {
    return { bodyBuffer: withMultipartEditDefaults(raw, contentType, config), parsedBody: null };
  }
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

function withMultipartEditDefaults(raw, contentType, config) {
  const boundary = multipartBoundary(contentType);
  if (!boundary) return raw;
  const normalizedRaw = normalizeMultipartImageFields(raw, boundary);
  const text = new TextDecoder().decode(normalizedRaw);
  const preset = config.qualityPreset || {};
  const fields = {
    model: config.defaultImageModel,
    size: preset.size || config.defaultSize,
    quality: preset.quality || config.defaultQuality,
    output_format: preset.outputFormat || config.defaultOutputFormat,
  };
  const additions = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value && !multipartHasField(text, name)) {
      additions.push(multipartTextPart(boundary, name, value));
    }
  }
  if (!additions.length) return normalizedRaw;
  return insertBeforeMultipartClose(normalizedRaw, boundary, additions.join(""));
}

function normalizeMultipartImageFields(raw, boundary) {
  const buffer = Buffer.from(raw);
  const marker = Buffer.from(`--${boundary}`);
  const chunks = [];
  let changed = false;
  let offset = 0;
  while (offset < buffer.length) {
    const markerIndex = buffer.indexOf(marker, offset);
    if (markerIndex < 0) {
      chunks.push(buffer.subarray(offset));
      break;
    }
    chunks.push(buffer.subarray(offset, markerIndex));
    const nextMarkerIndex = buffer.indexOf(marker, markerIndex + marker.length);
    const partEnd = nextMarkerIndex < 0 ? buffer.length : nextMarkerIndex;
    const part = buffer.subarray(markerIndex, partEnd);
    const normalizedPart = normalizeMultipartImageFieldPart(part);
    if (normalizedPart !== part) changed = true;
    chunks.push(normalizedPart);
    offset = partEnd;
  }
  if (!changed) return raw;
  return exactArrayBuffer(Buffer.concat(chunks));
}

function normalizeMultipartImageFieldPart(part) {
  const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
  if (headerEnd < 0) return part;
  const header = part.subarray(0, headerEnd).toString("latin1");
  const normalizedHeader = header.replace(
    /(^|\r\n)(Content-Disposition:\s*form-data;\s*name=")image(";\s*filename=")/i,
    "$1$2image[]$3",
  );
  if (normalizedHeader === header) return part;
  return Buffer.concat([
    Buffer.from(normalizedHeader, "latin1"),
    part.subarray(headerEnd),
  ]);
}

function exactArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function multipartBoundary(contentType) {
  const match = String(contentType || "").match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return (match?.[1] || match?.[2] || "").trim();
}

function multipartHasField(text, name) {
  return new RegExp(`name="${escapeRegExp(name)}"`).test(text);
}

function multipartTextPart(boundary, name, value) {
  return `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
}

function insertBeforeMultipartClose(raw, boundary, text) {
  const bytes = new Uint8Array(raw);
  const marker = new TextEncoder().encode(`--${boundary}--`);
  const index = lastIndexOfBytes(bytes, marker);
  if (index < 0) return raw;
  const addition = new TextEncoder().encode(text);
  const merged = new Uint8Array(bytes.length + addition.length);
  merged.set(bytes.slice(0, index), 0);
  merged.set(addition, index);
  merged.set(bytes.slice(index), index + addition.length);
  return merged.buffer;
}

function lastIndexOfBytes(bytes, needle) {
  if (!needle.length || needle.length > bytes.length) return -1;
  for (let index = bytes.length - needle.length; index >= 0; index -= 1) {
    let matches = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) return index;
  }
  return -1;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
        signal: createTimeoutSignal(imageWorkTimeoutSeconds(pathname, timeoutSeconds)),
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
          "cache-control": "no-cache, no-transform",
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
  failure.headers.set("x-image-studio-error-summary", encodeHeaderValue(describeProblem(lastRaw).slice(0, 500)));
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
  const headers = copyPassthroughHeaders(request, upstream.apiKey, {
    accept: "text/event-stream",
  });
  const encoder = new TextEncoder();
  const heartbeatMs = streamHeartbeatMs();
  const timeoutSignal = createTimeoutSignal(imageWorkTimeoutSeconds(pathname, timeoutSeconds));
  const upstreamAbortController = abortControllerFromSignals([timeoutSignal]);
  let closed = false;
  let heartbeatTimer = null;

  const body = new ReadableStream({
    start(controller) {
      const enqueue = (chunk) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          upstreamAbortController.abort();
        }
      };
      const heartbeat = () => enqueue(encoder.encode(": image-studio keepalive\n\n"));
      heartbeat();
      heartbeatTimer = setInterval(heartbeat, heartbeatMs);
      (async () => {
        try {
          const response = await fetchImpl(upstreamURL, {
            method,
            headers,
            body: bodyBuffer,
            signal: upstreamAbortController.signal,
          });
          const contentType = response.headers.get("content-type") || "";
          if (contentType.toLowerCase().includes("text/event-stream")) {
            const reader = response.body?.getReader();
            if (reader) {
              while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                enqueue(chunk.value);
              }
            }
          } else {
            const raw = await response.text();
            if (response.ok) {
              enqueue(encoder.encode(`data: ${raw}\n\n`));
            } else {
              enqueue(encoder.encode(`data: ${JSON.stringify({
                error: {
                  message: describeProblem(raw),
                  upstreamStatus: response.status,
                  raw: raw.slice(0, 1500),
                },
              })}\n\n`));
            }
          }
        } catch (error) {
          if (!closed) {
            enqueue(encoder.encode(`data: ${JSON.stringify({
              error: {
                message: `上游请求失败:${error?.message || String(error || "Unknown error")}`,
                upstreamStatus: 502,
              },
            })}\n\n`));
          }
        } finally {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          if (!closed) {
            closed = true;
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }
        }
      })();
    },
    cancel() {
      closed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      upstreamAbortController.abort();
    },
  });

  const response = new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
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

function abortControllerFromSignals(signals) {
  const controller = new AbortController();
  const abort = (source) => {
    if (controller.signal.aborted) return;
    try {
      controller.abort(source?.reason);
    } catch {
      controller.abort();
    }
  };
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      abort(signal);
      break;
    }
    signal.addEventListener("abort", () => abort(signal), { once: true });
  }
  return controller;
}

function streamHeartbeatMs() {
  const configured = Number(process.env.IMAGE_STUDIO_STREAM_HEARTBEAT_MS);
  if (Number.isFinite(configured) && configured >= 1) {
    return Math.max(1, Math.min(60_000, Math.floor(configured)));
  }
  return 15_000;
}

function isImageWorkPath(pathname) {
  return pathname === "/v1/images/generations" || pathname === "/v1/images/edits";
}

function imageWorkTimeoutSeconds(pathname, configuredSeconds) {
  const configured = Number(configuredSeconds);
  if (!isImageWorkPath(pathname)) return configured;
  const minimum = Number(process.env.IMAGE_STUDIO_IMAGE_TIMEOUT_SECONDS || process.env.IMAGE_STUDIO_STREAM_TIMEOUT_SECONDS || 300);
  const resolvedMinimum = Math.max(300, Number.isFinite(minimum) && minimum > 0 ? minimum : 300);
  if (!Number.isFinite(configured) || configured <= 0) return resolvedMinimum;
  return Math.max(configured, resolvedMinimum);
}

function encodeHeaderValue(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64url");
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
