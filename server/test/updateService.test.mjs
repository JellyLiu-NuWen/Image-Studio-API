import test from "node:test";
import assert from "node:assert/strict";
import { compareReleaseVersions, createUpdateService } from "../src/updateService.js";

const DEFAULT_UPDATE_DETAILS = {
  currentCommit: "",
  dockerImageTag: "",
  changelogURL: "",
  changelog: "",
  rollbackCommand: "docker compose -p current -f docker-compose.self-hosted.yml up -d --no-deps image-studio-api",
};

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
    currentCommit: "abcdef1234567890",
    dockerImageTag: "v1.2.5",
    repository: " owner/repo ",
    fetchImpl: async (url, init) => {
      capturedURL = String(url);
      capturedAccept = init.headers.accept;
      return new Response(JSON.stringify({
        tag_name: "v1.2.6",
        html_url: "https://github.com/owner/repo/releases/tag/v1.2.6",
        body: "## Changed\n- Faster image proxy",
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
    currentCommit: "abcdef12",
    dockerImageTag: "v1.2.5",
    latestVersion: "v1.2.6",
    status: "newer",
    releaseURL: "https://github.com/owner/repo/releases/tag/v1.2.6",
    changelogURL: "https://github.com/owner/repo/releases/tag/v1.2.6",
    changelog: "## Changed\n- Faster image proxy",
    rollbackCommand: "docker compose -p current -f docker-compose.self-hosted.yml up -d --no-deps image-studio-api",
    source: "release",
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
    ...DEFAULT_UPDATE_DETAILS,
    latestVersion: "",
    status: "unconfigured",
    releaseURL: "",
    source: "release",
  });
});

test("checkLatest reports unconfigured for malformed repository values", async () => {
  const service = createUpdateService({
    currentVersion: "v1.2.5",
    repository: "owner/repo/releases/latest",
    fetchImpl: async () => {
      throw new Error("malformed repository must not fetch");
    },
  });

  assert.deepEqual(await service.checkLatest(), {
    currentVersion: "v1.2.5",
    ...DEFAULT_UPDATE_DETAILS,
    latestVersion: "",
    status: "unconfigured",
    releaseURL: "",
    source: "release",
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
    ...DEFAULT_UPDATE_DETAILS,
    latestVersion: "",
    status: "error",
    releaseURL: "",
    source: "release",
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
    ...DEFAULT_UPDATE_DETAILS,
    latestVersion: "",
    status: "error",
    releaseURL: "",
    source: "release",
  });
});

test("checkLatest falls back to the main commit when no release exists", async () => {
  const requested = [];
  const service = createUpdateService({
    currentVersion: "cc308c93",
    repository: "owner/repo",
    fetchImpl: async (url) => {
      requested.push(String(url));
      if (String(url).endsWith("/releases/latest")) {
        return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      }
      return new Response(JSON.stringify({
        sha: "cc308c933c496071e93a8a302f1a03c23dc4a4ff",
        html_url: "https://github.com/owner/repo/commit/cc308c933c496071e93a8a302f1a03c23dc4a4ff",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.deepEqual(await service.checkLatest(), {
    currentVersion: "cc308c93",
    ...DEFAULT_UPDATE_DETAILS,
    latestVersion: "cc308c93",
    status: "same",
    releaseURL: "https://github.com/owner/repo/commit/cc308c933c496071e93a8a302f1a03c23dc4a4ff",
    changelogURL: "https://github.com/owner/repo/commit/cc308c933c496071e93a8a302f1a03c23dc4a4ff",
    source: "commit",
  });
  assert.deepEqual(requested, [
    "https://api.github.com/repos/owner/repo/releases/latest",
    "https://api.github.com/repos/owner/repo/commits/main",
  ]);
});
