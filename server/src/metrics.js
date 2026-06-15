function percentile(values, ratio) {
  const durations = values
    .map((record) => Number(record?.durationMs))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!durations.length) return 0;
  const index = Math.ceil(ratio * durations.length) - 1;
  return durations[Math.max(0, Math.min(durations.length - 1, index))];
}

export function summarizeMetrics({
  apiCalls = [],
  generations = [],
  activeRequests = 0,
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
      p50DurationMs: percentile(apiCalls, 0.5),
      p95DurationMs: percentile(apiCalls, 0.95),
    },
    generations: {
      total: generations.length,
      success: generationSuccess,
      failed: generationFailed,
      p50DurationMs: percentile(generations, 0.5),
      p95DurationMs: percentile(generations, 0.95),
    },
  };
}
