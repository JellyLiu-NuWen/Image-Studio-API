import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
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

function base32Decode(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of String(value || "").replace(/=+$/g, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index >= 0) bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpCode(secret, timestamp) {
  const counter = Math.floor(timestamp / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
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

test("stream health check is public and emits an immediate heartbeat", async () => {
  const app = createSelfHostedApp({
    store: memoryStore(),
    ...ADMIN_OPTIONS,
    fetchImpl: async () => {
      throw new Error("stream health check must not call upstream");
    },
  });

  const response = await app.handle(new Request("http://localhost/healthz/stream?durationMs=1&intervalMs=1"));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  assert.equal(response.headers.get("x-accel-buffering"), "no");
  const reader = response.body.getReader();
  const firstChunk = await reader.read();
  assert.equal(new TextDecoder().decode(firstChunk.value), ": image-studio health keepalive\n\n");
  const decoder = new TextDecoder();
  let rest = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    rest += decoder.decode(chunk.value, { stream: true });
  }
  rest += decoder.decode();
  assert.match(rest, /"service":"image-studio-self-hosted-api"/);
  assert.match(rest, /data: \[DONE\]/);
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

test("image generation applies the interface quality preset without changing user intent", async () => {
  let captured = null;
  const app = createSelfHostedApp({
    store: memoryStore({
      interfaces: [{
        id: "codex",
        name: "Codex",
        apiToken: "client-token",
        upstreamIds: ["primary"],
        defaultImageModel: "gpt-image-2",
        defaultSize: "1024x1024",
        defaultQuality: "medium",
        defaultOutputFormat: "png",
        qualityPresetId: "poster",
      }],
      upstreams: [{
        id: "primary",
        name: "Primary",
        baseURL: "https://upstream.example/v1",
        apiKey: "upstream-key",
        enabled: true,
      }],
      qualityPresets: [{
        id: "poster",
        name: "Poster",
        quality: "high",
        size: "1536x1024",
        outputFormat: "webp",
        promptEnhance: false,
        template: "模板说明不应覆盖用户意图",
      }],
    }),
    ...ADMIN_OPTIONS,
    fetchImpl: async (_url, init) => {
      captured = JSON.parse(await new Response(init.body).text());
      return new Response(JSON.stringify({ data: [{ b64_json: "preset" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const response = await app.handle(jsonRequest("/v1/images/generations", {
    prompt: "画一个绿色骰子",
  }, {
    authorization: "Bearer client-token",
  }));

  assert.equal(response.status, 200);
  assert.equal(captured.prompt, "画一个绿色骰子");
  assert.equal(captured.model, "gpt-image-2");
  assert.equal(captured.size, "1536x1024");
  assert.equal(captured.quality, "high");
  assert.equal(captured.output_format, "webp");
});

test("image generation appends prompt preset templates only when enhancement is enabled", async () => {
  let captured = null;
  const app = createSelfHostedApp({
    store: memoryStore({
      interfaces: [{
        id: "codex",
        name: "Codex",
        apiToken: "client-token",
        upstreamIds: ["primary"],
        defaultImageModel: "gpt-image-2",
        qualityPresetId: "product-shot",
      }],
      upstreams: [{
        id: "primary",
        name: "Primary",
        baseURL: "https://upstream.example/v1",
        apiKey: "upstream-key",
        enabled: true,
      }],
      qualityPresets: [{
        id: "product-shot",
        name: "Product Shot",
        quality: "high",
        size: "1024x1024",
        outputFormat: "png",
        promptEnhance: true,
        template: "商业摄影灯光，边缘清晰",
      }],
    }),
    ...ADMIN_OPTIONS,
    fetchImpl: async (_url, init) => {
      captured = JSON.parse(await new Response(init.body).text());
      return new Response(JSON.stringify({ data: [{ b64_json: "enhanced" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const response = await app.handle(jsonRequest("/v1/images/generations", {
    prompt: "白底上的绿色骰子",
  }, {
    authorization: "Bearer client-token",
  }));

  assert.equal(response.status, 200);
  assert.match(captured.prompt, /^白底上的绿色骰子/);
  assert.match(captured.prompt, /商业摄影灯光，边缘清晰/);
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

test("image edits forward multipart bodies with the server-side upstream key", async () => {
  let captured = null;
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example/v1",
      upstreamApiKey: "upstream-key",
    }),
    ...ADMIN_OPTIONS,
    fetchImpl: async (url, init) => {
      captured = {
        url: String(url),
        method: init.method,
        authorization: init.headers.get("authorization"),
        contentType: init.headers.get("content-type"),
        body: await new Response(init.body).text(),
      };
      return new Response(JSON.stringify({ data: [{ b64_json: "edited" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const body = [
    "--edit-boundary",
    'Content-Disposition: form-data; name="prompt"',
    "",
    "make it cinematic",
    "--edit-boundary",
    'Content-Disposition: form-data; name="image[]"; filename="input.png"',
    "Content-Type: image/png",
    "",
    "fake-image-bytes",
    "--edit-boundary--",
    "",
  ].join("\r\n");

  const response = await app.handle(new Request("http://localhost/v1/images/edits", {
    method: "POST",
    headers: {
      authorization: "Bearer client-token",
      "content-type": "multipart/form-data; boundary=edit-boundary",
    },
    body,
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [{ b64_json: "edited" }] });
  assert.equal(captured.url, "https://upstream.example/v1/images/edits");
  assert.equal(captured.method, "POST");
  assert.equal(captured.authorization, "Bearer upstream-key");
  assert.equal(captured.contentType, "multipart/form-data; boundary=edit-boundary");
  assert.match(captured.body, /name="prompt"/);
  assert.match(captured.body, /make it cinematic/);
  assert.match(captured.body, /name="image\[\]"; filename="input.png"/);
});

test("image edits apply missing defaults from the interface quality preset", async () => {
  let captured = null;
  const app = createSelfHostedApp({
    store: memoryStore({
      interfaces: [{
        id: "codex",
        name: "Codex",
        apiToken: "client-token",
        upstreamIds: ["primary"],
        defaultImageModel: "gpt-image-2",
        qualityPresetId: "transparent-asset",
      }],
      upstreams: [{
        id: "primary",
        name: "Primary",
        baseURL: "https://upstream.example/v1",
        apiKey: "upstream-key",
        enabled: true,
      }],
      qualityPresets: [{
        id: "transparent-asset",
        name: "Transparent Asset",
        quality: "high",
        size: "1024x1024",
        outputFormat: "png",
        promptEnhance: false,
        template: "透明背景素材",
      }],
    }),
    ...ADMIN_OPTIONS,
    fetchImpl: async (_url, init) => {
      captured = await new Response(init.body).text();
      return new Response(JSON.stringify({ data: [{ b64_json: "edited" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const body = [
    "--edit-boundary",
    'Content-Disposition: form-data; name="prompt"',
    "",
    "裁成透明素材",
    "--edit-boundary",
    'Content-Disposition: form-data; name="image"; filename="input.png"',
    "Content-Type: image/png",
    "",
    "fake-image-bytes",
    "--edit-boundary--",
    "",
  ].join("\r\n");

  const response = await app.handle(new Request("http://localhost/v1/images/edits", {
    method: "POST",
    headers: {
      authorization: "Bearer client-token",
      "content-type": "multipart/form-data; boundary=edit-boundary",
    },
    body,
  }));

  assert.equal(response.status, 200);
  assert.match(captured, /name="model"\r\n\r\ngpt-image-2/);
  assert.match(captured, /name="size"\r\n\r\n1024x1024/);
  assert.match(captured, /name="quality"\r\n\r\nhigh/);
  assert.match(captured, /name="output_format"\r\n\r\npng/);
  assert.match(captured, /name="prompt"\r\n\r\n裁成透明素材/);
});

test("image edits keep explicit multipart image options over preset defaults", async () => {
  let captured = null;
  const app = createSelfHostedApp({
    store: memoryStore({
      interfaces: [{
        id: "codex",
        name: "Codex",
        apiToken: "client-token",
        upstreamIds: ["primary"],
        defaultImageModel: "gpt-image-2",
        qualityPresetId: "poster",
      }],
      upstreams: [{
        id: "primary",
        name: "Primary",
        baseURL: "https://upstream.example/v1",
        apiKey: "upstream-key",
        enabled: true,
      }],
      qualityPresets: [{
        id: "poster",
        name: "Poster",
        quality: "high",
        size: "1536x1024",
        outputFormat: "webp",
      }],
    }),
    ...ADMIN_OPTIONS,
    fetchImpl: async (_url, init) => {
      captured = await new Response(init.body).text();
      return new Response(JSON.stringify({ data: [{ b64_json: "edited" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const body = [
    "--edit-boundary",
    'Content-Disposition: form-data; name="prompt"',
    "",
    "保持小尺寸",
    "--edit-boundary",
    'Content-Disposition: form-data; name="size"',
    "",
    "1024x1024",
    "--edit-boundary",
    'Content-Disposition: form-data; name="quality"',
    "",
    "medium",
    "--edit-boundary",
    'Content-Disposition: form-data; name="image"; filename="input.png"',
    "Content-Type: image/png",
    "",
    "fake-image-bytes",
    "--edit-boundary--",
    "",
  ].join("\r\n");

  const response = await app.handle(new Request("http://localhost/v1/images/edits", {
    method: "POST",
    headers: {
      authorization: "Bearer client-token",
      "content-type": "multipart/form-data; boundary=edit-boundary",
    },
    body,
  }));

  assert.equal(response.status, 200);
  assert.match(captured, /name="size"\r\n\r\n1024x1024/);
  assert.doesNotMatch(captured, /name="size"\r\n\r\n1536x1024/);
  assert.match(captured, /name="quality"\r\n\r\nmedium/);
  assert.doesNotMatch(captured, /name="quality"\r\n\r\nhigh/);
  assert.match(captured, /name="output_format"\r\n\r\nwebp/);
});

test("image streaming responses are returned before the upstream stream closes", async () => {
  let streamController = null;
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example/v1",
      upstreamApiKey: "upstream-key",
    }),
    ...ADMIN_OPTIONS,
    fetchImpl: async () => new Response(new ReadableStream({
      start(controller) {
        streamController = controller;
        controller.enqueue(new TextEncoder().encode("data: {\"type\":\"image_generation.partial_image\"}\n\n"));
      },
    }), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }),
  });

  const responsePromise = app.handle(jsonRequest("/v1/images/generations", {
    prompt: "streaming image",
    stream: true,
  }, {
    authorization: "Bearer client-token",
  }));
  const earlyResult = await Promise.race([
    responsePromise.then((response) => ({ kind: "response", response })),
    new Promise((resolve) => setTimeout(() => resolve({ kind: "timeout" }), 50)),
  ]);
  streamController?.close();

  assert.equal(earlyResult.kind, "response");
  assert.equal(earlyResult.response.status, 200);
  assert.equal(earlyResult.response.headers.get("x-accel-buffering"), "no");
  assert.match(await earlyResult.response.text(), /image_generation\.partial_image/);
});

test("image stream proxy sends a heartbeat before upstream responds", async () => {
  let capturedAccept = "";
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example/v1",
      upstreamApiKey: "upstream-key",
    }),
    ...ADMIN_OPTIONS,
    fetchImpl: async (_url, init) => {
      capturedAccept = init.headers.get("accept");
      return new Response(JSON.stringify({ data: [{ b64_json: "streamed-json" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const response = await app.handle(jsonRequest("/v1/images/generations", {
    prompt: "stream through slow upstream",
    stream: true,
  }, {
    authorization: "Bearer client-token",
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  assert.equal(response.headers.get("x-accel-buffering"), "no");
  assert.equal(capturedAccept, "text/event-stream");
  const reader = response.body.getReader();
  const firstChunk = await reader.read();
  assert.equal(new TextDecoder().decode(firstChunk.value), ": image-studio keepalive\n\n");
  const secondChunk = await reader.read();
  assert.match(new TextDecoder().decode(secondChunk.value), /streamed-json/);
  const doneChunk = await reader.read();
  assert.match(new TextDecoder().decode(doneChunk.value), /data: \[DONE\]/);
  assert.equal((await reader.read()).done, true);
});

test("image stream proxy keeps heartbeating while upstream is silent", async () => {
  const previousHeartbeat = process.env.IMAGE_STUDIO_STREAM_HEARTBEAT_MS;
  process.env.IMAGE_STUDIO_STREAM_HEARTBEAT_MS = "10";
  try {
    const app = createSelfHostedApp({
      store: memoryStore({
        imageApiToken: "client-token",
        upstreamBaseURL: "https://upstream.example/v1",
        upstreamApiKey: "upstream-key",
      }),
      ...ADMIN_OPTIONS,
      fetchImpl: async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return new Response(JSON.stringify({ data: [{ b64_json: "slow-json" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    const response = await app.handle(jsonRequest("/v1/images/generations", {
      prompt: "stream through silent upstream",
      stream: true,
    }, {
      authorization: "Bearer client-token",
    }));
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const firstChunk = await reader.read();
    const secondChunk = await reader.read();
    assert.equal(decoder.decode(firstChunk.value), ": image-studio keepalive\n\n");
    assert.equal(decoder.decode(secondChunk.value), ": image-studio keepalive\n\n");
    await reader.cancel();
  } finally {
    if (previousHeartbeat === undefined) {
      delete process.env.IMAGE_STUDIO_STREAM_HEARTBEAT_MS;
    } else {
      process.env.IMAGE_STUDIO_STREAM_HEARTBEAT_MS = previousHeartbeat;
    }
  }
});

test("image stream proxy extends upstream timeout for long running image work", async () => {
  const originalTimeout = AbortSignal.timeout;
  let capturedTimeoutMs = 0;
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
        requestTimeoutSeconds: 120,
      }),
      ...ADMIN_OPTIONS,
      fetchImpl: async () => new Response(JSON.stringify({ data: [{ b64_json: "slow-json" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    });

    const response = await app.handle(jsonRequest("/v1/images/edits", {
      prompt: "slow streaming edit",
      stream: true,
    }, {
      authorization: "Bearer client-token",
    }));
    assert.equal(response.status, 200);
    await response.text();
    assert.equal(capturedTimeoutMs, 300_000);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test("image proxy extends non-stream timeout for long running image work", async () => {
  const originalTimeout = AbortSignal.timeout;
  let capturedTimeoutMs = 0;
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
      ...ADMIN_OPTIONS,
      fetchImpl: async () => new Response(JSON.stringify({ data: [{ b64_json: "slow-json" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    });
    const body = [
      "--edit-boundary",
      'Content-Disposition: form-data; name="prompt"',
      "",
      "slow non-stream edit",
      "--edit-boundary",
      'Content-Disposition: form-data; name="image"; filename="input.png"',
      "Content-Type: image/png",
      "",
      "fake-image-bytes",
      "--edit-boundary--",
      "",
    ].join("\r\n");

    const response = await app.handle(new Request("http://localhost/v1/images/edits", {
      method: "POST",
      headers: {
        authorization: "Bearer client-token",
        "content-type": "multipart/form-data; boundary=edit-boundary",
      },
      body,
    }));

    assert.equal(response.status, 200);
    await response.text();
    assert.equal(capturedTimeoutMs, 300_000);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test("image proxy returns structured json when upstream fetch fails", async () => {
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example/v1",
      upstreamApiKey: "upstream-key",
    }),
    ...ADMIN_OPTIONS,
    fetchImpl: async () => {
      throw new Error("upstream socket closed");
    },
  });

  const response = await app.handle(jsonRequest("/v1/images/edits", {
    prompt: "network failure",
  }, {
    authorization: "Bearer client-token",
  }));

  assert.equal(response.status, 502);
  assert.equal(response.headers.get("x-image-studio-upstream-id"), "default");
  const body = await response.json();
  assert.match(body.error.message, /上游请求失败/);
  assert.match(body.error.raw, /upstream socket closed/);
});

test("image generation logs include the upstream failure summary", async () => {
  const generationLogStore = createMemoryLogStore();
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example/v1",
      upstreamApiKey: "upstream-key",
    }),
    ...ADMIN_OPTIONS,
    generationLogStore,
    fetchImpl: async () => new Response(JSON.stringify({
      error: { message: "upstream gateway timed out after billing" },
    }), {
      status: 502,
      headers: { "content-type": "application/json" },
    }),
  });

  const response = await app.handle(jsonRequest("/v1/images/generations", {
    prompt: "slow paid request",
  }, {
    authorization: "Bearer client-token",
  }));

  assert.equal(response.status, 502);
  const records = await generationLogStore.readRecent(10);
  assert.equal(records.length, 1);
  assert.equal(records[0].status, "failed");
  assert.match(records[0].errorSummary, /upstream gateway timed out after billing/);
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
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.config.upstreamBaseURL, "https://new.example");
  assert.equal(body.config.upstreamApiKeySet, true);
  assert.equal(body.config.imageApiTokenSet, true);
  assert.equal(body.config.defaultImageModel, "gpt-image-2");
  assert.equal(body.config.defaultSize, "1536x1024");
  assert.equal(body.config.defaultQuality, "high");
  assert.equal(body.config.requestTimeoutSeconds, 180);
  assert.equal(body.config.interfaces[0].apiTokenSet, true);
  assert.equal(body.config.interfaces[0].qualityPresetId, "high-quality-final");
  assert.equal(body.config.upstreams[0].apiKeySet, true);
  assert.equal(body.config.upstreams[0].healthCheckEnabled, true);
  assert.equal(Array.isArray(body.config.models), true);
  assert.equal(Array.isArray(body.config.qualityPresets), true);
  assert.equal(body.config.alerts.webhookEnabled, false);
  assert.equal(body.config.security.failedLoginLockoutEnabled, true);
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

test("admin can reveal saved interface and upstream api keys", async () => {
  const app = createSelfHostedApp({
    store: memoryStore({
      interfaces: [{
        id: "codex",
        name: "Codex",
        apiToken: "client-token",
        upstreamIds: ["primary"],
      }],
      upstreams: [{
        id: "primary",
        name: "Primary",
        baseURL: "https://primary.example/v1",
        apiKey: "upstream-key",
      }],
    }),
    ...ADMIN_OPTIONS,
    fetchImpl: async () => {
      throw new Error("secret reveal must not call upstream");
    },
  });

  const denied = await app.handle(new Request("http://localhost/api/config/secrets?kind=interface&id=codex"));
  assert.equal(denied.status, 401);

  const headers = await loginHeaders(app);
  const interfaceSecret = await app.handle(new Request("http://localhost/api/config/secrets?kind=interface&id=codex", {
    headers,
  }));
  assert.equal(interfaceSecret.status, 200);
  assert.deepEqual(await interfaceSecret.json(), {
    secret: {
      kind: "interface",
      id: "codex",
      value: "client-token",
    },
  });

  const upstreamSecret = await app.handle(new Request("http://localhost/api/config/secrets?kind=upstream&id=primary", {
    headers,
  }));
  assert.equal(upstreamSecret.status, 200);
  assert.deepEqual(await upstreamSecret.json(), {
    secret: {
      kind: "upstream",
      id: "primary",
      value: "upstream-key",
    },
  });
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
    successRate: 100,
    errorRate: 0,
    p50DurationMs: logsBody.records[0].durationMs,
    p95DurationMs: logsBody.records[0].durationMs,
    p99DurationMs: logsBody.records[0].durationMs,
    today: 1,
  });
  assert.equal(typeof metricsBody.metrics.upstreams, "object");
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

test("admin security enforces ip allowlist and failed login lockout", async () => {
  const app = createSelfHostedApp({
    store: memoryStore({
      security: {
        ipAllowlist: ["203.0.113.10"],
        failedLoginLockoutEnabled: true,
      },
    }),
    ...ADMIN_OPTIONS,
    fetchImpl: async () => {
      throw new Error("security checks must not call upstream");
    },
    now: (() => {
      let current = Date.parse("2026-06-20T00:00:00.000Z");
      return () => current;
    })(),
  });

  const blocked = await app.handle(jsonRequest("/api/login", {
    username: "admin",
    password: "admin-pass",
  }, {
    "x-forwarded-for": "198.51.100.20",
  }));
  assert.equal(blocked.status, 403);

  for (let index = 0; index < 5; index += 1) {
    const failed = await app.handle(jsonRequest("/api/login", {
      username: "admin",
      password: "wrong-pass",
    }, {
      "x-forwarded-for": "203.0.113.10",
    }));
    assert.equal(failed.status, 401);
  }

  const locked = await app.handle(jsonRequest("/api/login", {
    username: "admin",
    password: "admin-pass",
  }, {
    "x-forwarded-for": "203.0.113.10",
  }));
  assert.equal(locked.status, 429);
  assert.match((await locked.json()).error.message, /locked/i);
});

test("admin can enable totp and login requires a valid code", async () => {
  const now = Date.parse("2026-06-20T00:00:00.000Z");
  const store = memoryStore();
  const app = createSelfHostedApp({
    store,
    ...ADMIN_OPTIONS,
    fetchImpl: async () => {
      throw new Error("totp operations must not call upstream");
    },
    now: () => now,
  });
  const headers = await loginHeaders(app);

  const setup = await app.handle(new Request("http://localhost/api/security/totp/setup", {
    method: "POST",
    headers,
  }));
  assert.equal(setup.status, 200);
  const setupBody = await setup.json();
  assert.match(setupBody.totp.secret, /^[A-Z2-7]+=*$/);
  assert.match(setupBody.totp.otpauthURL, /^otpauth:\/\/totp\//);

  const enable = await app.handle(jsonRequest("/api/security/totp/enable", {
    code: totpCode(setupBody.totp.secret, now),
  }, headers));
  assert.equal(enable.status, 200);
  assert.equal((await enable.json()).security.totpEnabled, true);
  assert.equal(store.current().security.totpSecret, setupBody.totp.secret);

  const missingCode = await app.handle(jsonRequest("/api/login", {
    username: "admin",
    password: "admin-pass",
  }));
  assert.equal(missingCode.status, 401);
  const wrongCode = await app.handle(jsonRequest("/api/login", {
    username: "admin",
    password: "admin-pass",
    totpCode: "000000",
  }));
  assert.equal(wrongCode.status, 401);
  const validCode = await app.handle(jsonRequest("/api/login", {
    username: "admin",
    password: "admin-pass",
    totpCode: totpCode(setupBody.totp.secret, now),
  }));
  assert.equal(validCode.status, 200);
});

test("admin can rotate interface keys and clone interfaces", async () => {
  const store = memoryStore({
    interfaces: [{
      id: "codex",
      name: "Codex",
      apiToken: "old-client-token",
      upstreamIds: ["default"],
    }],
    upstreams: [{
      id: "default",
      name: "Default",
      baseURL: "https://upstream.example/v1",
      apiKey: "upstream-key",
    }],
  });
  const app = createSelfHostedApp({
    store,
    ...ADMIN_OPTIONS,
    fetchImpl: async () => {
      throw new Error("admin key operations must not call upstream");
    },
  });
  const headers = await loginHeaders(app);

  const rotate = await app.handle(jsonRequest("/api/interfaces/codex/rotate-key", {}, headers));
  assert.equal(rotate.status, 200);
  const rotated = await rotate.json();
  assert.equal(rotated.interface.id, "codex");
  assert.match(rotated.apiToken, /^img_[A-Za-z0-9_-]{24,}$/);
  assert.notEqual(rotated.apiToken, "old-client-token");
  assert.equal(store.current().interfaces[0].apiToken, rotated.apiToken);

  const clone = await app.handle(jsonRequest("/api/interfaces/codex/clone", {
    id: "codex-copy",
    name: "Codex Copy",
  }, headers));
  assert.equal(clone.status, 200);
  const cloned = await clone.json();
  assert.equal(cloned.interface.id, "codex-copy");
  assert.equal(cloned.interface.name, "Codex Copy");
  assert.notEqual(store.current().interfaces[1].apiToken, store.current().interfaces[0].apiToken);
});

test("admin can test upstreams and receives clear validation errors", async () => {
  const calls = [];
  const app = createSelfHostedApp({
    store: memoryStore({
      interfaces: [{
        id: "codex",
        name: "Codex",
        apiToken: "client-token",
        upstreamIds: ["primary", "missing-key"],
      }],
      upstreams: [{
        id: "primary",
        name: "Primary",
        baseURL: "https://primary.example/v1",
        apiKey: "primary-key",
      }, {
        id: "missing-key",
        name: "Missing Key",
        baseURL: "https://missing.example/v1",
        apiKey: "",
      }],
    }),
    ...ADMIN_OPTIONS,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), authorization: init.headers.get("authorization") });
      return new Response(JSON.stringify({ data: [{ id: "gpt-image-2" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const headers = await loginHeaders(app);

  const success = await app.handle(jsonRequest("/api/upstreams/primary/test", {}, headers));
  assert.equal(success.status, 200);
  const successBody = await success.json();
  assert.equal(successBody.ok, true);
  assert.equal(successBody.upstream.id, "primary");
  assert.equal(successBody.upstream.name, "Primary");
  assert.equal(successBody.upstream.status, "healthy");
  assert.equal(successBody.upstream.upstreamStatus, 200);
  assert.equal(successBody.upstream.message, "上游连接正常");
  assert.match(successBody.upstream.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(calls[0].url, "https://primary.example/v1/models");
  assert.equal(calls[0].authorization, "Bearer primary-key");

  const missing = await app.handle(jsonRequest("/api/upstreams/missing-key/test", {}, headers));
  assert.equal(missing.status, 400);
  assert.match((await missing.json()).error.message, /API Key/);
});

test("admin upstream health exposes latency and latest failure diagnostics", async () => {
  const generationLogStore = createMemoryLogStore();
  await generationLogStore.append({
    id: "gen-success",
    createdAt: "2026-06-19T01:00:00.000Z",
    status: "success",
    upstreamId: "primary",
    durationMs: 1000,
  });
  await generationLogStore.append({
    id: "gen-failed",
    createdAt: "2026-06-19T02:00:00.000Z",
    status: "failed",
    upstreamId: "primary",
    durationMs: 3000,
    errorSummary: "upstream gateway timed out after billing",
  });
  const app = createSelfHostedApp({
    store: memoryStore({
      upstreams: [{
        id: "primary",
        name: "Primary",
        baseURL: "https://primary.example/v1",
        apiKey: "primary-key",
      }],
    }),
    ...ADMIN_OPTIONS,
    generationLogStore,
    fetchImpl: async () => new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  const headers = await loginHeaders(app);

  const response = await app.handle(new Request("http://localhost/api/upstreams/health", { headers }));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.upstreams[0].metrics.averageDurationMs, 2000);
  assert.equal(body.upstreams[0].metrics.lastCheckedAt, "2026-06-19T02:00:00.000Z");
  assert.equal(body.upstreams[0].metrics.lastFailureReason, "upstream gateway timed out after billing");
});

test("admin can read and restore config versions and audit logs", async () => {
  const store = memoryStore({
    imageApiToken: "client-token",
    upstreamBaseURL: "https://old.example/v1",
    upstreamApiKey: "upstream-key",
  });
  const app = createSelfHostedApp({
    store,
    ...ADMIN_OPTIONS,
    fetchImpl: async () => {
      throw new Error("config version operations must not call upstream");
    },
  });
  const headers = await loginHeaders(app);

  const save = await app.handle(jsonRequest("/api/config", {
    upstreams: [{
      id: "default",
      name: "Default",
      baseURL: "https://new.example/v1",
      apiKey: "",
    }],
  }, headers));
  assert.equal(save.status, 200);

  const versions = await app.handle(new Request("http://localhost/api/config/versions", { headers }));
  assert.equal(versions.status, 200);
  const versionBody = await versions.json();
  assert.equal(versionBody.versions.length, 1);
  assert.equal(versionBody.versions[0].snapshot.upstreamBaseURL, "https://old.example");

  const restore = await app.handle(jsonRequest(`/api/config/versions/${versionBody.versions[0].id}/restore`, {}, headers));
  assert.equal(restore.status, 200);
  assert.equal((await restore.json()).config.upstreamBaseURL, "https://old.example");

  const audit = await app.handle(new Request("http://localhost/api/audit-logs", { headers }));
  assert.equal(audit.status, 200);
  const auditBody = await audit.json();
  assert.equal(auditBody.records.some((record) => record.action === "config.update"), true);
  assert.equal(auditBody.records.some((record) => record.action === "config.restore"), true);
});

test("admin can manage models quality presets alerts sessions usage and backup", async () => {
  const apiLogStore = createMemoryLogStore();
  const generationLogStore = createMemoryLogStore();
  await generationLogStore.append({
    id: "gen-one",
    createdAt: "2026-06-19T01:00:00.000Z",
    status: "success",
    interfaceId: "codex",
    upstreamId: "primary",
    model: "gpt-image-2",
    durationMs: 1000,
  });
  const app = createSelfHostedApp({
    store: memoryStore({
      interfaces: [{
        id: "codex",
        name: "Codex",
        apiToken: "client-token",
        upstreamIds: ["primary"],
      }],
      upstreams: [{
        id: "primary",
        name: "Primary",
        baseURL: "https://primary.example/v1",
        apiKey: "primary-key",
      }],
    }),
    ...ADMIN_OPTIONS,
    apiLogStore,
    generationLogStore,
    fetchImpl: async () => new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  const headers = await loginHeaders(app);

  const modelsUpdate = await app.handle(new Request("http://localhost/api/models", {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ models: [{ id: "custom-image", enabled: true, upstreamIds: ["primary"] }] }),
  }));
  assert.equal(modelsUpdate.status, 200);
  assert.equal((await modelsUpdate.json()).models[0].id, "custom-image");

  const presetsUpdate = await app.handle(new Request("http://localhost/api/quality-presets", {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ qualityPresets: [{ id: "sharp", name: "Sharp", quality: "high" }] }),
  }));
  assert.equal(presetsUpdate.status, 200);
  assert.equal((await presetsUpdate.json()).qualityPresets[0].id, "sharp");

  const alertsUpdate = await app.handle(new Request("http://localhost/api/alerts", {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ alerts: { webhookEnabled: true, webhookURL: "https://hooks.example/a" } }),
  }));
  assert.equal(alertsUpdate.status, 200);
  assert.equal((await alertsUpdate.json()).alerts.webhookEnabled, true);

  const usage = await app.handle(new Request("http://localhost/api/usage", { headers }));
  assert.equal(usage.status, 200);
  const usageBody = await usage.json();
  assert.equal(usageBody.usage.byInterface.codex.total, 1);
  assert.equal(usageBody.usage.byInterface.codex.success, 1);
  assert.equal(usageBody.usage.byInterface.codex.failed, 0);
  assert.equal(usageBody.usage.byInterface.codex.durationMs, 1000);
  assert.equal(usageBody.usage.byInterface.codex.estimatedCostUSD, 0.02);

  const sessions = await app.handle(new Request("http://localhost/api/sessions", { headers }));
  assert.equal(sessions.status, 200);
  const sessionBody = await sessions.json();
  assert.equal(sessionBody.sessions.length, 1);
  assert.equal(sessionBody.sessions[0].username, "admin");

  const backup = await app.handle(jsonRequest("/api/backup", {}, headers));
  assert.equal(backup.status, 200);
  const backupBody = await backup.json();
  assert.equal(backupBody.backup.config.interfaces[0].id, "codex");
});

test("admin can revoke other sessions and audit the action", async () => {
  const app = createSelfHostedApp({
    store: memoryStore(),
    ...ADMIN_OPTIONS,
    fetchImpl: async () => new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  const firstHeaders = await loginHeaders(app);
  const secondHeaders = await loginHeaders(app);
  const before = await app.handle(new Request("http://localhost/api/sessions", { headers: secondHeaders }));
  const beforeBody = await before.json();
  assert.equal(beforeBody.sessions.length, 2);

  const revoke = await app.handle(new Request("http://localhost/api/sessions/revoke", {
    method: "POST",
    headers: { ...secondHeaders, "content-type": "application/json" },
    body: JSON.stringify({ others: true }),
  }));

  assert.equal(revoke.status, 200);
  const revokeBody = await revoke.json();
  assert.equal(revokeBody.revoked, 1);
  const after = await app.handle(new Request("http://localhost/api/sessions", { headers: secondHeaders }));
  const afterBody = await after.json();
  assert.equal(afterBody.sessions.length, 1);
  assert.equal(afterBody.sessions[0].current, true);
  const revokedSession = await app.handle(new Request("http://localhost/api/sessions", { headers: firstHeaders }));
  assert.equal(revokedSession.status, 401);
  const audit = await app.handle(new Request("http://localhost/api/audit-logs", { headers: secondHeaders }));
  const auditBody = await audit.json();
  assert.equal(auditBody.records.some((record) => record.action === "session.revoke" && record.details.revoked === 1), true);
});

test("admin usage summarizes estimated cost and daily buckets", async () => {
  const generationLogStore = createMemoryLogStore();
  await generationLogStore.append({
    id: "gen-success",
    createdAt: "2026-06-19T01:00:00.000Z",
    status: "success",
    interfaceId: "codex",
    upstreamId: "primary",
    model: "gpt-image-2",
    durationMs: 1200,
    imageCount: 2,
  });
  await generationLogStore.append({
    id: "gen-billed-failed-proxy",
    createdAt: "2026-06-19T02:00:00.000Z",
    status: "failed",
    upstreamStatus: 200,
    interfaceId: "codex",
    upstreamId: "primary",
    model: "gpt-image-2",
    durationMs: 71000,
    imageCount: 1,
  });
  await generationLogStore.append({
    id: "gen-explicit-cost",
    createdAt: "2026-06-20T01:00:00.000Z",
    status: "success",
    interfaceId: "designer",
    upstreamId: "backup",
    model: "custom-image",
    durationMs: 900,
    costUSD: 0.1234,
  });
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example/v1",
      upstreamApiKey: "upstream-key",
    }),
    ...ADMIN_OPTIONS,
    generationLogStore,
    fetchImpl: async () => new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  const headers = await loginHeaders(app);

  const response = await app.handle(new Request("http://localhost/api/usage", { headers }));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.usage.total.total, 3);
  assert.equal(body.usage.total.imageCount, 4);
  assert.equal(body.usage.total.estimatedCostUSD, 0.1834);
  assert.equal(body.usage.byModel["gpt-image-2"].estimatedCostUSD, 0.06);
  assert.equal(body.usage.byDate["2026-06-19"].total, 2);
  assert.equal(body.usage.byDate["2026-06-19"].estimatedCostUSD, 0.06);
  assert.equal(body.usage.byDate["2026-06-20"].estimatedCostUSD, 0.1234);
});

test("admin backups retain raw secrets and keep the latest ten snapshots", async () => {
  let tick = 0;
  const store = memoryStore({
    interfaces: [{
      id: "codex",
      name: "Codex",
      apiToken: "client-token",
      upstreamIds: ["primary"],
    }],
    upstreams: [{
      id: "primary",
      name: "Primary",
      baseURL: "https://primary.example/v1",
      apiKey: "upstream-key",
    }],
  });
  const app = createSelfHostedApp({
    store,
    ...ADMIN_OPTIONS,
    fetchImpl: async () => new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
    now: () => Date.UTC(2026, 5, 20, 1, 0, tick++),
  });
  const headers = await loginHeaders(app);
  let firstBackup = null;
  for (let index = 0; index < 11; index += 1) {
    const response = await app.handle(jsonRequest("/api/backup", {}, headers));
    assert.equal(response.status, 200);
    const body = await response.json();
    if (index === 0) firstBackup = body.backup;
  }

  assert.equal(firstBackup.rawConfig.interfaces[0].apiToken, "client-token");
  assert.equal(firstBackup.rawConfig.upstreams[0].apiKey, "upstream-key");
  const list = await app.handle(new Request("http://localhost/api/backup", { headers }));
  assert.equal(list.status, 200);
  const listBody = await list.json();
  assert.equal(listBody.backups.length, 10);
  assert.equal(listBody.backups.some((item) => item.id === firstBackup.id), false);

  await store.save({
    interfaces: [{
      id: "codex",
      name: "Codex",
      apiToken: "changed-client-token",
      upstreamIds: ["primary"],
    }],
    upstreams: [{
      id: "primary",
      name: "Primary",
      baseURL: "https://primary.example/v1",
      apiKey: "changed-upstream-key",
    }],
  });
  const restore = await app.handle(jsonRequest("/api/restore", { backup: firstBackup }, headers));
  assert.equal(restore.status, 200);
  assert.equal(store.current().interfaces[0].apiToken, "client-token");
  assert.equal(store.current().upstreams[0].apiKey, "upstream-key");
});

test("admin backups persist through app recreation", async () => {
  const store = memoryStore({
    interfaces: [{
      id: "codex",
      name: "Codex",
      apiToken: "client-token",
      upstreamIds: ["primary"],
    }],
    upstreams: [{
      id: "primary",
      name: "Primary",
      baseURL: "https://primary.example/v1",
      apiKey: "upstream-key",
    }],
  });
  const makeApp = () => createSelfHostedApp({
    store,
    ...ADMIN_OPTIONS,
    fetchImpl: async () => new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  const firstApp = makeApp();
  const firstHeaders = await loginHeaders(firstApp);
  const backup = await firstApp.handle(jsonRequest("/api/backup", {}, firstHeaders));
  assert.equal(backup.status, 200);
  const backupId = (await backup.json()).backup.id;

  const secondApp = makeApp();
  const secondHeaders = await loginHeaders(secondApp);
  const list = await secondApp.handle(new Request("http://localhost/api/backup", { headers: secondHeaders }));
  assert.equal(list.status, 200);
  const listBody = await list.json();
  assert.equal(listBody.backups.some((item) => item.id === backupId), true);
});

test("admin can review and acknowledge active alerts", async () => {
  const generationLogStore = createMemoryLogStore();
  await generationLogStore.append({
    id: "gen-fail",
    createdAt: "2026-06-19T01:00:00.000Z",
    status: "failed",
    interfaceId: "codex",
    upstreamId: "primary",
    model: "gpt-image-2",
    durationMs: 90000,
  });
  await generationLogStore.append({
    id: "gen-slow",
    createdAt: "2026-06-19T01:01:00.000Z",
    status: "success",
    interfaceId: "codex",
    upstreamId: "primary",
    model: "gpt-image-2",
    durationMs: 85000,
  });
  const store = memoryStore({
    interfaces: [{
      id: "codex",
      name: "Codex",
      apiToken: "",
      upstreamIds: ["primary"],
    }],
    upstreams: [{
      id: "primary",
      name: "Primary",
      baseURL: "https://primary.example/v1",
      apiKey: "",
    }],
    alerts: {
      successRateThreshold: 90,
      p95LatencyMsThreshold: 30000,
    },
  });
  const app = createSelfHostedApp({
    store,
    ...ADMIN_OPTIONS,
    generationLogStore,
    fetchImpl: async () => {
      throw new Error("active alerts must not call upstream");
    },
  });

  const unauthorized = await app.handle(new Request("http://localhost/api/alerts/active"));
  assert.equal(unauthorized.status, 401);

  const headers = await loginHeaders(app);
  const active = await app.handle(new Request("http://localhost/api/alerts/active", { headers }));
  assert.equal(active.status, 200);
  const activeBody = await active.json();
  assert.equal(activeBody.alerts.some((alert) => alert.id === "config.interface-key.codex"), true);
  assert.equal(activeBody.alerts.some((alert) => alert.id === "config.upstream-key.primary"), true);
  assert.equal(activeBody.alerts.some((alert) => alert.id === "generation.success-rate"), true);
  assert.equal(activeBody.alerts.some((alert) => alert.id === "generation.p95-latency"), true);
  assert.equal(activeBody.summary.critical >= 1, true);

  const ack = await app.handle(jsonRequest("/api/alerts/generation.p95-latency/ack", {}, headers));
  assert.equal(ack.status, 200);
  const ackBody = await ack.json();
  assert.equal(ackBody.alert.acknowledged, true);
  assert.equal(store.current().acknowledgedAlerts.some((item) => item.id === "generation.p95-latency"), true);
});

test("admin active alerts sends webhook notifications once per alert set", async () => {
  const generationLogStore = createMemoryLogStore();
  await generationLogStore.append({
    id: "gen-fail",
    createdAt: "2026-06-19T01:00:00.000Z",
    status: "failed",
    interfaceId: "codex",
    upstreamId: "primary",
    model: "gpt-image-2",
    durationMs: 90000,
  });
  const webhookCalls = [];
  const app = createSelfHostedApp({
    store: memoryStore({
      interfaces: [{
        id: "codex",
        name: "Codex",
        apiToken: "",
        upstreamIds: ["primary"],
      }],
      upstreams: [{
        id: "primary",
        name: "Primary",
        baseURL: "https://primary.example/v1",
        apiKey: "",
      }],
      alerts: {
        webhookEnabled: true,
        webhookURL: "https://hooks.example/alert",
        successRateThreshold: 90,
        p95LatencyMsThreshold: 30000,
      },
    }),
    ...ADMIN_OPTIONS,
    generationLogStore,
    fetchImpl: async (url, init) => {
      webhookCalls.push({
        url: String(url),
        method: init.method,
        contentType: init.headers.get("content-type"),
        body: JSON.parse(await new Response(init.body).text()),
      });
      return new Response("ok", { status: 200 });
    },
  });
  const headers = await loginHeaders(app);

  const first = await app.handle(new Request("http://localhost/api/alerts/active", { headers }));
  const second = await app.handle(new Request("http://localhost/api/alerts/active", { headers }));

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(webhookCalls.length, 1);
  assert.equal(webhookCalls[0].url, "https://hooks.example/alert");
  assert.equal(webhookCalls[0].method, "POST");
  assert.equal(webhookCalls[0].contentType, "application/json");
  assert.equal(webhookCalls[0].body.alerts.some((alert) => alert.id === "config.interface-key.codex"), true);
  const firstBody = await first.json();
  assert.equal(firstBody.notification.status, "sent");
  assert.match(firstBody.notification.sentAt, /^\d{4}-\d{2}-\d{2}T/);
  const secondBody = await second.json();
  assert.equal(secondBody.notification.status, "sent");
});

test("admin can mark generation logs as quality cases and audit the action", async () => {
  const generationLogStore = createMemoryLogStore();
  await generationLogStore.append({
    id: "gen-poor",
    createdAt: "2026-06-19T01:00:00.000Z",
    status: "success",
    endpoint: "/v1/images/edits",
    interfaceId: "codex",
    upstreamId: "primary",
    model: "gpt-image-2",
    durationMs: 72000,
  });
  const store = memoryStore({
    interfaces: [{
      id: "codex",
      name: "Codex",
      apiToken: "client-token",
      upstreamIds: ["primary"],
    }],
    upstreams: [{
      id: "primary",
      name: "Primary",
      baseURL: "https://primary.example/v1",
      apiKey: "primary-key",
    }],
  });
  const app = createSelfHostedApp({
    store,
    ...ADMIN_OPTIONS,
    generationLogStore,
    fetchImpl: async () => {
      throw new Error("quality cases must not call upstream");
    },
  });

  const unauthorized = await app.handle(new Request("http://localhost/api/quality-cases"));
  assert.equal(unauthorized.status, 401);

  const headers = await loginHeaders(app);
  const create = await app.handle(jsonRequest("/api/quality-cases", {
    recordId: "gen-poor",
    label: "poor",
    note: "Text artifacts and low detail",
  }, headers));
  assert.equal(create.status, 200);
  const created = await create.json();
  assert.equal(created.case.recordId, "gen-poor");
  assert.equal(created.case.label, "poor");
  assert.equal(created.case.model, "gpt-image-2");
  assert.equal(created.case.interfaceId, "codex");
  assert.equal(created.case.upstreamId, "primary");
  assert.equal(created.qualityCases.length, 1);

  const list = await app.handle(new Request("http://localhost/api/quality-cases", { headers }));
  assert.equal(list.status, 200);
  const listed = await list.json();
  assert.equal(listed.qualityCases.length, 1);
  assert.equal(listed.qualityCases[0].recordId, "gen-poor");
  assert.equal(store.current().qualityCases[0].label, "poor");

  const audit = await app.handle(new Request("http://localhost/api/audit-logs", { headers }));
  const auditBody = await audit.json();
  assert.equal(auditBody.records.some((record) => record.action === "quality.case.mark" && record.details.recordId === "gen-poor"), true);
});
