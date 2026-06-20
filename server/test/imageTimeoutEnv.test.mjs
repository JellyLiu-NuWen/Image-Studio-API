import test from "node:test";
import assert from "node:assert/strict";
import { createSelfHostedApp } from "../src/app.js";

function memoryStore(initial = {}) {
  let config = { ...initial };
  return {
    async load() {
      return { ...config };
    },
    async save(next) {
      config = { ...next };
      return { ...config };
    },
  };
}

test("image work timeout ignores low legacy environment overrides", async () => {
  const previousImageTimeout = process.env.IMAGE_STUDIO_IMAGE_TIMEOUT_SECONDS;
  const previousStreamTimeout = process.env.IMAGE_STUDIO_STREAM_TIMEOUT_SECONDS;
  const originalTimeout = AbortSignal.timeout;
  let capturedTimeoutMs = 0;
  process.env.IMAGE_STUDIO_IMAGE_TIMEOUT_SECONDS = "60";
  process.env.IMAGE_STUDIO_STREAM_TIMEOUT_SECONDS = "60";
  AbortSignal.timeout = (ms) => {
    capturedTimeoutMs = ms;
    return new AbortController().signal;
  };
  try {
    const app = createSelfHostedApp({
      store: memoryStore({
        imageApiToken: "client-token",
        upstreamBaseURL: "https://upstream.example/v1",
        upstreamApiKey: "upstream-key",
        requestTimeoutSeconds: 60,
      }),
      adminUsername: "admin",
      adminPassword: "admin-pass",
      fetchImpl: async () => new Response(JSON.stringify({ data: [{ b64_json: "slow-json" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    });

    const response = await app.handle(new Request("http://localhost/v1/images/generations", {
      method: "POST",
      headers: {
        authorization: "Bearer client-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ prompt: "slow image", stream: true }),
    }));

    assert.equal(response.status, 200);
    await response.text();
    assert.equal(capturedTimeoutMs, 300_000);
  } finally {
    AbortSignal.timeout = originalTimeout;
    if (previousImageTimeout === undefined) delete process.env.IMAGE_STUDIO_IMAGE_TIMEOUT_SECONDS;
    else process.env.IMAGE_STUDIO_IMAGE_TIMEOUT_SECONDS = previousImageTimeout;
    if (previousStreamTimeout === undefined) delete process.env.IMAGE_STUDIO_STREAM_TIMEOUT_SECONDS;
    else process.env.IMAGE_STUDIO_STREAM_TIMEOUT_SECONDS = previousStreamTimeout;
  }
});
