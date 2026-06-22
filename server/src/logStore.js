import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const SECRET_FIELDS = new Set([
  "token",
  "authorization",
  "upstreamApiKey",
  "imageApiToken",
  "adminToken",
  "apiKey",
  "apiToken",
  "password",
  "cookie",
  "set-cookie",
]);

function clampLimit(limit) {
  const numeric = Number(limit);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(1, Math.min(500, Math.floor(numeric)));
}

function isSuccessStatus(value) {
  const text = String(value || "");
  const numeric = Number(text);
  return text === "success" || (Number.isFinite(numeric) && numeric >= 200 && numeric <= 399);
}

function isFailedStatus(value) {
  const text = String(value || "");
  const numeric = Number(text);
  return text === "failed" || text === "error" || (Number.isFinite(numeric) && numeric >= 400);
}

function matchesFilters(record, filters = {}) {
  if (!filters || typeof filters !== "object") return true;
  if (filters.interfaceId && record?.interfaceId !== filters.interfaceId) return false;
  if (filters.upstreamId && record?.upstreamId !== filters.upstreamId) return false;
  if (filters.model && record?.model !== filters.model) return false;
  if (filters.endpoint && record?.endpoint !== filters.endpoint && record?.path !== filters.endpoint) return false;
  if (filters.requestId && record?.id !== filters.requestId) return false;
  if (filters.status) {
    if (filters.status === "success" && !isSuccessStatus(record?.status)) return false;
    if (filters.status === "failed" && !isFailedStatus(record?.status)) return false;
    if (!["success", "failed", "all"].includes(filters.status) && String(record?.status) !== String(filters.status)) return false;
  }
  const numericStatus = Number(record?.upstreamStatus ?? record?.status);
  if (filters.statusMin !== undefined && Number.isFinite(numericStatus) && numericStatus < Number(filters.statusMin)) return false;
  if (filters.statusMax !== undefined && Number.isFinite(numericStatus) && numericStatus > Number(filters.statusMax)) return false;
  const createdAt = record?.createdAt ? Date.parse(record.createdAt) : Number.NaN;
  if (filters.from && Number.isFinite(createdAt) && createdAt < Date.parse(filters.from)) return false;
  if (filters.to && Number.isFinite(createdAt) && createdAt > Date.parse(filters.to)) return false;
  const durationMs = Number(record?.durationMs);
  if (filters.minDurationMs !== undefined && Number.isFinite(durationMs) && durationMs < Number(filters.minDurationMs)) return false;
  if (filters.maxDurationMs !== undefined && Number.isFinite(durationMs) && durationMs > Number(filters.maxDurationMs)) return false;
  return true;
}

export function sanitizeLogRecord(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogRecord(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const sanitized = {};
  for (const [key, child] of Object.entries(value)) {
    sanitized[key] = SECRET_FIELDS.has(key)
      ? "[redacted]"
      : sanitizeLogRecord(child);
  }
  return sanitized;
}

export function createJsonlLogStore({ path, maxRecords = 1000 }) {
  const recordLimit = Math.max(1, Math.floor(Number(maxRecords) || 1000));
  let writeQueue = Promise.resolve();

  async function readAll() {
    try {
      const raw = await readFile(path, "utf8");
      return raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async function writeAll(records) {
    await mkdir(dirname(path), { recursive: true });
    const lines = records.map((record) => JSON.stringify(record)).join("\n");
    await writeFile(path, lines ? `${lines}\n` : "", "utf8");
  }

  return {
    async append(record) {
      const writeOperation = writeQueue.then(async () => {
        const records = await readAll();
        records.push(sanitizeLogRecord(record));
        await writeAll(records.slice(-recordLimit));
      });
      writeQueue = writeOperation.catch(() => {});
      await writeOperation;
    },
    async readRecent(limit = 50, filters = {}) {
      const records = await readAll();
      return records.filter((record) => matchesFilters(record, filters)).slice(-clampLimit(limit)).reverse();
    },
    async readAll(filters = {}) {
      const records = await readAll();
      return records.filter((record) => matchesFilters(record, filters));
    },
    async clear() {
      const writeOperation = writeQueue.then(async () => {
        await writeAll([]);
      });
      writeQueue = writeOperation.catch(() => {});
      await writeOperation;
    },
  };
}

export function createMemoryLogStore() {
  const records = [];
  return {
    async append(record) {
      records.push(sanitizeLogRecord(record));
    },
    async readRecent(limit = 50, filters = {}) {
      return records.filter((record) => matchesFilters(record, filters)).slice(-clampLimit(limit)).reverse();
    },
    async readAll(filters = {}) {
      return records.filter((record) => matchesFilters(record, filters));
    },
    async clear() {
      records.splice(0);
    },
  };
}
