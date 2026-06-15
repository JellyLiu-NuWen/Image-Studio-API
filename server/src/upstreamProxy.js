import {
  DEFAULT_AUTO_RETRY_COUNT,
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

function resolveMaxAttempts(autoRetryCount) {
  return normalizeAutoRetryCount(autoRetryCount ?? DEFAULT_AUTO_RETRY_COUNT) + 1;
}

async function forwardRawWithRetry({
  fetchImpl,
  upstreamURL,
  method,
  headers,
  bodyBuffer,
  maxAttempts,
  shouldRetry,
  timeoutSeconds,
}) {
  let lastRaw = "";
  let lastStatus = 502;
  let lastContentType = "application/json; charset=utf-8";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetchImpl(upstreamURL, {
      method,
      headers,
      body: bodyBuffer,
      signal: createTimeoutSignal(timeoutSeconds),
    });
    lastStatus = response.status;
    lastContentType = response.headers.get("content-type") || lastContentType;
    lastRaw = await response.text();
    if (response.ok) {
      return new Response(lastRaw, {
        status: response.status,
        headers: {
          "content-type": lastContentType,
        },
      });
    }
    if (attempt < maxAttempts && shouldRetry(lastRaw, response.status)) {
      await sleep(RETRY_BACKOFF_MS);
      continue;
    }
    break;
  }

  return json({
    error: {
      message: describeProblem(lastRaw),
      upstreamStatus: lastStatus,
      raw: lastRaw.slice(0, 1500),
    },
  }, { status: lastStatus || 502 });
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
  if (!config.upstreamBaseURL) {
    return json({ error: { message: "Server is missing UPSTREAM_BASE_URL" } }, { status: 400 });
  }
  if (!config.upstreamApiKey) {
    return json({ error: { message: "Server is missing UPSTREAM_API_KEY" } }, { status: 500 });
  }
  const url = new URL(request.url);
  const upstreamBaseURL = normalizeBaseURL(config.upstreamBaseURL);
  const upstreamURL = `${upstreamBaseURL}${url.pathname}${url.search}`;
  const { bodyBuffer, parsedBody } = await readBodyBuffer(request, config, url.pathname);
  return forwardRawWithRetry({
    fetchImpl,
    upstreamURL,
    method: request.method,
    headers: copyPassthroughHeaders(request, config.upstreamApiKey),
    bodyBuffer,
    maxAttempts: resolveMaxAttempts(parsedBody?.autoRetryCount),
    shouldRetry: (raw, status) => isRetryableRaw(raw) || [403, 502, 503, 504, 524].includes(status),
    timeoutSeconds: config.requestTimeoutSeconds,
  });
}
