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
    apiCalls: {
      total: 4,
      success: 2,
      error: 2,
      durationMs: {
        p50: 200,
        p95: 300,
      },
    },
    generations: {
      total: 4,
      success: 1,
      failed: 3,
      durationMs: {
        p50: 500,
        p95: 600,
      },
    },
    activeRequests: 2,
  });
});
