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
        { apiToken: "client-token" },
        { password: "password" },
        { cookie: "image_studio_session=session" },
        { "set-cookie": "image_studio_session=session" },
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
        { apiToken: "[redacted]" },
        { password: "[redacted]" },
        { cookie: "[redacted]" },
        { "set-cookie": "[redacted]" },
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

test("createJsonlLogStore clears stored records", async () => {
  const dir = await mkdtemp(join(tmpdir(), "image-studio-logs-"));
  try {
    const store = createJsonlLogStore({
      path: join(dir, "nested", "api-calls.jsonl"),
      maxRecords: 100,
    });

    await store.append({ id: "one" });
    await store.append({ id: "two" });
    await store.clear();

    assert.deepEqual(await store.readRecent(10), []);
    assert.deepEqual(await store.readAll(), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("createJsonlLogStore filters recent records by query fields", async () => {
  const dir = await mkdtemp(join(tmpdir(), "image-studio-logs-"));
  try {
    const store = createJsonlLogStore({
      path: join(dir, "nested", "api-calls.jsonl"),
      maxRecords: 100,
    });
    await store.append({
      id: "one",
      createdAt: "2026-06-19T01:00:00.000Z",
      status: 200,
      interfaceId: "codex",
      upstreamId: "primary",
      model: "gpt-image-2",
      durationMs: 1200,
    });
    await store.append({
      id: "two",
      createdAt: "2026-06-19T02:00:00.000Z",
      status: 500,
      interfaceId: "skill",
      upstreamId: "backup",
      model: "gpt-image-2",
      durationMs: 5200,
    });

    assert.deepEqual((await store.readRecent(50, {
      interfaceId: "codex",
      status: "success",
      model: "gpt-image-2",
      from: "2026-06-19T00:00:00.000Z",
      to: "2026-06-19T01:30:00.000Z",
      maxDurationMs: 2000,
    })).map((record) => record.id), ["one"]);

    assert.deepEqual((await store.readRecent(50, {
      upstreamId: "backup",
      status: "failed",
      minDurationMs: 5000,
    })).map((record) => record.id), ["two"]);

    assert.deepEqual((await store.readRecent(50, {
      statusMin: 500,
      statusMax: 599,
    })).map((record) => record.id), ["two"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
