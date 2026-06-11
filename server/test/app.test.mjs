import test from "node:test";
import assert from "node:assert/strict";
import { createSelfHostedApp } from "../src/app.js";
import { parseDotEnv } from "../src/config.js";

function jsonRequest(path, body, headers = {}) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

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
    current() {
      return { ...config };
    },
  };
}

test("health check is public", async () => {
  const app = createSelfHostedApp({
    store: memoryStore(),
    adminToken: "admin-token",
    fetchImpl: async () => {
      throw new Error("health check must not call upstream");
    },
  });

  const response = await app.handle(new Request("http://localhost/healthz"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "image-studio-self-hosted-api",
  });
});

test("image generation rejects missing client token", async () => {
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example",
      upstreamApiKey: "upstream-key",
    }),
    adminToken: "admin-token",
    fetchImpl: async () => {
      throw new Error("unauthorized requests must not call upstream");
    },
  });

  const response = await app.handle(jsonRequest("/v1/images/generations", {
    prompt: "a red cat",
  }));

  assert.equal(response.status, 401);
  assert.match((await response.json()).error.message, /Unauthorized/);
});

test("image generation forwards with the server-side upstream key and defaults", async () => {
  let captured = null;
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example/v1",
      upstreamApiKey: "upstream-key",
      defaultImageModel: "gpt-image-2",
      defaultSize: "1024x1024",
      defaultQuality: "auto",
      defaultOutputFormat: "png",
    }),
    adminToken: "admin-token",
    fetchImpl: async (url, init) => {
      captured = {
        url: String(url),
        method: init.method,
        authorization: init.headers.get("authorization"),
        contentType: init.headers.get("content-type"),
        body: JSON.parse(await new Response(init.body).text()),
      };
      return new Response(JSON.stringify({ data: [{ b64_json: "abc" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const response = await app.handle(jsonRequest("/v1/images/generations", {
    prompt: "a red cat",
  }, {
    authorization: "Bearer client-token",
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [{ b64_json: "abc" }] });
  assert.equal(captured.url, "https://upstream.example/v1/images/generations");
  assert.equal(captured.method, "POST");
  assert.equal(captured.authorization, "Bearer upstream-key");
  assert.equal(captured.contentType, "application/json");
  assert.equal(captured.body.model, "gpt-image-2");
  assert.equal(captured.body.prompt, "a red cat");
  assert.equal(captured.body.size, "1024x1024");
  assert.equal(captured.body.quality, "auto");
  assert.equal(captured.body.output_format, "png");
});

test("admin config updates non-secret values and keeps blank secrets unchanged", async () => {
  const store = memoryStore({
    imageApiToken: "old-client-token",
    upstreamBaseURL: "https://old.example",
    upstreamApiKey: "old-upstream-key",
    defaultImageModel: "old-image-model",
  });
  const app = createSelfHostedApp({
    store,
    adminToken: "admin-token",
    fetchImpl: async () => {
      throw new Error("config update must not call upstream");
    },
  });

  const response = await app.handle(jsonRequest("/api/config", {
    upstreamBaseURL: "https://new.example/v1",
    upstreamApiKey: "",
    imageApiToken: "",
    defaultImageModel: "gpt-image-2",
    defaultSize: "1536x1024",
    requestTimeoutSeconds: 180,
  }, {
    authorization: "Bearer admin-token",
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    config: {
      upstreamBaseURL: "https://new.example",
      upstreamApiKeySet: true,
      imageApiTokenSet: true,
      defaultImageModel: "gpt-image-2",
      defaultTextModel: "gpt-5.5",
      defaultSize: "1536x1024",
      defaultQuality: "auto",
      defaultOutputFormat: "png",
      requestTimeoutSeconds: 180,
      maxConcurrentRequests: 1,
      rateLimitPerMinute: 10,
    },
  });
  assert.equal(store.current().upstreamApiKey, "old-upstream-key");
  assert.equal(store.current().imageApiToken, "old-client-token");
});

test("admin config rejects the client token", async () => {
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
    }),
    adminToken: "admin-token",
    fetchImpl: async () => {
      throw new Error("unauthorized admin requests must not call upstream");
    },
  });

  const response = await app.handle(jsonRequest("/api/config", {
    upstreamBaseURL: "https://new.example",
  }, {
    authorization: "Bearer client-token",
  }));

  assert.equal(response.status, 401);
  assert.match((await response.json()).error.message, /Admin authorization required/);
});

test("image generation applies the configured per-minute rate limit", async () => {
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example",
      upstreamApiKey: "upstream-key",
      rateLimitPerMinute: 1,
    }),
    adminToken: "admin-token",
    fetchImpl: async () => new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });

  const first = await app.handle(jsonRequest("/v1/images/generations", {
    prompt: "first",
  }, {
    authorization: "Bearer client-token",
  }));
  const second = await app.handle(jsonRequest("/v1/images/generations", {
    prompt: "second",
  }, {
    authorization: "Bearer client-token",
  }));

  assert.equal(first.status, 200);
  assert.equal(second.status, 429);
  assert.match((await second.json()).error.message, /Rate limit exceeded/);
});

test("image generation applies the configured concurrency limit", async () => {
  let releaseFetch = null;
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example",
      upstreamApiKey: "upstream-key",
      maxConcurrentRequests: 1,
      rateLimitPerMinute: 10,
    }),
    adminToken: "admin-token",
    fetchImpl: async () => {
      await new Promise((resolve) => {
        releaseFetch = resolve;
      });
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const firstPromise = app.handle(jsonRequest("/v1/images/generations", {
    prompt: "first",
  }, {
    authorization: "Bearer client-token",
  }));
  await new Promise((resolve) => setTimeout(resolve, 0));

  const second = await app.handle(jsonRequest("/v1/images/generations", {
    prompt: "second",
  }, {
    authorization: "Bearer client-token",
  }));
  releaseFetch();
  const first = await firstPromise;

  assert.equal(first.status, 200);
  assert.equal(second.status, 429);
  assert.match((await second.json()).error.message, /Too many active requests/);
});

test("image generation passes a timeout signal to upstream fetch", async () => {
  let capturedSignal = null;
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example",
      upstreamApiKey: "upstream-key",
      requestTimeoutSeconds: 30,
    }),
    adminToken: "admin-token",
    fetchImpl: async (_url, init) => {
      capturedSignal = init.signal;
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const response = await app.handle(jsonRequest("/v1/images/generations", {
    prompt: "timeout signal",
  }, {
    authorization: "Bearer client-token",
  }));

  assert.equal(response.status, 200);
  assert.ok(capturedSignal instanceof AbortSignal);
  assert.equal(capturedSignal.aborted, false);
});

test("dotenv parser supports comments, quotes, and plain values", () => {
  assert.deepEqual(parseDotEnv(`
# local config
ADMIN_TOKEN="admin token"
IMAGE_API_TOKEN='client-token'
PORT=8787
EMPTY=
  `), {
    ADMIN_TOKEN: "admin token",
    IMAGE_API_TOKEN: "client-token",
    PORT: "8787",
    EMPTY: "",
  });
});
