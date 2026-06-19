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
import { randomBytes } from "node:crypto";

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

function createApiToken() {
  return `img_${randomBytes(24).toString("base64url")}`;
}

function nowISO(now) {
  return new Date(now()).toISOString();
}

function publicInterface(item) {
  return {
    id: item.id,
    name: item.name,
    enabled: item.enabled,
    apiTokenSet: !!item.apiToken,
    upstreamIds: item.upstreamIds,
    defaultImageModel: item.defaultImageModel,
    defaultTextModel: item.defaultTextModel,
    defaultSize: item.defaultSize,
    defaultQuality: item.defaultQuality,
    defaultOutputFormat: item.defaultOutputFormat,
    qualityPresetId: item.qualityPresetId,
    requestTimeoutSeconds: item.requestTimeoutSeconds,
    maxConcurrentRequests: item.maxConcurrentRequests,
    rateLimitPerMinute: item.rateLimitPerMinute,
    lastUsedAt: item.lastUsedAt,
  };
}

function routeIdFromPath(pathname, prefix, suffix = "") {
  if (!pathname.startsWith(prefix)) return "";
  if (suffix && !pathname.endsWith(suffix)) return "";
  return decodeURIComponent(pathname.slice(prefix.length, suffix ? -suffix.length : undefined));
}

function logFiltersFromURL(url) {
  const filters = {};
  for (const key of ["interfaceId", "upstreamId", "model", "endpoint", "requestId", "status", "from", "to"]) {
    const value = url.searchParams.get(key);
    if (value) filters[key] = value;
  }
  for (const key of ["minDurationMs", "maxDurationMs"]) {
    const value = url.searchParams.get(key);
    if (value !== null && value !== "") filters[key] = Number(value);
  }
  return filters;
}

function recordsToJSONL(records) {
  return records.map((record) => JSON.stringify(record)).join("\n") + (records.length ? "\n" : "");
}

function recordsToCSV(records) {
  const headers = Array.from(new Set(records.flatMap((record) => Object.keys(record || {}))));
  const escapeCell = (value) => {
    const text = Array.isArray(value) || (value && typeof value === "object") ? JSON.stringify(value) : String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...records.map((record) => headers.map((header) => escapeCell(record?.[header])).join(","))].join("\n");
}

function appendAudit(auditRecords, action, details, username, now) {
  auditRecords.unshift({
    id: createRequestId(),
    createdAt: nowISO(now),
    username: username || "admin",
    action,
    details,
  });
  auditRecords.splice(200);
}

function summarizeUsage(records) {
  const createBucket = () => ({ total: 0, success: 0, failed: 0, durationMs: 0 });
  const usage = {
    total: createBucket(),
    byInterface: {},
    byUpstream: {},
    byModel: {},
  };
  for (const record of records) {
    const failed = record?.status === "failed" || Number(record?.status) >= 400;
    const durationMs = Number(record?.durationMs) || 0;
    const add = (bucket) => {
      bucket.total += 1;
      bucket.durationMs += durationMs;
      if (failed) bucket.failed += 1;
      else bucket.success += 1;
    };
    add(usage.total);
    for (const [group, key] of [
      [usage.byInterface, record?.interfaceId || "unknown"],
      [usage.byUpstream, record?.upstreamId || "unknown"],
      [usage.byModel, record?.model || "unknown"],
    ]) {
      if (!group[key]) group[key] = createBucket();
      add(group[key]);
    }
  }
  return usage;
}

