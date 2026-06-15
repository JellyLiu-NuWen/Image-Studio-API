import test from "node:test";
import assert from "node:assert/strict";
import { createSelfHostedApp } from "../src/app.js";
import { createMemoryLogStore } from "../src/logStore.js";
import { parseDotEnv } from "../src/config.js";

const ADMIN_OPTIONS = {
  adminUsername: "admin",
  adminPassword: "admin-pass",
};

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

async function loginHeaders(app, username = "admin", password = "admin-pass") {
  const response = await app.handle(jsonRequest("/api/login", { username, password }));
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie") || "";
  assert.match(cookie, /image_studio_session=/);
  return { cookie: cookie.split(";")[0] };
}

test("health check is public", async () => {
  const app = createSelfHostedApp({
    store: memoryStore(),
    ...ADMIN_OPTIONS,
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
    ...ADMIN_OPTIONS,
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
    ...ADMIN_OPTIONS,
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

test("image generation falls back across multiple upstreams by priority", async () => {
  const calls = [];
  const app = createSelfHostedApp({
    store: memoryStore({
      interfaces: [{
        id: "codex",
        name: "Codex",
        apiToken: "client-token",
        upstreamIds: ["primary", "backup"],
        defaultImageModel: "gpt-image-2",
      }],
      upstreams: [{
        id: "primary",
        name: "Primary",
        baseURL: "https://primary.example/v1",
        apiKey: "primary-key",
        enabled: true,
      }, {
        id: "backup",
        name: "Backup",
        baseURL: "https://backup.example/v1",
        apiKey: "backup-key",
        enabled: true,
      }],
    }),
    ...ADMIN_OPTIONS,
    fetchImpl: async (url, init) => {
      calls.push({
        url: String(url),
        authorization: init.headers.get("authorization"),
      });
      if (calls.length === 1) {
        return new Response("gateway timeout", { status: 504, headers: { "content-type": "text/plain" } });
      }
      return new Response(JSON.stringify({ data: [{ b64_json: "fallback" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const response = await app.handle(jsonRequest("/v1/images/generations", {
    prompt: "fallback please",
  }, {
    authorization: "Bearer client-token",
  }));

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://primary.example/v1/images/generations");
  assert.equal(calls[1].url, "https://backup.example/v1/images/generations");
  assert.equal(calls[0].authorization, "Bearer primary-key");
  assert.equal(calls[1].authorization, "Bearer backup-key");
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
    ...ADMIN_OPTIONS,
    fetchImpl: async () => {
      throw new Error("config update must not call upstream");
    },
  });
  const headers = await loginHeaders(app);

  const response = await app.handle(jsonRequest("/api/config", {
    upstreamBaseURL: "https://new.example/v1",
    upstreamApiKey: "",
    imageApiToken: "",
    defaultImageModel: "gpt-image-2",
    defaultSize: "1536x1024",
    requestTimeoutSeconds: 180,
  }, headers));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    config: {
      adminUsername: "admin",
      adminPasswordSet: true,
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
      interfaces: [{
        id: "default",
        name: "默认接口",
        enabled: true,
        apiTokenSet: true,
        upstreamIds: ["default"],
        defaultImageModel: "gpt-image-2",
        defaultTextModel: "gpt-5.5",
        defaultSize: "1536x1024",
        defaultQuality: "auto",
        defaultOutputFormat: "png",
        requestTimeoutSeconds: 180,
        maxConcurrentRequests: 1,
        rateLimitPerMinute: 10,
      }],
      upstreams: [{
        id: "default",
        name: "默认上游",
        enabled: true,
        baseURL: "https://new.example",
        apiKeySet: true,
      }],
    },
  });
  assert.equal(store.current().upstreamApiKey, "old-upstream-key");
  assert.equal(store.current().imageApiToken, "old-client-token");
});

test("admin config rejects bearer tokens because dashboard uses login sessions", async () => {
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
    }),
    ...ADMIN_OPTIONS,
    fetchImpl: async () => {
      throw new Error("unauthorized admin requests must not call upstream");
    },
  });

  const response = await app.handle(jsonRequest("/api/config", {
    upstreamBaseURL: "https://new.example",
  }, {
    authorization: "Bearer admin-token",
  }));

  assert.equal(response.status, 401);
  assert.match((await response.json()).error.message, /请先登录/);
});

test("admin can read logs and metrics while client or missing token is rejected", async () => {
  const apiLogStore = createMemoryLogStore();
  const generationLogStore = createMemoryLogStore();
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example",
      upstreamApiKey: "upstream-key",
      rateLimitPerMinute: 10,
    }),
    ...ADMIN_OPTIONS,
    apiLogStore,
    generationLogStore,
    fetchImpl: async () => new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });

  const generation = await app.handle(jsonRequest("/v1/images/generations", {
    prompt: "logged",
  }, {
    authorization: "Bearer client-token",
  }));
  assert.equal(generation.status, 200);

  const noToken = await app.handle(new Request("http://localhost/api/logs"));
  assert.equal(noToken.status, 401);

  const clientToken = await app.handle(new Request("http://localhost/api/logs", {
    headers: { authorization: "Bearer client-token" },
  }));
  assert.equal(clientToken.status, 401);

  const adminHeaders = await loginHeaders(app);
  const logs = await app.handle(new Request("http://localhost/api/logs?type=generations", {
    headers: adminHeaders,
  }));
  assert.equal(logs.status, 200);
  const logsBody = await logs.json();
  assert.equal(logsBody.records.length, 1);
  assert.equal(logsBody.records[0].status, "success");
  assert.equal(logsBody.records[0].endpoint, "/v1/images/generations");
  assert.equal(logsBody.records[0].upstreamStatus, 200);

  const metrics = await app.handle(new Request("http://localhost/api/metrics", {
    headers: adminHeaders,
  }));
  assert.equal(metrics.status, 200);
  const metricsBody = await metrics.json();
  assert.equal(metricsBody.metrics.api.total >= 4, true);
  assert.equal(metricsBody.metrics.api.success >= 2, true);
  assert.equal(metricsBody.metrics.api.error >= 2, true);
  assert.deepEqual(metricsBody.metrics.generations, {
    total: 1,
    success: 1,
    failed: 0,
    p50DurationMs: logsBody.records[0].durationMs,
    p95DurationMs: logsBody.records[0].durationMs,
  });
});

