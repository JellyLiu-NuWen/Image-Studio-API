import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const SECRET_FIELDS = new Set([
  "token",
  "authorization",
  "upstreamApiKey",
  "imageApiToken",
  "adminToken",
  "apiKey",
]);

function clampLimit(limit) {
  const numeric = Number(limit);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(1, Math.min(500, Math.floor(numeric)));
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
    async readRecent(limit = 50) {
      const records = await readAll();
      return records.slice(-clampLimit(limit)).reverse();
    },
  };
}

export function createMemoryLogStore() {
  const records = [];
  return {
    async append(record) {
      records.push(sanitizeLogRecord(record));
    },
    async readRecent(limit = 50) {
      return records.slice(-clampLimit(limit)).reverse();
    },
  };
}
