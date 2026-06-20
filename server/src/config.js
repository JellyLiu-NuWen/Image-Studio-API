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
  defaultQuality: "high",
  defaultOutputFormat: DEFAULT_OUTPUT_FORMAT,
  requestTimeoutSeconds: 120,
  maxConcurrentRequests: 1,
  rateLimitPerMinute: 10,
  interfaces: [],
  upstreams: [],
  models: [],
  qualityPresets: [],
  qualityCases: [],
  acknowledgedAlerts: [],
  alerts: {},
  security: {},
};

const DEFAULT_INTERFACE_ID = "default";
const DEFAULT_UPSTREAM_ID = "default";

const DEFAULT_ALERTS = {
  webhookEnabled: false,
  webhookURL: "",
  upstreamFailureThreshold: 3,
  successRateThreshold: 90,
  p95LatencyMsThreshold: 30000,
};

const DEFAULT_SECURITY = {
  ipAllowlist: [],
  totpEnabled: false,
  failedLoginLockoutEnabled: true,
};

export const DEFAULT_MODELS = [{
  id: DEFAULT_IMAGE_MODEL,
  name: "GPT Image 2",
  enabled: true,
  capabilities: ["generate", "edit"],
  sizes: ["1024x1024", "1536x1024", "1024x1536"],
  qualities: ["high", "medium", "low", "auto"],
  defaultOutputFormat: DEFAULT_OUTPUT_FORMAT,
  recommendedUse: "高质量通用生图、海报、产品图和素材生成",
  upstreamIds: [DEFAULT_UPSTREAM_ID],
}];

export const DEFAULT_QUALITY_PRESETS = [{
  id: "high-quality-final",
  name: "高质量最终稿",
  quality: "high",
  size: DEFAULT_SIZE,
  outputFormat: DEFAULT_OUTPUT_FORMAT,
  promptEnhance: false,
  template: "主体清晰，构图完整，细节丰富，光线自然，避免低清晰度、畸形结构和杂乱背景。",
  useCase: "最终交付图、封面、海报和高质量素材",
}, {
  id: "realistic-photo",
  name: "写实摄影",
  quality: "high",
  size: "1536x1024",
  outputFormat: DEFAULT_OUTPUT_FORMAT,
  promptEnhance: false,
  template: "真实摄影质感，自然光线，准确材质，浅景深，主体边缘清晰。",
  useCase: "写实照片、人物、场景和产品摄影",
}, {
  id: "product-shot",
  name: "电商产品图",
  quality: "high",
  size: "1024x1024",
  outputFormat: DEFAULT_OUTPUT_FORMAT,
  promptEnhance: false,
  template: "干净背景，产品居中，轮廓清晰，商业摄影灯光，保留真实材质。",
  useCase: "商品主图、详情页素材和营销图",
}, {
  id: "poster-key-visual",
  name: "海报 KV",
  quality: "high",
  size: "1024x1536",
  outputFormat: DEFAULT_OUTPUT_FORMAT,
  promptEnhance: false,
  template: "视觉焦点明确，层次丰富，留出标题和文案区域，适合海报主视觉。",
  useCase: "活动海报、品牌 KV、社媒封面",
}, {
  id: "app-icon",
  name: "App 图标",
  quality: "high",
  size: "1024x1024",
  outputFormat: "png",
  promptEnhance: false,
  template: "图标化构图，简单识别度高，干净背景，适合小尺寸显示。",
  useCase: "应用图标、工具图标和启动图",
}, {
  id: "character-design",
  name: "角色设定",
  quality: "high",
  size: "1024x1536",
  outputFormat: DEFAULT_OUTPUT_FORMAT,
  promptEnhance: false,
  template: "角色全身或半身，服装结构明确，表情自然，设定细节清楚。",
  useCase: "角色概念、立绘和形象设定",
}, {
  id: "social-media",
  name: "社媒配图",
  quality: "high",
  size: "1024x1024",
  outputFormat: DEFAULT_OUTPUT_FORMAT,
  promptEnhance: false,
  template: "信息重点突出，构图适合社交媒体裁剪，色彩清晰不过度拥挤。",
  useCase: "朋友圈、小红书、公众号和短视频封面",
}, {
  id: "ui-screenshot",
  name: "UI 截图风格",
  quality: "high",
  size: "1536x1024",
  outputFormat: DEFAULT_OUTPUT_FORMAT,
  promptEnhance: false,
  template: "现代软件界面截图风格，信息层级清晰，避免无意义装饰。",
  useCase: "产品界面概念图、后台面板和应用展示",
}, {
  id: "transparent-asset",
  name: "透明背景素材",
  quality: "high",
  size: "1024x1024",
  outputFormat: "png",
  promptEnhance: false,
  template: "单一主体，边缘干净，透明背景，适合后期叠加使用。",
  useCase: "贴纸、素材、装饰物和剪贴图",
}, {
  id: "chinese-poster-layout",
  name: "中文海报排版",
  quality: "high",
  size: "1024x1536",
  outputFormat: DEFAULT_OUTPUT_FORMAT,
  promptEnhance: false,
  template: "中文海报版式，标题区域明确，层次清晰，避免生成错误小字。",
  useCase: "中文营销海报和活动宣传图",
}, {
  id: "fast-draft",
  name: "快速草图",
  quality: "medium",
  size: "1024x1024",
  outputFormat: DEFAULT_OUTPUT_FORMAT,
  promptEnhance: false,
  template: "快速探索构图和方向，重点表达主体和风格，不追求最终细节。",
  useCase: "草图、方案探索和低成本预览",
}];

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

