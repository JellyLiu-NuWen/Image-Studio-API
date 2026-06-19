function percentile(values, ratio) {
  const durations = values
    .map((record) => Number(record?.durationMs))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!durations.length) return 0;
  const index = Math.ceil(ratio * durations.length) - 1;
  return durations[Math.max(0, Math.min(durations.length - 1, index))];
}

function percent(part, total) {
  const numericTotal = Number(total);
  if (!Number.isFinite(numericTotal) || numericTotal <= 0) return 0;
  return Math.round((Number(part) || 0) / numericTotal * 100);
}

function isSameUTCDate(value, now) {
  const date = new Date(value || 0);
  const current = new Date(now);
  if (Number.isNaN(date.getTime()) || Number.isNaN(current.getTime())) return false;
  return date.getUTCFullYear() === current.getUTCFullYear()
    && date.getUTCMonth() === current.getUTCMonth()
    && date.getUTCDate() === current.getUTCDate();
}

function summarizeUpstreams(generations) {
  const groups = {};
  for (const record of generations) {
    const upstreamId = String(record?.upstreamId || "").trim();
    if (!upstreamId) continue;
    if (!groups[upstreamId]) {
      groups[upstreamId] = {
        records: [],
        total: 0,
        success: 0,
        failed: 0,
        lastFailure: "",
      };
    }
    const group = groups[upstreamId];
    group.records.push(record);
    group.total += 1;
    if (record?.status === "success") {
      group.success += 1;
    } else {
      group.failed += 1;
      if (!group.lastFailure || String(record?.createdAt || "") > group.lastFailure) {
        group.lastFailure = String(record?.createdAt || "");
      }
    }
  }
  return Object.fromEntries(Object.entries(groups).map(([id, group]) => [id, {
    total: group.total,
    success: group.success,
    failed: group.failed,
    successRate: percent(group.success, group.total),
    p95DurationMs: percentile(group.records, 0.95),
    lastFailure: group.lastFailure,
  }]));
}

export function summarizeMetrics({
  apiCalls = [],
  generations = [],
  activeRequests = 0,
  now = () => Date.now(),
} = {}) {
  const apiTotal = apiCalls.length;
  const apiSuccess = apiCalls.filter((record) => {
    const status = Number(record?.status);
    return status >= 200 && status <= 399;
  }).length;
  const apiError = apiCalls.filter((record) => Number(record?.status) >= 400).length;
  const generationSuccess = generations.filter((record) => record?.status === "success").length;
  const generationFailed = generations.filter((record) => record?.status === "failed").length;

  return {
    activeRequests,
    api: {
      total: apiTotal,
      success: apiSuccess,
      error: apiError,
      successRate: percent(apiSuccess, apiTotal),
      errorRate: percent(apiError, apiTotal),
      p50DurationMs: percentile(apiCalls, 0.5),
      p95DurationMs: percentile(apiCalls, 0.95),
      p99DurationMs: percentile(apiCalls, 0.99),
    },
    generations: {
      total: generations.length,
      success: generationSuccess,
      failed: generationFailed,
      successRate: percent(generationSuccess, generations.length),
      errorRate: percent(generationFailed, generations.length),
      p50DurationMs: percentile(generations, 0.5),
      p95DurationMs: percentile(generations, 0.95),
      p99DurationMs: percentile(generations, 0.99),
      today: generations.filter((record) => isSameUTCDate(record?.createdAt, now())).length,
    },
    upstreams: summarizeUpstreams(generations),
  };
}
