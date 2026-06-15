import test from "node:test";
import assert from "node:assert/strict";
import { compareReleaseVersions, createUpdateService } from "../src/updateService.js";

test("compareReleaseVersions detects when the latest release is newer", () => {
  assert.equal(compareReleaseVersions("v1.2.5", "v1.2.6"), "newer");
});

test("compareReleaseVersions detects matching releases", () => {
  assert.equal(compareReleaseVersions("v1.2.5", "v1.2.5"), "same");
});

test("compareReleaseVersions detects when the latest release is older", () => {
  assert.equal(compareReleaseVersions("v1.2.6", "v1.2.5"), "older");
});

test("compareReleaseVersions returns unknown for invalid semantic versions", () => {
  assert.equal(compareReleaseVersions("dev", "v1.2.6"), "unknown");
  assert.equal(compareReleaseVersions("v1.2", "v1.2.6"), "unknown");
});

test("checkLatest calls the GitHub latest release API and returns release status", async () => {
  let capturedURL = "";
  let capturedAccept = "";
  const service = createUpdateService({
    currentVersion: "v1.2.5",
    repository: " owner/repo ",
    fetchImpl: async (url, init) => {
      capturedURL = String(url);
      capturedAccept = init.headers.accept;
      return new Response(JSON.stringify({
        tag_name: "v1.2.6",
        html_url: "https://github.com/owner/repo/releases/tag/v1.2.6",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const update = await service.checkLatest();

  assert.equal(capturedURL, "https://api.github.com/repos/owner/repo/releases/latest");
  assert.equal(capturedAccept, "application/vnd.github+json");
  assert.deepEqual(update, {
    currentVersion: "v1.2.5",
    latestVersion: "v1.2.6",
    status: "newer",
    releaseURL: "https://github.com/owner/repo/releases/tag/v1.2.6",
  });
});

test("checkLatest reports unconfigured when no repository is set", async () => {
  const service = createUpdateService({
    currentVersion: "v1.2.5",
    repository: " ",
    fetchImpl: async () => {
      throw new Error("unconfigured service must not fetch");
    },
  });

  assert.deepEqual(await service.checkLatest(), {
    currentVersion: "v1.2.5",
    latestVersion: "",
    status: "unconfigured",
    releaseURL: "",
  });
});

test("checkLatest returns error for failed or throwing GitHub requests", async () => {
  const failingService = createUpdateService({
    currentVersion: "v1.2.5",
    repository: "owner/repo",
    fetchImpl: async () => new Response("not found", { status: 404 }),
  });
  assert.deepEqual(await failingService.checkLatest(), {
    currentVersion: "v1.2.5",
    latestVersion: "",
    status: "error",
    releaseURL: "",
  });

  const throwingService = createUpdateService({
    currentVersion: "v1.2.5",
    repository: "owner/repo",
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  assert.deepEqual(await throwingService.checkLatest(), {
    currentVersion: "v1.2.5",
    latestVersion: "",
    status: "error",
    releaseURL: "",
  });
});