function normalizeStringArray(values, fallback = []) {
  const list = Array.isArray(values) ? values : fallback;
  return Array.from(new Set(
    list
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  ));
}

function normalizeAlerts(raw = {}) {
  return {
    ...DEFAULT_ALERTS,
    ...raw,
    webhookEnabled: raw.webhookEnabled === true,
    webhookURL: String(raw.webhookURL || "").trim(),
    upstreamFailureThreshold: positiveInteger(
      raw.upstreamFailureThreshold,
      DEFAULT_ALERTS.upstreamFailureThreshold,
      1,
      100,
    ),
    successRateThreshold: positiveInteger(
      raw.successRateThreshold,
      DEFAULT_ALERTS.successRateThreshold,
      1,
      100,
    ),
    p95LatencyMsThreshold: positiveInteger(
      raw.p95LatencyMsThreshold,
      DEFAULT_ALERTS.p95LatencyMsThreshold,
      100,
      3_600_000,
    ),
  };
}

function normalizeSecurity(raw = {}) {
  return {
    ...DEFAULT_SECURITY,
    ...raw,
    ipAllowlist: normalizeStringArray(raw.ipAllowlist, DEFAULT_SECURITY.ipAllowlist),
    totpEnabled: raw.totpEnabled === true,
    failedLoginLockoutEnabled: raw.failedLoginLockoutEnabled !== false,
  };
}

function normalizeModel(raw = {}, index = 0, previous = {}) {
  const fallback = DEFAULT_MODELS[index] || DEFAULT_MODELS[0];
  const id = normalizeId(raw.id || previous.id, fallback?.id || `model-${index + 1}`);
  return {
    id,
    name: String(raw.name || previous.name || fallback?.name || id).trim(),
    enabled: raw.enabled !== false,
    capabilities: normalizeStringArray(raw.capabilities, previous.capabilities || fallback?.capabilities || ["generate"]),
    sizes: normalizeStringArray(raw.sizes, previous.sizes || fallback?.sizes || [DEFAULT_SIZE]),
    qualities: normalizeStringArray(raw.qualities, previous.qualities || fallback?.qualities || ["high", "medium", "low", "auto"]),
    defaultOutputFormat: String(raw.defaultOutputFormat || previous.defaultOutputFormat || fallback?.defaultOutputFormat || DEFAULT_OUTPUT_FORMAT).trim(),
    recommendedUse: String(raw.recommendedUse || previous.recommendedUse || fallback?.recommendedUse || "").trim(),
    upstreamIds: uniqueIds(raw.upstreamIds, previous.upstreamIds || fallback?.upstreamIds || [DEFAULT_UPSTREAM_ID]),
  };
}

