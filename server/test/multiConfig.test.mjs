import test from "node:test";
import assert from "node:assert/strict";

import { mergeConfigUpdate, normalizeConfig, publicConfig } from "../src/config.js";

test("normalizeConfig migrates legacy single relay settings into default interface and upstream", () => {
  const config = normalizeConfig({
    imageApiToken: "client-token",
    upstreamBaseURL: "https://upstream.example/v1",
    upstreamApiKey: "upstream-key",
    defaultImageModel: "gpt-image-2",
    requestTimeoutSeconds: 180,
  });

  assert.equal(config.interfaces.length, 1);
  assert.equal(config.interfaces[0].id, "default");
  assert.equal(config.interfaces[0].apiToken, "client-token");
  assert.deepEqual(config.interfaces[0].upstreamIds, ["default"]);
  assert.equal(config.interfaces[0].defaultImageModel, "gpt-image-2");
  assert.equal(config.interfaces[0].requestTimeoutSeconds, 180);

  assert.equal(config.upstreams.length, 1);
  assert.equal(config.upstreams[0].id, "default");
  assert.equal(config.upstreams[0].baseURL, "https://upstream.example");
  assert.equal(config.upstreams[0].apiKey, "upstream-key");
});

test("publicConfig exposes interface and upstream secret flags without raw values", () => {
  const config = normalizeConfig({
    interfaces: [{
      id: "codex",
      name: "Codex",
      apiToken: "client-token",
      upstreamIds: ["primary"],
    }],
    upstreams: [{
      id: "primary",
      name: "Primary",
      baseURL: "https://old.example/v1",
      apiKey: "upstream-key",
    }],
  });

  const exposed = publicConfig(config);
  assert.equal(exposed.interfaces[0].apiTokenSet, true);
  assert.equal(exposed.interfaces[0].apiToken, undefined);
  assert.equal(exposed.upstreams[0].apiKeySet, true);
  assert.equal(exposed.upstreams[0].apiKey, undefined);
});

test("mergeConfigUpdate preserves blank per-item secrets", () => {
  const current = normalizeConfig({
    interfaces: [{
      id: "codex",
      name: "Codex",
      apiToken: "old-client-token",
      upstreamIds: ["primary"],
    }],
    upstreams: [{
      id: "primary",
      name: "Primary",
      baseURL: "https://old.example/v1",
      apiKey: "old-upstream-key",
    }],
  });

  const next = mergeConfigUpdate(current, {
    interfaces: [{
      id: "codex",
      name: "Codex Skill",
      apiToken: "",
      upstreamIds: ["primary", "backup"],
      defaultImageModel: "gpt-image-2",
    }],
    upstreams: [{
      id: "primary",
      name: "Primary",
      baseURL: "https://new.example/v1",
      apiKey: "",
    }, {
      id: "backup",
      name: "Backup",
      baseURL: "https://backup.example/v1",
      apiKey: "backup-key",
    }],
  });

  assert.equal(next.interfaces[0].apiToken, "old-client-token");
  assert.equal(next.upstreams[0].apiKey, "old-upstream-key");
  assert.deepEqual(next.interfaces[0].upstreamIds, ["primary", "backup"]);
  assert.equal(next.interfaces[0].defaultImageModel, "gpt-image-2");
});
