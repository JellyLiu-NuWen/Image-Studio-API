import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createJsonlLogStore, sanitizeLogRecord } from "../src/logStore.js";

test("sanitizeLogRecord redacts secret-ish fields recursively", () => {
  const sanitized = sanitizeLogRecord({
    token: "client-token",
    nested: {
      authorization: "Bearer secret",
      keep: "visible",
      list: [
        { upstreamApiKey: "upstream-key" },
        { imageApiToken: "image-token" },
        { adminToken: "admin-token" },
        { apiKey: "api-key" },
      ],
    },
  });

  assert.deepEqual(sanitized, {
    token: "[redacted]",
    nested: {
      authorization: "[redacted]",
      keep: "visible",
      list: [
        { upstreamApiKey: "[redacted]" },
        { imageApiToken: "[redacted]" },
        { adminToken: "[redacted]" },
        { apiKey: "[redacted]" },
      ],
    },
  });
});

test("createJsonlLogStore reads recent records newest first and trims old records", async () => {
  const dir = await mkdtemp(join(tmpdir(), "image-studio-logs-"));
  try {
    const store = createJsonlLogStore({
      path: join(dir, "nested", "api-calls.jsonl"),
      maxRecords: 3,
    });

    await store.append({ id: "one" });
    await store.append({ id: "two" });
    await store.append({ id: "three" });
    await store.append({ id: "four", token: "secret" });

    assert.deepEqual(await store.readRecent(10), [
      { id: "four", token: "[redacted]" },
      { id: "three" },
      { id: "two" },
    ]);
    assert.deepEqual(await store.readRecent(2), [
      { id: "four", token: "[redacted]" },
      { id: "three" },
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("createJsonlLogStore preserves concurrent appends", async () => {
  const dir = await mkdtemp(join(tmpdir(), "image-studio-logs-"));
  try {
    const store = createJsonlLogStore({
      path: join(dir, "nested", "api-calls.jsonl"),
      maxRecords: 100,
    });

    await Promise.all(Array.from({ length: 50 }, (_value, index) => (
      store.append({ id: String(index) })
    )));

    const records = await store.readRecent(100);
    assert.equal(records.length, 50);
    assert.deepEqual(
      records.map((record) => record.id).sort((left, right) => Number(left) - Number(right)),
      Array.from({ length: 50 }, (_value, index) => String(index)),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
