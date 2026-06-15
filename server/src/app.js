import {
  clearSessionCookie,
  createSessionCookie,
  createSessionToken,
  getBearer,
  hashPassword,
  isBearerAuthorized,
  parseCookies,
  verifyPassword,
} from "./auth.js";
import { json, methodNotAllowed, notFound, tooManyRequests, unauthorized } from "./http.js";
import { mergeConfigUpdate, normalizeConfig, publicConfig } from "./config.js";
import { forwardOpenAIPath } from "./upstreamProxy.js";
import { summarizeMetrics } from "./metrics.js";

function requireClientAuth(request, config) {
  if (!config.interfaces.some((item) => item.enabled && item.apiToken)) {
    return unauthorized("Server is missing IMAGE_API_TOKEN");
  }
  if (!resolveClientInterface(request, config)) {
    return unauthorized("Unauthorized");
  }
  return null;
}

function resolveClientInterface(request, config) {
  return config.interfaces.find((item) => item.enabled && isBearerAuthorized(request, item.apiToken)) || null;
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

function requireAdminAuth(request, sessions) {
  return requireDashboardSession(request, sessions);
}

function requireDashboardSession(request, sessions) {
  const token = parseCookies(request).image_studio_session || "";
  if (!token || !sessions.has(token)) return unauthorized("请先登录后台");
  return null;
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function classifyAuthKind(request, sessions, config = null) {
  const token = parseCookies(request).image_studio_session || "";
  if (token && sessions.has(token)) return "admin";
  if (config && resolveClientInterface(request, config)) return "client";
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

async function handleAdminConfigSecret({ request, store, url }) {
  if (request.method !== "GET") return methodNotAllowed();
  const kind = url.searchParams.get("kind") || "";
  const id = url.searchParams.get("id") || "";
  const config = normalizeConfig(await store.load());
  if (kind === "interface") {
    const item = config.interfaces.find((entry) => entry.id === id);
    if (!item) return notFound();
    return json({ secret: { kind, id: item.id, value: item.apiToken || "" } });
  }
  if (kind === "upstream") {
    const item = config.upstreams.find((entry) => entry.id === id);
    if (!item) return notFound();
    return json({ secret: { kind, id: item.id, value: item.apiKey || "" } });
  }
  return json({ error: { message: "未知密钥类型" } }, { status: 400 });
}

async function resolveAdminAccount(store, fallbackUsername, fallbackPassword) {
  const config = normalizeConfig(await store.load());
  if (config.adminPasswordHash) return config;
  if (!fallbackPassword) return config;
  const withHash = {
    ...config,
    adminUsername: fallbackUsername || config.adminUsername || "admin",
    adminPasswordHash: await hashPassword(fallbackPassword),
  };
  return store.save(withHash);
}

async function handleLogin({ request, store, sessions, fallbackUsername, fallbackPassword }) {
  if (request.method !== "POST") return methodNotAllowed();
  const body = await request.json().catch(() => ({}));
  const account = await resolveAdminAccount(store, fallbackUsername, fallbackPassword);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  if (!account.adminPasswordHash || username !== account.adminUsername) {
    return unauthorized("账号或密码错误");
  }
  if (!(await verifyPassword(password, account.adminPasswordHash))) {
    return unauthorized("账号或密码错误");
  }
  const sessionToken = createSessionToken();
  sessions.set(sessionToken, { username: account.adminUsername, createdAt: Date.now() });
  return json({
    ok: true,
    account: { username: account.adminUsername },
  }, {
    headers: {
      "set-cookie": createSessionCookie(sessionToken),
    },
  });
}

function handleLogout({ request, sessions }) {
  if (request.method !== "POST") return methodNotAllowed();
  const token = parseCookies(request).image_studio_session || "";
  if (token) sessions.delete(token);
  return json({ ok: true }, {
    headers: {
      "set-cookie": clearSessionCookie(),
    },
  });
}

async function handleSession({ request, store, sessions }) {
  if (request.method !== "GET") return methodNotAllowed();
  const token = parseCookies(request).image_studio_session || "";
  if (!token || !sessions.has(token)) {
    return json({ authenticated: false });
  }
  const config = normalizeConfig(await store.load());
  return json({
    authenticated: true,
    account: { username: config.adminUsername },
  });
}

async function handleAccountUpdate({ request, store }) {
  if (request.method !== "POST") return methodNotAllowed();
  const current = normalizeConfig(await store.load());
  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  const username = String(body.username || current.adminUsername || "admin").trim();
  if (!current.adminPasswordHash) return unauthorized("后台账号还没有初始化密码");
  if (!(await verifyPassword(currentPassword, current.adminPasswordHash))) {
    return unauthorized("当前密码不正确");
  }
  if (!username) {
    return json({ error: { message: "账号不能为空" } }, { status: 400 });
  }
  if (newPassword.trim().length < 8) {
    return json({ error: { message: "新密码至少需要 8 个字符" } }, { status: 400 });
  }
  const saved = await store.save({
    ...current,
    adminUsername: username,
    adminPasswordHash: await hashPassword(newPassword),
  });
  return json({ ok: true, account: { username: saved.adminUsername } });
}

function configForClientInterface(config, clientInterface) {
  const upstreamById = new Map(config.upstreams.map((upstream) => [upstream.id, upstream]));
  const upstreams = clientInterface.upstreamIds
    .map((id) => upstreamById.get(id))
    .filter((upstream) => upstream?.enabled);
  return {
    ...config,
    imageApiToken: clientInterface.apiToken,
    defaultImageModel: clientInterface.defaultImageModel,
    defaultTextModel: clientInterface.defaultTextModel,
    defaultSize: clientInterface.defaultSize,
    defaultQuality: clientInterface.defaultQuality,
    defaultOutputFormat: clientInterface.defaultOutputFormat,
    requestTimeoutSeconds: clientInterface.requestTimeoutSeconds,
    maxConcurrentRequests: clientInterface.maxConcurrentRequests,
    rateLimitPerMinute: clientInterface.rateLimitPerMinute,
    interfaceId: clientInterface.id,
    interfaceName: clientInterface.name,
    upstreams,
    upstreamBaseURL: upstreams[0]?.baseURL || "",
    upstreamApiKey: upstreams[0]?.apiKey || "",
  };
}

export function createSelfHostedApp({
  store,
  adminUsername = process.env.ADMIN_USERNAME || "admin",
  adminPassword = process.env.ADMIN_PASSWORD || "",
  apiLogStore = null,
  generationLogStore = null,
  updateService = null,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  if (!store) throw new Error("createSelfHostedApp requires a config store");
  if (!fetchImpl) throw new Error("createSelfHostedApp requires fetch");
  const rateLimiter = createRateLimiter(now);
  const sessions = new Map();
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

      if (url.pathname === "/api/login") {
        authKind = "login";
        response = await handleLogin({
          request,
          store,
          sessions,
          fallbackUsername: adminUsername,
          fallbackPassword: adminPassword,
        });
        return response;
      }

      if (url.pathname === "/api/logout") {
        authKind = classifyAuthKind(request, sessions);
        response = handleLogout({ request, sessions });
        return response;
      }

      if (url.pathname === "/api/session") {
        authKind = classifyAuthKind(request, sessions);
        response = await handleSession({ request, store, sessions });
        return response;
      }

      if (url.pathname === "/api/config") {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        response = await handleAdminConfig({ request, store });
        return response;
      }

      if (url.pathname === "/api/config/secrets") {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        response = await handleAdminConfigSecret({ request, store, url });
        return response;
      }

      if (url.pathname === "/api/account") {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        response = await handleAccountUpdate({ request, store });
        return response;
      }

      if (url.pathname === "/api/logs") {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
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
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
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
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
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
        authKind = classifyAuthKind(request, sessions, config);
        const authError = requireClientAuth(request, config);
        if (authError) {
          response = authError;
          return response;
        }
        const clientInterface = resolveClientInterface(request, config);
        const runtimeConfig = configForClientInterface(config, clientInterface);
        if (activeRequests >= runtimeConfig.maxConcurrentRequests) {
          response = tooManyRequests("Too many active requests");
          return response;
        }
        const rateLimitError = rateLimiter.check(getBearer(request), runtimeConfig.rateLimitPerMinute);
        if (rateLimitError) {
          response = rateLimitError;
          return response;
        }
        activeRequests += 1;
        try {
          response = await forwardOpenAIPath({ request, config: runtimeConfig, fetchImpl });
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
          interfaceId: response.headers.get("x-image-studio-interface-id") || "",
          upstreamId: response.headers.get("x-image-studio-upstream-id") || "",
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
