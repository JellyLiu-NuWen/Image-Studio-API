import {
  DEFAULT_AUTO_RETRY_COUNT,
  describeProblem,
  isRetryableRaw,
  normalizeAutoRetryCount,
  normalizeBaseURL,
  RETRY_BACKOFF_MS,
} from "../../shared/kernel/requestModel.js";
import { mergeConfigUpdate, normalizeConfig, publicConfig } from "./config.js";

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

function getBearer(request) {
  const raw = request.headers.get("authorization") || "";
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function methodNotAllowed() {
  return json({ error: { message: "Method not allowed" } }, { status: 405 });
}

function notFound() {
  return json({ error: { message: "Not found" } }, { status: 404 });
}

function unauthorized(message) {
  return json({ error: { message } }, { status: 401 });
}

function tooManyRequests(message) {
  return json({ error: { message } }, {
    status: 429,
    headers: {
      "retry-after": "60",
    },
  });
}

function requireClientAuth(request, config) {
  if (!config.imageApiToken) {
    return unauthorized("Server is missing IMAGE_API_TOKEN");
  }
  if (getBearer(request) !== config.imageApiToken) {
    return unauthorized("Unauthorized");
  }
  return null;
}

function createRateLimiter(now = () => Date.now()) {
  const buckets = new Map();
  return {
    check(key, limit) {
      const max = Number(limit);
      if (!Number.isFinite(max) || max <= 0) return null;
      const windowMs = 60_000;
      const current = now();
      const bucketKey = String(key || "anonymous");
      const previous = buckets.get(bucketKey) || [];
      const recent = previous.filter((timestamp) => current - timestamp < windowMs);
      if (recent.length >= max) {
        buckets.set(bucketKey, recent);
        return tooManyRequests("Rate limit exceeded");
      }
      recent.push(current);
      buckets.set(bucketKey, recent);
      return null;
    },
  };
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

function requireAdminAuth(request, adminToken) {
  if (!adminToken) {
    return unauthorized("Server is missing ADMIN_TOKEN");
  }
  if (getBearer(request) !== adminToken) {
    return unauthorized("Admin authorization required");
  }
  return null;
}

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

async function forwardOpenAIPath({ request, config, fetchImpl }) {
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

async function handleAdminConfig({ request, store }) {
  if (request.method === "GET") {
    const config = normalizeConfig(await store.load());
    return json({ config: publicConfig(config) });
  }
  if (request.method !== "POST") return methodNotAllowed();
  const current = normalizeConfig(await store.load());
  const patch = await request.json().catch(() => ({}));
  const next = mergeConfigUpdate(current, patch);
  const saved = await store.save(next);
  return json({ ok: true, config: publicConfig(saved) });
}

export function createSelfHostedApp({
  store,
  adminToken = process.env.ADMIN_TOKEN || "",
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  if (!store) throw new Error("createSelfHostedApp requires a config store");
  if (!fetchImpl) throw new Error("createSelfHostedApp requires fetch");
  const rateLimiter = createRateLimiter(now);
  let activeRequests = 0;

  async function handle(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({ ok: true, service: "image-studio-self-hosted-api" });
    }

    if (url.pathname === "/api/config") {
      const authError = requireAdminAuth(request, adminToken);
      if (authError) return authError;
      return handleAdminConfig({ request, store });
    }

    if (
      (
        request.method === "GET"
        && url.pathname === "/v1/models"
      )
      || (
        request.method === "POST"
        && (
          url.pathname === "/v1/responses"
          || url.pathname === "/v1/images/generations"
          || url.pathname === "/v1/images/edits"
        )
      )
    ) {
      const config = normalizeConfig(await store.load());
      const authError = requireClientAuth(request, config);
      if (authError) return authError;
      if (activeRequests >= config.maxConcurrentRequests) {
        return tooManyRequests("Too many active requests");
      }
      const rateLimitError = rateLimiter.check(getBearer(request), config.rateLimitPerMinute);
      if (rateLimitError) return rateLimitError;
      activeRequests += 1;
      try {
        return await forwardOpenAIPath({ request, config, fetchImpl });
      } finally {
        activeRequests -= 1;
      }
    }

    return notFound();
  }

  return { handle };
}
