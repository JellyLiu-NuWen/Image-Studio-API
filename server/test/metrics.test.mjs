import test from "node:test";
import assert from "node:assert/strict";
import { summarizeMetrics } from "../src/metrics.js";

test("summarizeMetrics counts statuses and duration percentiles", () => {
  const metrics = summarizeMetrics({
    apiCalls: [
      { status: 200, durationMs: 100 },
      { status: 302, durationMs: 200 },
      { status: 404, durationMs: 300 },
      { status: 500, durationMs: Number.NaN },
    ],
    generations: [
      { status: "success", durationMs: 400 },
      { status: "failed", durationMs: 500 },
      { status: "failed", durationMs: 600 },
      { status: "failed", durationMs: Infinity },
    ],
    activeRequests: 2,
  });

  assert.deepEqual(metrics, {
    activeRequests: 2,
    api: {
      total: 4,
      success: 2,
      error: 2,
      successRate: 50,
      errorRate: 50,
      p50DurationMs: 200,
      p95DurationMs: 300,
      p99DurationMs: 300,
    },
    generations: {
      total: 4,
      success: 1,
      failed: 3,
      successRate: 25,
      errorRate: 75,
      p50DurationMs: 500,
      p95DurationMs: 600,
      p99DurationMs: 600,
      today: 0,
    },
    upstreams: {},
  });
});

test("summarizeMetrics groups generation records by upstream and counts today's work", () => {
  const metrics = summarizeMetrics({
    generations: [
      {
        status: "success",
        upstreamId: "primary",
        durationMs: 1000,
        createdAt: "2026-06-19T01:00:00.000Z",
      },
      {
        status: "failed",
        upstreamId: "primary",
        durationMs: 3000,
        createdAt: "2026-06-19T02:00:00.000Z",
      },
      {
        status: "success",
        upstreamId: "backup",
        durationMs: 2000,
        createdAt: "2026-06-18T02:00:00.000Z",
      },
    ],
    now: () => new Date("2026-06-19T08:00:00.000Z").getTime(),
  });

  assert.equal(metrics.generations.today, 2);
  assert.deepEqual(metrics.upstreams, {
    primary: {
      total: 2,
      success: 1,
      failed: 1,
      successRate: 50,
      p95DurationMs: 3000,
      lastFailure: "2026-06-19T02:00:00.000Z",
    },
    backup: {
      total: 1,
      success: 1,
      failed: 0,
      successRate: 100,
      p95DurationMs: 2000,
      lastFailure: "",
    },
  });
});