function normalizeQualityPreset(raw = {}, index = 0, previous = {}) {
  const fallback = DEFAULT_QUALITY_PRESETS[index] || DEFAULT_QUALITY_PRESETS[0];
  const id = normalizeId(raw.id || previous.id, fallback?.id || `preset-${index + 1}`);
  return {
    id,
    name: String(raw.name || previous.name || fallback?.name || id).trim(),
    quality: String(raw.quality || previous.quality || fallback?.quality || "high").trim(),
    size: String(raw.size || previous.size || fallback?.size || DEFAULT_SIZE).trim(),
    outputFormat: String(raw.outputFormat || previous.outputFormat || fallback?.outputFormat || DEFAULT_OUTPUT_FORMAT).trim(),
    promptEnhance: raw.promptEnhance === true,
    template: String(raw.template || previous.template || fallback?.template || "").trim(),
    useCase: String(raw.useCase || previous.useCase || fallback?.useCase || "").trim(),
  };
}

function normalizeQualityCase(raw = {}, index = 0, previous = {}) {
  const label = raw.label === "excellent" ? "excellent" : "poor";
  const recordId = String(raw.recordId || previous.recordId || "").trim();
  const fallbackId = recordId ? `case-${recordId}-${label}` : `quality-case-${index + 1}`;
  return {
    id: normalizeId(raw.id || previous.id, fallbackId),
    recordId,
    label,
    note: String(raw.note ?? previous.note ?? "").trim(),
    createdAt: String(raw.createdAt || previous.createdAt || "").trim(),
    username: String(raw.username || previous.username || "admin").trim(),
    endpoint: String(raw.endpoint || previous.endpoint || "").trim(),
    interfaceId: String(raw.interfaceId || previous.interfaceId || "").trim(),
    upstreamId: String(raw.upstreamId || previous.upstreamId || "").trim(),
    model: String(raw.model || previous.model || "").trim(),
    durationMs: positiveInteger(raw.durationMs ?? previous.durationMs, 0, 0, 3_600_000),
    status: String(raw.status ?? previous.status ?? "").trim(),
    errorSummary: String(raw.errorSummary || previous.errorSummary || "").trim(),
  };
}

function normalizeAcknowledgedAlert(raw = {}, index = 0, previous = {}) {
  return {
    id: normalizeId(raw.id || previous.id, `alert-${index + 1}`),
    acknowledgedAt: String(raw.acknowledgedAt || previous.acknowledgedAt || "").trim(),
    username: String(raw.username || previous.username || "admin").trim(),
  };
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
    defaultQuality: values.defaultQuality || DEFAULT_CONFIG.defaultQuality,
    defaultOutputFormat: values.defaultOutputFormat,
    qualityPresetId: values.qualityPresetId || "high-quality-final",
    requestTimeoutSeconds: values.requestTimeoutSeconds,
    maxConcurrentRequests: values.maxConcurrentRequests,
    rateLimitPerMinute: values.rateLimitPerMinute,
    lastUsedAt: values.lastUsedAt || "",
    enabled: true,
  };
}

