import { getBearer, isBearerAuthorized } from "./auth.js";
import { json, methodNotAllowed, notFound, tooManyRequests, unauthorized } from "./http.js";
import { mergeConfigUpdate, normalizeConfig, publicConfig } from "./config.js";
import { forwardOpenAIPath } from "./upstreamProxy.js";

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
