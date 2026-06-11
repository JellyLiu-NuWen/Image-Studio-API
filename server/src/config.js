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
};

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

export function configFromEnv(env = process.env) {
  return normalizeConfig({
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
  return {
    upstreamBaseURL: normalizeBaseURL(merged.upstreamBaseURL),
    upstreamApiKey: String(merged.upstreamApiKey || "").trim(),
    imageApiToken: String(merged.imageApiToken || "").trim(),
    defaultImageModel: String(merged.defaultImageModel || DEFAULT_IMAGE_MODEL).trim() || DEFAULT_IMAGE_MODEL,
    defaultTextModel: String(merged.defaultTextModel || DEFAULT_TEXT_MODEL).trim() || DEFAULT_TEXT_MODEL,
    defaultSize: String(merged.defaultSize || DEFAULT_SIZE).trim() || DEFAULT_SIZE,
    defaultQuality: String(merged.defaultQuality || DEFAULT_QUALITY).trim() || DEFAULT_QUALITY,
    defaultOutputFormat: String(merged.defaultOutputFormat || DEFAULT_OUTPUT_FORMAT).trim() || DEFAULT_OUTPUT_FORMAT,
    requestTimeoutSeconds: positiveInteger(merged.requestTimeoutSeconds, DEFAULT_CONFIG.requestTimeoutSeconds, 10, 900),
    maxConcurrentRequests: positiveInteger(merged.maxConcurrentRequests, DEFAULT_CONFIG.maxConcurrentRequests, 1, 10),
    rateLimitPerMinute: positiveInteger(merged.rateLimitPerMinute, DEFAULT_CONFIG.rateLimitPerMinute, 1, 600),
  };
}

export function publicConfig(config) {
  const normalized = normalizeConfig(config);
  return {
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
  };
}

export function mergeConfigUpdate(current, patch) {
  const next = {
    ...current,
    upstreamBaseURL: patch.upstreamBaseURL ?? current.upstreamBaseURL,
    defaultImageModel: patch.defaultImageModel ?? current.defaultImageModel,
    defaultTextModel: patch.defaultTextModel ?? current.defaultTextModel,
    defaultSize: patch.defaultSize ?? current.defaultSize,
    defaultQuality: patch.defaultQuality ?? current.defaultQuality,
    defaultOutputFormat: patch.defaultOutputFormat ?? current.defaultOutputFormat,
    requestTimeoutSeconds: patch.requestTimeoutSeconds ?? current.requestTimeoutSeconds,
    maxConcurrentRequests: patch.maxConcurrentRequests ?? current.maxConcurrentRequests,
    rateLimitPerMinute: patch.rateLimitPerMinute ?? current.rateLimitPerMinute,
  };

  if (String(patch.upstreamApiKey || "").trim()) {
    next.upstreamApiKey = String(patch.upstreamApiKey).trim();
  }
  if (String(patch.imageApiToken || "").trim()) {
    next.imageApiToken = String(patch.imageApiToken).trim();
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