test("admin update check requires admin authorization", async () => {
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
    }),
    ...ADMIN_OPTIONS,
    updateService: {
      async checkLatest() {
        throw new Error("unauthorized update check must not call service");
      },
    },
    fetchImpl: async () => {
      throw new Error("update check must not call upstream fetch");
    },
  });

  const noToken = await app.handle(new Request("http://localhost/api/update/check"));
  assert.equal(noToken.status, 401);

  const clientToken = await app.handle(new Request("http://localhost/api/update/check", {
    headers: { authorization: "Bearer client-token" },
  }));
  assert.equal(clientToken.status, 401);
});

test("admin update check returns update service result", async () => {
  const update = {
    currentVersion: "v1.2.5",
    latestVersion: "v1.2.6",
    status: "newer",
    releaseURL: "https://github.com/owner/repo/releases/tag/v1.2.6",
  };
  const app = createSelfHostedApp({
    store: memoryStore(),
    ...ADMIN_OPTIONS,
    updateService: {
      async checkLatest() {
        return update;
      },
    },
    fetchImpl: async () => {
      throw new Error("update check must not call upstream fetch");
    },
  });

  const response = await app.handle(new Request("http://localhost/api/update/check", {
    headers: await loginHeaders(app),
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { update });
});

test("admin update check reports unconfigured without a service and rejects non-GET", async () => {
  const app = createSelfHostedApp({
    store: memoryStore(),
    ...ADMIN_OPTIONS,
    fetchImpl: async () => {
      throw new Error("update check must not call upstream fetch");
    },
  });

  const response = await app.handle(new Request("http://localhost/api/update/check", {
    headers: await loginHeaders(app),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { update: { status: "unconfigured" } });

  const post = await app.handle(jsonRequest("/api/update/check", {}, {
    ...(await loginHeaders(app)),
  }));
  assert.equal(post.status, 405);
});

test("image generation applies the configured per-minute rate limit", async () => {
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example",
      upstreamApiKey: "upstream-key",
      rateLimitPerMinute: 1,
    }),
    ...ADMIN_OPTIONS,
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
    ...ADMIN_OPTIONS,
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
    ...ADMIN_OPTIONS,
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
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin pass"
IMAGE_API_TOKEN='client-token'
PORT=8787
EMPTY=
  `), {
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "admin pass",
    IMAGE_API_TOKEN: "client-token",
    PORT: "8787",
    EMPTY: "",
  });
});

test("admin login session can update the dashboard account password", async () => {
  const store = memoryStore();
  const app = createSelfHostedApp({
    store,
    ...ADMIN_OPTIONS,
    fetchImpl: async () => {
      throw new Error("account update must not call upstream");
    },
  });
  const headers = await loginHeaders(app);

  const update = await app.handle(jsonRequest("/api/account", {
    username: "owner",
    currentPassword: "admin-pass",
    newPassword: "new-admin-pass",
  }, headers));
  assert.equal(update.status, 200);
  assert.deepEqual(await update.json(), {
    ok: true,
    account: { username: "owner" },
  });
  assert.equal(store.current().adminUsername, "owner");
  assert.match(store.current().adminPasswordHash, /^scrypt\$/);

  const oldLogin = await app.handle(jsonRequest("/api/login", {
    username: "admin",
    password: "admin-pass",
  }));
  assert.equal(oldLogin.status, 401);

  const newLogin = await app.handle(jsonRequest("/api/login", {
    username: "owner",
    password: "new-admin-pass",
  }));
  assert.equal(newLogin.status, 200);
});