function legacyUpstreamFrom(values) {
  return {
    id: DEFAULT_UPSTREAM_ID,
    name: "默认上游",
    baseURL: values.upstreamBaseURL,
    apiKey: values.upstreamApiKey,
    priority: 100,
    weight: 1,
    healthCheckEnabled: true,
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
    defaultQuality: String(raw.defaultQuality || previous.defaultQuality || DEFAULT_CONFIG.defaultQuality).trim() || DEFAULT_CONFIG.defaultQuality,
    defaultOutputFormat: String(raw.defaultOutputFormat || previous.defaultOutputFormat || DEFAULT_OUTPUT_FORMAT).trim() || DEFAULT_OUTPUT_FORMAT,
    qualityPresetId: normalizeId(raw.qualityPresetId || previous.qualityPresetId, "high-quality-final"),
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
    lastUsedAt: String(raw.lastUsedAt || previous.lastUsedAt || "").trim(),
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
    priority: positiveInteger(raw.priority ?? previous.priority, 100, 1, 1000),
    weight: positiveInteger(raw.weight ?? previous.weight, 1, 1, 100),
    healthCheckEnabled: raw.healthCheckEnabled !== false,
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
  const rawModels = Array.isArray(input.models)
    ? input.models
    : (Array.isArray(previous.models) && previous.models.length ? previous.models : DEFAULT_MODELS);
  const rawQualityPresets = Array.isArray(input.qualityPresets)
    ? input.qualityPresets
    : (Array.isArray(previous.qualityPresets) && previous.qualityPresets.length ? previous.qualityPresets : DEFAULT_QUALITY_PRESETS);
  const models = normalizeCollection(rawModels, previous.models, normalizeModel);
  if (!models.length) models.push(...DEFAULT_MODELS.map((model, index) => normalizeModel(model, index)));
  const qualityPresets = normalizeCollection(rawQualityPresets, previous.qualityPresets, normalizeQualityPreset);
  if (!qualityPresets.length) {
    qualityPresets.push(...DEFAULT_QUALITY_PRESETS.map((preset, index) => normalizeQualityPreset(preset, index)));
  }
  const qualityCases = normalizeCollection(
    Array.isArray(input.qualityCases) ? input.qualityCases : (Array.isArray(previous.qualityCases) ? previous.qualityCases : []),
    previous.qualityCases,
    normalizeQualityCase,
  );
  const acknowledgedAlerts = normalizeCollection(
    Array.isArray(input.acknowledgedAlerts) ? input.acknowledgedAlerts : (Array.isArray(previous.acknowledgedAlerts) ? previous.acknowledgedAlerts : []),
    previous.acknowledgedAlerts,
    normalizeAcknowledgedAlert,
  );
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
    models,
    qualityPresets,
    qualityCases,
    acknowledgedAlerts,
    alerts: normalizeAlerts(merged.alerts),
    security: normalizeSecurity(merged.security),
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
      qualityPresetId: item.qualityPresetId,
      requestTimeoutSeconds: item.requestTimeoutSeconds,
      maxConcurrentRequests: item.maxConcurrentRequests,
      rateLimitPerMinute: item.rateLimitPerMinute,
      lastUsedAt: item.lastUsedAt,
    })),
    upstreams: normalized.upstreams.map((item) => ({
      id: item.id,
      name: item.name,
      enabled: item.enabled,
      baseURL: item.baseURL,
      apiKeySet: !!item.apiKey,
      priority: item.priority,
      weight: item.weight,
      healthCheckEnabled: item.healthCheckEnabled,
    })),
    models: normalized.models,
    qualityPresets: normalized.qualityPresets,
    qualityCases: normalized.qualityCases,
    acknowledgedAlerts: normalized.acknowledgedAlerts,
    alerts: {
      ...normalized.alerts,
      webhookURLSet: !!normalized.alerts.webhookURL,
      webhookURL: normalized.alerts.webhookURL ? "[redacted]" : "",
    },
    security: normalized.security,
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
    models: Array.isArray(patch.models)
      ? normalizeCollection(patch.models, normalizedCurrent.models, normalizeModel)
      : normalizedCurrent.models,
    qualityPresets: Array.isArray(patch.qualityPresets)
      ? normalizeCollection(patch.qualityPresets, normalizedCurrent.qualityPresets, normalizeQualityPreset)
      : normalizedCurrent.qualityPresets,
    qualityCases: Array.isArray(patch.qualityCases)
      ? normalizeCollection(patch.qualityCases, normalizedCurrent.qualityCases, normalizeQualityCase)
      : normalizedCurrent.qualityCases,
    acknowledgedAlerts: Array.isArray(patch.acknowledgedAlerts)
      ? normalizeCollection(patch.acknowledgedAlerts, normalizedCurrent.acknowledgedAlerts, normalizeAcknowledgedAlert)
      : normalizedCurrent.acknowledgedAlerts,
    alerts: patch.alerts ? normalizeAlerts({
      ...normalizedCurrent.alerts,
      ...patch.alerts,
    }) : normalizedCurrent.alerts,
    security: patch.security ? normalizeSecurity({
      ...normalizedCurrent.security,
      ...patch.security,
    }) : normalizedCurrent.security,
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
