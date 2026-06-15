import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_QUALITY,
  DEFAULT_SIZE,
  DEFAULT_TEXT_MODEL,
  normalizeBaseURL,
} from "../../shared/kernel/requestModel.js";

export const DEFAULT_CONFIG = {
  adminUsername: "admin",
  adminPasswordHash: "",
  upstreamBaseURL: "",
  upstreamApiKey: "",
  imageApiToken: "",
  defaultImageModel: DEFAULT_IMAGE_MODEL,
  defaultTextModel: DEFAULT_TEXT_MODEL,
  defaultSize: DEFAULT_SIZE,
  defaultQuality: DEFAULT_QUALITY,
  defaultOutputFormat: DEFAULT_OUTPUT_FORMAT,
  requestTimeoutSeconds: 120,
  maxConcurrentRequests: 1,
  rateLimitPerMinute: 10,
  interfaces: [],
  upstreams: [],
};

const DEFAULT_INTERFACE_ID = "default";
const DEFAULT_UPSTREAM_ID = "default";

export function parseDotEnv(raw) {
  const values = {};
  for (const line of String(raw || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex < 0) continue;
    const key = trimmed.slice(0, equalIndex).trim();
    if (!key) continue;
    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export async function loadDotEnv(path, env = process.env) {
  try {
    const parsed = parseDotEnv(await readFile(path, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (env[key] === undefined) env[key] = value;
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function positiveInteger(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

function normalizeId(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function hasOwnValue(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function byId(items) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.id) map.set(item.id, item);
  }
  return map;
}

function uniqueIds(values, fallback = []) {
  const ids = [];
  for (const value of Array.isArray(values) ? values : fallback) {
    const id = normalizeId(value, "");
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids.length ? ids : [...fallback];
}

function isMaskedSecretPlaceholder(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return false;
  const compact = text.replace(/\s+/g, "");
  return compact.includes("••")
    || compact.includes("...saved")
    || compact.includes("已保存")
    || /^[*•●·]+$/.test(compact);
}

function secretUpdateOrPrevious(value, previous = "") {
  const next = String(value ?? "").trim();
  if (!next || isMaskedSecretPlaceholder(next)) return previous || "";
  return next;
}

function legacyInterfaceFrom(values) {
  return {
    id: DEFAULT_INTERFACE_ID,
    name: "默认接口",
    apiToken: values.imageApiToken,
    upstreamIds: [DEFAULT_UPSTREAM_ID],
    defaultImageModel: values.defaultImageModel,
    defaultTextModel: values.defaultTextModel,
    defaultSize: values.defaultSize,
    defaultQuality: values.defaultQuality,
    defaultOutputFormat: values.defaultOutputFormat,
    requestTimeoutSeconds: values.requestTimeoutSeconds,
    maxConcurrentRequests: values.maxConcurrentRequests,
    rateLimitPerMinute: values.rateLimitPerMinute,
    enabled: true,
  };
}

function legacyUpstreamFrom(values) {
  return {
    id: DEFAULT_UPSTREAM_ID,
    name: "默认上游",
    baseURL: values.upstreamBaseURL,
    apiKey: values.upstreamApiKey,
    enabled: true,
  };
}

function normalizeInterface(raw = {}, index = 0, previous = {}) {
  const id = normalizeId(raw.id, index === 0 ? DEFAULT_INTERFACE_ID : `interface-${index + 1}`);
  return {
    id,
    name: String(raw.name || previous.name || (id === DEFAULT_INTERFACE_ID ? "默认接口" : `接口 ${index + 1}`)).trim(),
    enabled: raw.enabled !== false,
    apiToken: String(raw.apiToken ?? raw.imageApiToken ?? previous.apiToken ?? "").trim(),
    upstreamIds: uniqueIds(raw.upstreamIds, previous.upstreamIds || [DEFAULT_UPSTREAM_ID]),
    defaultImageModel: String(raw.defaultImageModel || previous.defaultImageModel || DEFAULT_IMAGE_MODEL).trim() || DEFAULT_IMAGE_MODEL,
    defaultTextModel: String(raw.defaultTextModel || previous.defaultTextModel || DEFAULT_TEXT_MODEL).trim() || DEFAULT_TEXT_MODEL,
    defaultSize: String(raw.defaultSize || previous.defaultSize || DEFAULT_SIZE).trim() || DEFAULT_SIZE,
    defaultQuality: String(raw.defaultQuality || previous.defaultQuality || DEFAULT_QUALITY).trim() || DEFAULT_QUALITY,
    defaultOutputFormat: String(raw.defaultOutputFormat || previous.defaultOutputFormat || DEFAULT_OUTPUT_FORMAT).trim() || DEFAULT_OUTPUT_FORMAT,
    requestTimeoutSeconds: positiveInteger(
      raw.requestTimeoutSeconds ?? previous.requestTimeoutSeconds,
      DEFAULT_CONFIG.requestTimeoutSeconds,
      10,
      900,
    ),
    maxConcurrentRequests: positiveInteger(
      raw.maxConcurrentRequests ?? previous.maxConcurrentRequests,
      DEFAULT_CONFIG.maxConcurrentRequests,
      1,
      10,
    ),
    rateLimitPerMinute: positiveInteger(
      raw.rateLimitPerMinute ?? previous.rateLimitPerMinute,
      DEFAULT_CONFIG.rateLimitPerMinute,
      1,
      600,
    ),
  };
}

function normalizeUpstream(raw = {}, index = 0, previous = {}) {
  const id = normalizeId(raw.id, index === 0 ? DEFAULT_UPSTREAM_ID : `upstream-${index + 1}`);
  return {
    id,
    name: String(raw.name || previous.name || (id === DEFAULT_UPSTREAM_ID ? "默认上游" : `上游 ${index + 1}`)).trim(),
    enabled: raw.enabled !== false,
    baseURL: normalizeBaseURL(raw.baseURL ?? raw.upstreamBaseURL ?? previous.baseURL),
    apiKey: String(raw.apiKey ?? raw.upstreamApiKey ?? previous.apiKey ?? "").trim(),
  };
}

function normalizeCollection(items, previousItems, normalizeItem) {
  const previousMap = byId(previousItems);
  const seen = new Set();
  const normalized = [];
  for (const [index, item] of (Array.isArray(items) ? items : []).entries()) {
    const fallbackId = index === 0 ? "default" : `item-${index + 1}`;
    const id = normalizeId(item?.id, fallbackId);
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push(normalizeItem({ ...item, id }, index, previousMap.get(id) || {}));
  }
  return normalized;
}

export function configFromEnv(env = process.env) {
  return normalizeConfig({
    adminUsername: firstValue(env.ADMIN_USERNAME, env.IMAGE_STUDIO_ADMIN_USERNAME),
    adminPasswordHash: firstValue(env.ADMIN_PASSWORD_HASH, env.IMAGE_STUDIO_ADMIN_PASSWORD_HASH),
    upstreamBaseURL: firstValue(env.UPSTREAM_BASE_URL, env.IMAGE_STUDIO_UPSTREAM_BASE_URL),
    upstreamApiKey: firstValue(env.UPSTREAM_API_KEY, env.IMAGE_STUDIO_UPSTREAM_API_KEY),
    imageApiToken: firstValue(env.IMAGE_API_TOKEN, env.IMAGE_STUDIO_API_TOKEN),
    defaultImageModel: firstValue(env.DEFAULT_IMAGE_MODEL, env.IMAGE_STUDIO_DEFAULT_IMAGE_MODEL),
    defaultTextModel: firstValue(env.DEFAULT_TEXT_MODEL, env.IMAGE_STUDIO_DEFAULT_TEXT_MODEL),
    defaultSize: firstValue(env.DEFAULT_IMAGE_SIZE, env.IMAGE_STUDIO_DEFAULT_SIZE),
    defaultQuality: firstValue(env.DEFAULT_IMAGE_QUALITY, env.IMAGE_STUDIO_DEFAULT_QUALITY),
    defaultOutputFormat: firstValue(env.DEFAULT_OUTPUT_FORMAT, env.IMAGE_STUDIO_DEFAULT_OUTPUT_FORMAT),
    requestTimeoutSeconds: firstValue(env.REQUEST_TIMEOUT_SECONDS, env.IMAGE_STUDIO_REQUEST_TIMEOUT_SECONDS),
    maxConcurrentRequests: firstValue(env.MAX_CONCURRENT_REQUESTS, env.IMAGE_STUDIO_MAX_CONCURRENT_REQUESTS),
    rateLimitPerMinute: firstValue(env.RATE_LIMIT_PER_MINUTE, env.IMAGE_STUDIO_RATE_LIMIT_PER_MINUTE),
  });
}

export function normalizeConfig(input = {}, previous = {}) {
  const merged = {
    ...DEFAULT_CONFIG,
    ...previous,
    ...input,
  };
  const legacyInterface = legacyInterfaceFrom(merged);
  const legacyUpstream = legacyUpstreamFrom(merged);
  const useInputInterfaces = Array.isArray(input.interfaces);
  const useInputUpstreams = Array.isArray(input.upstreams);
  const inputHasLegacyInterface = hasOwnValue(input, "imageApiToken")
    || hasOwnValue(input, "defaultImageModel")
    || hasOwnValue(input, "defaultTextModel")
    || hasOwnValue(input, "defaultSize")
    || hasOwnValue(input, "defaultQuality")
    || hasOwnValue(input, "defaultOutputFormat")
    || hasOwnValue(input, "requestTimeoutSeconds")
    || hasOwnValue(input, "maxConcurrentRequests")
    || hasOwnValue(input, "rateLimitPerMinute");
  const inputHasLegacyUpstream = hasOwnValue(input, "upstreamBaseURL") || hasOwnValue(input, "upstreamApiKey");
  const rawInterfaces = useInputInterfaces
    ? input.interfaces
    : (inputHasLegacyInterface || !Array.isArray(previous.interfaces) ? [legacyInterface] : previous.interfaces);
  const rawUpstreams = useInputUpstreams
    ? input.upstreams
    : (inputHasLegacyUpstream || !Array.isArray(previous.upstreams) ? [legacyUpstream] : previous.upstreams);
  const upstreams = normalizeCollection(rawUpstreams, previous.upstreams, normalizeUpstream);
  if (!upstreams.length) upstreams.push(normalizeUpstream(legacyUpstream, 0));
  const upstreamIdSet = new Set(upstreams.map((upstream) => upstream.id));
  const interfaces = normalizeCollection(rawInterfaces, previous.interfaces, normalizeInterface)
    .map((item) => ({
      ...item,
      upstreamIds: item.upstreamIds.filter((id) => upstreamIdSet.has(id)),
    }))
    .map((item) => ({
      ...item,
      upstreamIds: item.upstreamIds.length ? item.upstreamIds : [upstreams[0].id],
    }));
  if (!interfaces.length) interfaces.push(normalizeInterface(legacyInterface, 0));
  const primaryInterface = interfaces[0];
  const upstreamById = byId(upstreams);
  const primaryUpstream = upstreamById.get(primaryInterface.upstreamIds[0]) || upstreams[0];
  return {
    adminUsername: String(merged.adminUsername || DEFAULT_CONFIG.adminUsername).trim() || DEFAULT_CONFIG.adminUsername,
    adminPasswordHash: String(merged.adminPasswordHash || "").trim(),
    upstreamBaseURL: primaryUpstream.baseURL,
    upstreamApiKey: primaryUpstream.apiKey,
    imageApiToken: primaryInterface.apiToken,
    defaultImageModel: primaryInterface.defaultImageModel,
    defaultTextModel: primaryInterface.defaultTextModel,
    defaultSize: primaryInterface.defaultSize,
    defaultQuality: primaryInterface.defaultQuality,
    defaultOutputFormat: primaryInterface.defaultOutputFormat,
    requestTimeoutSeconds: primaryInterface.requestTimeoutSeconds,
    maxConcurrentRequests: primaryInterface.maxConcurrentRequests,
    rateLimitPerMinute: primaryInterface.rateLimitPerMinute,
    interfaces,
    upstreams,
  };
}

export function publicConfig(config) {
  const normalized = normalizeConfig(config);
  return {
    adminUsername: normalized.adminUsername,
    adminPasswordSet: !!normalized.adminPasswordHash,
    upstreamBaseURL: normalized.upstreamBaseURL,
    upstreamApiKeySet: !!normalized.upstreamApiKey,
    imageApiTokenSet: !!normalized.imageApiToken,
    defaultImageModel: normalized.defaultImageModel,
    defaultTextModel: normalized.defaultTextModel,
    defaultSize: normalized.defaultSize,
    defaultQuality: normalized.defaultQuality,
    defaultOutputFormat: normalized.defaultOutputFormat,
    requestTimeoutSeconds: normalized.requestTimeoutSeconds,
    maxConcurrentRequests: normalized.maxConcurrentRequests,
    rateLimitPerMinute: normalized.rateLimitPerMinute,
    interfaces: normalized.interfaces.map((item) => ({
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
      requestTimeoutSeconds: item.requestTimeoutSeconds,
      maxConcurrentRequests: item.maxConcurrentRequests,
      rateLimitPerMinute: item.rateLimitPerMinute,
    })),
    upstreams: normalized.upstreams.map((item) => ({
      id: item.id,
      name: item.name,
      enabled: item.enabled,
      baseURL: item.baseURL,
      apiKeySet: !!item.apiKey,
    })),
  };
}

export function mergeConfigUpdate(current, patch) {
  const normalizedCurrent = normalizeConfig(current);
  const currentInterfaces = byId(normalizedCurrent.interfaces);
  const currentUpstreams = byId(normalizedCurrent.upstreams);
  const next = {
    ...normalizedCurrent,
    adminUsername: patch.adminUsername ?? normalizedCurrent.adminUsername,
    adminPasswordHash: patch.adminPasswordHash ?? normalizedCurrent.adminPasswordHash,
  };

  if (Array.isArray(patch.interfaces)) {
    next.interfaces = patch.interfaces.map((item, index) => {
      const id = normalizeId(item?.id, index === 0 ? DEFAULT_INTERFACE_ID : `interface-${index + 1}`);
      const previousItem = currentInterfaces.get(id) || {};
      return {
        ...previousItem,
        ...item,
        id,
        apiToken: secretUpdateOrPrevious(item?.apiToken, previousItem.apiToken),
      };
    });
  } else {
    const interfaces = [...normalizedCurrent.interfaces];
    const first = {
      ...interfaces[0],
      defaultImageModel: patch.defaultImageModel ?? interfaces[0].defaultImageModel,
      defaultTextModel: patch.defaultTextModel ?? interfaces[0].defaultTextModel,
      defaultSize: patch.defaultSize ?? interfaces[0].defaultSize,
      defaultQuality: patch.defaultQuality ?? interfaces[0].defaultQuality,
      defaultOutputFormat: patch.defaultOutputFormat ?? interfaces[0].defaultOutputFormat,
      requestTimeoutSeconds: patch.requestTimeoutSeconds ?? interfaces[0].requestTimeoutSeconds,
      maxConcurrentRequests: patch.maxConcurrentRequests ?? interfaces[0].maxConcurrentRequests,
      rateLimitPerMinute: patch.rateLimitPerMinute ?? interfaces[0].rateLimitPerMinute,
    };
    if (String(patch.imageApiToken || "").trim()) {
      first.apiToken = String(patch.imageApiToken).trim();
    }
    interfaces[0] = first;
    next.interfaces = interfaces;
  }

  if (Array.isArray(patch.upstreams)) {
    next.upstreams = patch.upstreams.map((item, index) => {
      const id = normalizeId(item?.id, index === 0 ? DEFAULT_UPSTREAM_ID : `upstream-${index + 1}`);
      const previousItem = currentUpstreams.get(id) || {};
      return {
        ...previousItem,
        ...item,
        id,
        apiKey: secretUpdateOrPrevious(item?.apiKey, previousItem.apiKey),
      };
    });
  } else {
    const upstreams = [...normalizedCurrent.upstreams];
    const first = {
      ...upstreams[0],
      baseURL: patch.upstreamBaseURL ?? upstreams[0].baseURL,
    };
    if (String(patch.upstreamApiKey || "").trim()) {
      first.apiKey = String(patch.upstreamApiKey).trim();
    }
    upstreams[0] = first;
    next.upstreams = upstreams;
  }

  return normalizeConfig(next);
}

export function createFileConfigStore(path, env = process.env) {
  const envConfig = configFromEnv(env);

  async function load() {
    try {
      const raw = await readFile(path, "utf8");
      return normalizeConfig(JSON.parse(raw), envConfig);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      return envConfig;
    }
  }

  async function save(config) {
    const normalized = normalizeConfig(config);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return normalized;
  }

  return { load, save };
}
