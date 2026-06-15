import { getBearer, isBearerAuthorized } from "./auth.js";
import { json, methodNotAllowed, notFound, tooManyRequests, unauthorized } from "./http.js";
import { mergeConfigUpdate, normalizeConfig, publicConfig } from "./config.js";
import { forwardOpenAIPath } from "./upstreamProxy.js";
import { summarizeMetrics } from "./metrics.js";

function requireClientAuth(request, config) {
  if (!config.imageApiToken) {
    return unauthorized("Server is missing IMAGE_API_TOKEN");
  }
  if (!isBearerAuthorized(request, config.imageApiToken)) {
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

function requireAdminAuth(request, adminToken) {
  if (!adminToken) {
    return unauthorized("Server is missing ADMIN_TOKEN");
  }
  if (!isBearerAuthorized(request, adminToken)) {
    return unauthorized("Admin authorization required");
  }
  return null;
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function classifyAuthKind(request, adminToken, config = null) {
  if (adminToken && isBearerAuthorized(request, adminToken)) return "admin";
  if (config?.imageApiToken && isBearerAuthorized(request, config.imageApiToken)) return "client";
  return "none";
}

function errorSummaryFromResponse(response) {
  if (response.status < 400) return "";
  return response.statusText || `HTTP ${response.status}`;
}

async function appendLogSafely(logStore, record) {
  if (!logStore) return;
  try {
    await logStore.append(record);
  } catch (error) {
    console.error("Failed to append log record", error);
  }
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
  apiLogStore = null,
  generationLogStore = null,
  updateService = null,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  if (!store) throw new Error("createSelfHostedApp requires a config store");
  if (!fetchImpl) throw new Error("createSelfHostedApp requires fetch");
  const rateLimiter = createRateLimiter(now);
  let activeRequests = 0;

  async function handle(request) {
    const url = new URL(request.url);
    const startedAt = now();
    const id = createRequestId();
    let authKind = "none";
    let status = 500;
    let errorSummary = "";
    let response = null;
    const isGenerationEndpoint = url.pathname === "/v1/images/generations"
      || url.pathname === "/v1/images/edits";

    try {
      if (request.method === "GET" && url.pathname === "/healthz") {
        response = json({ ok: true, service: "image-studio-self-hosted-api" });
        return response;
      }

      if (url.pathname === "/api/config") {
        authKind = classifyAuthKind(request, adminToken);
        const authError = requireAdminAuth(request, adminToken);
        if (authError) {
          response = authError;
          return response;
        }
        response = await handleAdminConfig({ request, store });
        return response;
      }

      if (url.pathname === "/api/logs") {
        authKind = classifyAuthKind(request, adminToken);
        const authError = requireAdminAuth(request, adminToken);
        if (authError) {
          response = authError;
          return response;
        }
        if (request.method !== "GET") {
          response = methodNotAllowed();
          return response;
        }
        const logStore = url.searchParams.get("type") === "generations"
          ? generationLogStore
          : apiLogStore;
        response = json({ records: logStore ? await logStore.readRecent() : [] });
        return response;
      }

      if (url.pathname === "/api/metrics") {
        authKind = classifyAuthKind(request, adminToken);
        const authError = requireAdminAuth(request, adminToken);
        if (authError) {
          response = authError;
          return response;
        }
        if (request.method !== "GET") {
          response = methodNotAllowed();
          return response;
        }
        const [apiCalls, generations] = await Promise.all([
          apiLogStore ? apiLogStore.readRecent(500) : [],
          generationLogStore ? generationLogStore.readRecent(500) : [],
        ]);
        response = json({
          metrics: summarizeMetrics({ apiCalls, generations, activeRequests }),
        });
        return response;
      }

      if (url.pathname === "/api/update/check") {
        authKind = classifyAuthKind(request, adminToken);
        const authError = requireAdminAuth(request, adminToken);
        if (authError) {
          response = authError;
          return response;
        }
        if (request.method !== "GET") {
          response = methodNotAllowed();
          return response;
        }
        response = json({
          update: updateService
            ? await updateService.checkLatest()
            : { status: "unconfigured" },
        });
        return response;
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
        authKind = classifyAuthKind(request, adminToken, config);
        const authError = requireClientAuth(request, config);
        if (authError) {
          response = authError;
          return response;
        }
        if (activeRequests >= config.maxConcurrentRequests) {
          response = tooManyRequests("Too many active requests");
          return response;
        }
        const rateLimitError = rateLimiter.check(getBearer(request), config.rateLimitPerMinute);
        if (rateLimitError) {
          response = rateLimitError;
          return response;
        }
        activeRequests += 1;
        try {
          response = await forwardOpenAIPath({ request, config, fetchImpl });
          return response;
        } finally {
          activeRequests -= 1;
        }
      }

      response = notFound();
      return response;
    } catch (error) {
      errorSummary = error?.message || "Internal server error";
      throw error;
    } finally {
      if (response) {
        status = response.status;
        if (!errorSummary) errorSummary = errorSummaryFromResponse(response);
      }
      if (isGenerationEndpoint && generationLogStore) {
        await appendLogSafely(generationLogStore, {
          id,
          createdAt: new Date(startedAt).toISOString(),
          finishedAt: new Date(now()).toISOString(),
          status: status >= 200 && status <= 399 ? "success" : "failed",
          endpoint: url.pathname,
          upstreamStatus: status,
          durationMs: Math.max(0, now() - startedAt),
        });
      }
      if (apiLogStore) {
        await appendLogSafely(apiLogStore, {
          id,
          createdAt: new Date(startedAt).toISOString(),
          method: request.method,
          path: url.pathname,
          authKind,
          status,
          durationMs: Math.max(0, now() - startedAt),
          errorSummary,
        });
      }
    }
  }

  return { handle };
}