function publicSessions(sessions, currentToken) {
  return Array.from(sessions.entries()).map(([token, session]) => ({
    id: session.id || token.slice(0, 12),
    username: session.username || "admin",
    createdAt: new Date(session.createdAt || Date.now()).toISOString(),
    current: token === currentToken,
  }));
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

async function handleAdminConfig({ request, store, configVersions, auditRecords, username, now }) {
  if (request.method === "GET") {
    const config = normalizeConfig(await store.load());
    return json({ config: publicConfig(config) });
  }
  if (request.method !== "POST") return methodNotAllowed();
  const current = normalizeConfig(await store.load());
  const patch = await request.json().catch(() => ({}));
  const next = mergeConfigUpdate(current, patch);
  configVersions.unshift({
    id: createRequestId(),
    createdAt: nowISO(now),
    username: username || current.adminUsername || "admin",
    summary: "后台配置保存前快照",
    snapshot: publicConfig(current),
    rawSnapshot: current,
  });
  configVersions.splice(50);
  const saved = await store.save(next);
  appendAudit(auditRecords, "config.update", { changedKeys: Object.keys(patch || {}) }, username, now);
  return json({ ok: true, config: publicConfig(saved) });
}

async function handleAdminConfigSecret({ request, store, url, auditRecords, username, now }) {
  if (request.method !== "GET") return methodNotAllowed();
  const kind = url.searchParams.get("kind") || "";
  const id = url.searchParams.get("id") || "";
  const config = normalizeConfig(await store.load());
  if (kind === "interface") {
    const item = config.interfaces.find((entry) => entry.id === id);
    if (!item) return notFound();
    appendAudit(auditRecords, "secret.reveal", { kind, id }, username, now);
    return json({ secret: { kind, id: item.id, value: item.apiToken || "" } });
  }
  if (kind === "upstream") {
    const item = config.upstreams.find((entry) => entry.id === id);
    if (!item) return notFound();
    appendAudit(auditRecords, "secret.reveal", { kind, id }, username, now);
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

async function handleLogin({ request, store, sessions, fallbackUsername, fallbackPassword, auditRecords, now }) {
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
  sessions.set(sessionToken, { id: createRequestId(), username: account.adminUsername, createdAt: now() });
  appendAudit(auditRecords, "auth.login", { username: account.adminUsername }, account.adminUsername, now);
  return json({
    ok: true,
    account: { username: account.adminUsername },
  }, {
    headers: {
      "set-cookie": createSessionCookie(sessionToken),
    },
  });
}

function handleLogout({ request, sessions, auditRecords, now }) {
  if (request.method !== "POST") return methodNotAllowed();
  const token = parseCookies(request).image_studio_session || "";
  const session = token ? sessions.get(token) : null;
  if (token) sessions.delete(token);
  appendAudit(auditRecords, "auth.logout", {}, session?.username || "admin", now);
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

async function handleRotateInterfaceKey({ request, store, interfaceId, auditRecords, username, now }) {
  if (request.method !== "POST") return methodNotAllowed();
  const current = normalizeConfig(await store.load());
  const index = current.interfaces.findIndex((item) => item.id === interfaceId);
  if (index < 0) return notFound();
  const apiToken = createApiToken();
  const interfaces = current.interfaces.map((item, itemIndex) => (
    itemIndex === index ? { ...item, apiToken } : item
  ));
  const saved = await store.save({ ...current, interfaces });
  appendAudit(auditRecords, "interface.rotate-key", { interfaceId }, username, now);
  return json({
    ok: true,
    apiToken,
    interface: publicInterface(saved.interfaces[index]),
    config: publicConfig(saved),
  });
}

async function handleCloneInterface({ request, store, interfaceId, auditRecords, username, now }) {
  if (request.method !== "POST") return methodNotAllowed();
  const body = await request.json().catch(() => ({}));
  const current = normalizeConfig(await store.load());
  const source = current.interfaces.find((item) => item.id === interfaceId);
  if (!source) return notFound();
  const id = String(body.id || `${source.id}-copy`).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!id) return json({ error: { message: "接口 ID 不能为空" } }, { status: 400 });
  if (current.interfaces.some((item) => item.id === id)) {
    return json({ error: { message: "接口 ID 已存在" } }, { status: 409 });
  }
  const clone = {
    ...source,
    id,
    name: String(body.name || `${source.name} 副本`).trim(),
    apiToken: createApiToken(),
    lastUsedAt: "",
  };
  const saved = await store.save({ ...current, interfaces: [...current.interfaces, clone] });
  appendAudit(auditRecords, "interface.clone", { from: interfaceId, to: id }, username, now);
  return json({
    ok: true,
    interface: publicInterface(saved.interfaces.find((item) => item.id === id)),
    config: publicConfig(saved),
  });
}

async function handleTestUpstream({ request, store, upstreamId, fetchImpl, auditRecords, username, now }) {
  if (request.method !== "POST") return methodNotAllowed();
  const config = normalizeConfig(await store.load());
  const upstream = config.upstreams.find((item) => item.id === upstreamId);
  if (!upstream) return notFound();
  if (!upstream.baseURL) return json({ error: { message: "上游 Base URL 未配置" } }, { status: 400 });
  if (!upstream.apiKey) return json({ error: { message: "上游 API Key 未配置" } }, { status: 400 });
  const startedAt = now();
  try {
    const response = await fetchImpl(`${upstream.baseURL}/v1/models`.replace(/\/v1\/v1\//, "/v1/"), {
      method: "GET",
      headers: new Headers({
        accept: "application/json",
        authorization: `Bearer ${upstream.apiKey}`,
      }),
    });
    const result = {
      id: upstream.id,
      name: upstream.name,
      status: response.ok ? "healthy" : "unhealthy",
      upstreamStatus: response.status,
      durationMs: Math.max(0, now() - startedAt),
      checkedAt: nowISO(now),
      message: response.ok ? "上游连接正常" : `上游返回 HTTP ${response.status}`,
    };
    appendAudit(auditRecords, "upstream.test", { upstreamId, status: result.status }, username, now);
    return json({ ok: response.ok, upstream: result }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return json({
      ok: false,
      upstream: {
        id: upstream.id,
        name: upstream.name,
        status: "unhealthy",
        upstreamStatus: 0,
        durationMs: Math.max(0, now() - startedAt),
        checkedAt: nowISO(now),
        message: error?.message || "上游连接失败",
      },
    }, { status: 502 });
  }
}

async function handleConfigVersions({ request, store, configVersions, versionId, auditRecords, username, now }) {
  if (!versionId) {
    if (request.method !== "GET") return methodNotAllowed();
    return json({ versions: configVersions.map(({ rawSnapshot: _rawSnapshot, ...version }) => version) });
  }
  if (request.method !== "POST") return methodNotAllowed();
  const version = configVersions.find((item) => item.id === versionId);
  if (!version) return notFound();
  const saved = await store.save(version.rawSnapshot || version.snapshot);
  appendAudit(auditRecords, "config.restore", { versionId }, username, now);
  return json({ ok: true, config: publicConfig(saved) });
}

async function handleModels({ request, store }) {
  const current = normalizeConfig(await store.load());
  if (request.method === "GET") return json({ models: current.models });
  if (request.method !== "PUT") return methodNotAllowed();
  const body = await request.json().catch(() => ({}));
  const saved = await store.save(mergeConfigUpdate(current, { models: body.models || [] }));
  return json({ ok: true, models: saved.models, config: publicConfig(saved) });
}

async function handleQualityPresets({ request, store }) {
  const current = normalizeConfig(await store.load());
  if (request.method === "GET") return json({ qualityPresets: current.qualityPresets });
  if (request.method !== "PUT") return methodNotAllowed();
  const body = await request.json().catch(() => ({}));
  const saved = await store.save(mergeConfigUpdate(current, { qualityPresets: body.qualityPresets || [] }));
  return json({ ok: true, qualityPresets: saved.qualityPresets, config: publicConfig(saved) });
}

async function handleAlerts({ request, store, auditRecords, username, now }) {
  const current = normalizeConfig(await store.load());
  if (request.method === "GET") return json({ alerts: publicConfig(current).alerts });
  if (request.method !== "PUT") return methodNotAllowed();
  const body = await request.json().catch(() => ({}));
  const saved = await store.save(mergeConfigUpdate(current, { alerts: body.alerts || {} }));
  appendAudit(auditRecords, "alerts.update", {}, username, now);
  return json({ ok: true, alerts: publicConfig(saved).alerts, config: publicConfig(saved) });
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
  const auditRecords = [];
  const configVersions = [];
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
          auditRecords,
          now,
        });
        return response;
      }

      if (url.pathname === "/api/logout") {
        authKind = classifyAuthKind(request, sessions);
        response = handleLogout({ request, sessions, auditRecords, now });
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
        const token = parseCookies(request).image_studio_session || "";
        response = await handleAdminConfig({
          request,
          store,
          configVersions,
          auditRecords,
          username: sessions.get(token)?.username,
          now,
        });
        return response;
      }

      if (url.pathname === "/api/config/secrets") {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        const token = parseCookies(request).image_studio_session || "";
        response = await handleAdminConfigSecret({
          request,
          store,
          url,
          auditRecords,
          username: sessions.get(token)?.username,
          now,
        });
        return response;
      }

      const rotateInterfaceId = routeIdFromPath(url.pathname, "/api/interfaces/", "/rotate-key");
      if (rotateInterfaceId) {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        const token = parseCookies(request).image_studio_session || "";
        response = await handleRotateInterfaceKey({
          request,
          store,
          interfaceId: rotateInterfaceId,
          auditRecords,
          username: sessions.get(token)?.username,
          now,
        });
        return response;
      }

      const cloneInterfaceId = routeIdFromPath(url.pathname, "/api/interfaces/", "/clone");
      if (cloneInterfaceId) {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        const token = parseCookies(request).image_studio_session || "";
        response = await handleCloneInterface({
          request,
          store,
          interfaceId: cloneInterfaceId,
          auditRecords,
          username: sessions.get(token)?.username,
          now,
        });
        return response;
      }

      const testInterfaceId = routeIdFromPath(url.pathname, "/api/interfaces/", "/test");
      if (testInterfaceId) {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        const config = normalizeConfig(await store.load());
        const clientInterface = config.interfaces.find((item) => item.id === testInterfaceId);
        if (!clientInterface) {
          response = notFound();
          return response;
        }
        response = json({
          ok: true,
          interface: publicInterface(clientInterface),
          message: "接口配置可用",
        });
        return response;
      }

      const testUpstreamId = routeIdFromPath(url.pathname, "/api/upstreams/", "/test");
      if (testUpstreamId) {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        const token = parseCookies(request).image_studio_session || "";
        response = await handleTestUpstream({
          request,
          store,
          upstreamId: testUpstreamId,
          fetchImpl,
          auditRecords,
          username: sessions.get(token)?.username,
          now,
        });
        return response;
      }

      if (url.pathname === "/api/upstreams/health") {
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
        const [config, generations] = await Promise.all([
          store.load().then(normalizeConfig),
          generationLogStore ? generationLogStore.readRecent(500) : [],
        ]);
        const metrics = summarizeMetrics({ generations, now });
        response = json({
          upstreams: config.upstreams.map((upstream) => ({
            id: upstream.id,
            name: upstream.name,
            enabled: upstream.enabled,
            healthCheckEnabled: upstream.healthCheckEnabled,
            priority: upstream.priority,
            weight: upstream.weight,
            metrics: metrics.upstreams[upstream.id] || {
              total: 0,
              success: 0,
              failed: 0,
              successRate: 0,
              p95DurationMs: 0,
              lastFailure: "",
            },
          })),
        });
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

      if (url.pathname === "/api/models") {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        response = await handleModels({ request, store });
        return response;
      }

      if (url.pathname === "/api/quality-presets") {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        response = await handleQualityPresets({ request, store });
        return response;
      }

      if (url.pathname === "/api/alerts") {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        const token = parseCookies(request).image_studio_session || "";
        response = await handleAlerts({
          request,
          store,
          auditRecords,
          username: sessions.get(token)?.username,
          now,
        });
        return response;
      }

      if (url.pathname === "/api/config/versions" || url.pathname.startsWith("/api/config/versions/")) {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        const token = parseCookies(request).image_studio_session || "";
        response = await handleConfigVersions({
          request,
          store,
          configVersions,
          versionId: routeIdFromPath(url.pathname, "/api/config/versions/", "/restore"),
          auditRecords,
          username: sessions.get(token)?.username,
          now,
        });
        return response;
      }

      if (url.pathname === "/api/audit-logs") {
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
        response = json({ records: auditRecords });
        return response;
      }

      if (url.pathname === "/api/sessions") {
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
        const token = parseCookies(request).image_studio_session || "";
        response = json({ sessions: publicSessions(sessions, token) });
        return response;
      }

      if (url.pathname === "/api/sessions/revoke") {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        if (request.method !== "POST") {
          response = methodNotAllowed();
          return response;
        }
        const body = await request.json().catch(() => ({}));
        for (const [token, session] of sessions.entries()) {
          if (session.id === body.id) sessions.delete(token);
        }
        response = json({ ok: true });
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
        response = json({ records: logStore ? await logStore.readRecent(Number(url.searchParams.get("limit") || 50), logFiltersFromURL(url)) : [] });
        return response;
      }

      if (url.pathname === "/api/logs/export") {
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
        const records = logStore
          ? (logStore.readAll ? await logStore.readAll(logFiltersFromURL(url)) : await logStore.readRecent(500, logFiltersFromURL(url)))
          : [];
        const format = url.searchParams.get("format") === "csv" ? "csv" : "jsonl";
        response = new Response(format === "csv" ? recordsToCSV(records) : recordsToJSONL(records), {
          status: 200,
          headers: {
            "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson; charset=utf-8",
          },
        });
        return response;
      }

      if (url.pathname === "/api/usage") {
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
        const records = generationLogStore
          ? (generationLogStore.readAll ? await generationLogStore.readAll(logFiltersFromURL(url)) : await generationLogStore.readRecent(500, logFiltersFromURL(url)))
          : [];
        response = json({ usage: summarizeUsage(records) });
        return response;
      }

      if (url.pathname === "/api/backup") {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        if (request.method !== "POST") {
          response = methodNotAllowed();
          return response;
        }
        const config = normalizeConfig(await store.load());
        response = json({
          ok: true,
          backup: {
            createdAt: nowISO(now),
            config: publicConfig(config),
          },
        });
        return response;
      }

      if (url.pathname === "/api/restore") {
        authKind = classifyAuthKind(request, sessions);
        const authError = requireAdminAuth(request, sessions);
        if (authError) {
          response = authError;
          return response;
        }
        if (request.method !== "POST") {
          response = methodNotAllowed();
          return response;
        }
        const body = await request.json().catch(() => ({}));
        const restored = await store.save(body.config || body.backup?.config || {});
        response = json({ ok: true, config: publicConfig(restored) });
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
          const updatedConfig = normalizeConfig(await store.load());
          const nextInterfaces = updatedConfig.interfaces.map((item) => (
            item.id === clientInterface.id ? { ...item, lastUsedAt: nowISO(now) } : item
          ));
          await store.save({ ...updatedConfig, interfaces: nextInterfaces });
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
          model: response.headers.get("x-image-studio-model") || "",
          upstreamStatus: status,
          retryCount: Number(response.headers.get("x-image-studio-retry-count") || 0),
          failoverChain: (response.headers.get("x-image-studio-failover-chain") || "").split(",").filter(Boolean),
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
