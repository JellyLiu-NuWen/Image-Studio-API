# API-Only Main Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `main` into the API-only `Image-Studio-API` line with self-hosted server, admin console, skills, API logs, dashboard data, and Docker release/update support.

**Architecture:** Keep `server/`, `skills/`, and `shared/kernel/` as the active product. Archive platform clients in `legacy-platforms`, then remove platform code and workflows from `main`. Refactor the Node server into focused modules and add local JSONL logs plus release metadata endpoints without introducing a database.

**Tech Stack:** Node.js 20+/22, native `node:test`, Docker Compose, GitHub Actions, Python stdlib for the skill script, JSONL file storage under `/data`.

---

## Starting Constraints

The current local checkout has dirty and untracked files, and local `main` is both ahead and behind remote. Do not delete or overwrite user work.

The existing dirty files visible at plan time are:

```text
.github/workflows/check-upstream-updates.yml
README.md
badges/version-details.json
image-studio/frontend/package.json
scripts/verify-issue-close-tooling.mjs
scripts/write-version-badges.mjs
image-studio/frontend/scripts/node-ts-loader.mjs
image-studio/frontend/scripts/register-node-ts-loader.mjs
scripts/collect-utf8-output.mjs
scripts/collect-utf8-output.test.mjs
scripts/issue-close-doc-compare.mjs
scripts/issue-close-doc-compare.test.mjs
scripts/write-github-output-from-json.mjs
scripts/write-github-output-from-json.test.mjs
shared/kernel/package.json
```

Before running destructive cleanup tasks, either commit the plan branch and push it, or create a backup branch that includes the current full tree.

## Target File Structure

Active files and directories after cleanup:

```text
.
├── .github/workflows/
│   ├── api-ci.yml
│   ├── check-upstream-updates.yml
│   └── docker-release.yml
├── badges/
│   ├── current-version.json
│   ├── upstream-version.json
│   ├── version-details.json
│   └── version-status.json
├── docs/
│   ├── self-hosted-api.md
│   ├── operations.md
│   ├── docker-updates.md
│   └── superpowers/
├── scripts/
│   ├── check-upstream-updates.mjs
│   ├── write-github-output-from-json.mjs
│   ├── write-version-badges.mjs
│   └── update-compose-image.ps1
├── server/
│   ├── Dockerfile
│   ├── README.md
│   ├── package.json
│   ├── scripts/
│   ├── src/
│   │   ├── adminPage.js
│   │   ├── app.js
│   │   ├── auth.js
│   │   ├── config.js
│   │   ├── http.js
│   │   ├── index.js
│   │   ├── logStore.js
│   │   ├── metrics.js
│   │   ├── updateService.js
│   │   └── upstreamProxy.js
│   └── test/
├── shared/kernel/
├── skills/image-studio-generate/
├── docker-compose.self-hosted.yml
├── .dockerignore
├── .gitignore
├── LICENSE
└── README.md
```

Remove from `main` after `legacy-platforms` exists:

```text
android-shell/
cloudflare-worker/
gio-client/
go-cli/
image-studio/
go.work
go.work.sum
```

Remove platform-only docs and scripts from `main` after checking they are not needed by API workflows:

```text
docs/build.md
docs/cross-platform-kernel-plan.md
docs/features.md
docs/gio-client.md
docs/manual-verification.md
docs/mumu-android-debug.md
docs/packages.md
docs/privacy-policy.md
docs/project-structure.md
docs/showcase.md
docs/troubleshooting.md
docs/usage.md
docs/picture/
scripts/build-windows-portable-fixed-webview.ps1
scripts/build-msix.ps1
scripts/generate-msix-assets.py
scripts/package-local-macos-app.sh
scripts/register-gio-linux-scheme.sh
scripts/sign-windows-binary.ps1
scripts/verify-local-android-shell.mjs
scripts/verify-local-live-verify.mjs
scripts/verify-local-macos-release.mjs
scripts/verify-local-platform-kernel.mjs
```

Keep docs such as `docs/prompt-import.md`, `docs/size-auto.md`, and `docs/no-prompt-revision/README.md` only if README links or API behavior still reference them after the cleanup. Otherwise move their historical copy to `legacy-platforms`.

---

### Task 1: Protect Branches And Sync The Worktree

**Files:**
- No source files modified.
- Uses Git branches and remotes only.

- [ ] **Step 1: Inspect current refs and dirty state**

Run:

```powershell
git status --short --branch --untracked-files=all
git branch -a -vv
git remote -v
```

Expected: output shows `main`, `origin/main`, `origin/upstream-main`, and dirty files. Do not continue if the command fails.

- [ ] **Step 2: Create a safety branch for the current full tree**

Run:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
git branch "backup/api-only-before-cleanup-$stamp"
git branch -vv | Select-String "backup/api-only-before-cleanup-$stamp"
```

Expected: the backup branch exists and points to the current commit.

- [ ] **Step 3: Push the current plan commit before syncing**

Run:

```powershell
git push origin HEAD:main
```

Expected: push succeeds, or Git reports non-fast-forward. If non-fast-forward happens, do not force push; continue to Step 4.

- [ ] **Step 4: Fetch remotes**

Run:

```powershell
git fetch origin --prune
git fetch upstream --prune
```

Expected: both fetches succeed. If `upstream` does not exist, run:

```powershell
git remote add upstream https://github.com/RoseKhlifa/Image-Studio.git
git fetch upstream --prune
```

- [ ] **Step 5: Create or update `legacy-platforms` from the current full-platform tree**

Run:

```powershell
git branch -f legacy-platforms HEAD
git push -u origin legacy-platforms
```

Expected: `legacy-platforms` is available on origin. If push is rejected because the branch exists remotely, inspect before overwriting:

```powershell
git log --oneline --decorate --max-count=5 legacy-platforms
git log --oneline --decorate --max-count=5 origin/legacy-platforms
```

Only use `git push --force-with-lease origin legacy-platforms` after confirming the remote branch is an older archive copy.

- [ ] **Step 6: Confirm `upstream-main` matches upstream**

Run:

```powershell
git rev-parse origin/upstream-main
git rev-parse upstream/main
git log --oneline --left-right --count origin/upstream-main...upstream/main
```

Expected: count is `0 0`, or a small known difference. If it is not `0 0`, update mirror:

```powershell
git checkout upstream-main
git merge --ff-only upstream/main
git push origin upstream-main
git checkout main
```

- [ ] **Step 7: Reconcile local `main` with remote without losing work**

Run:

```powershell
git status --short --branch --untracked-files=all
```

If dirty files block rebase, stash all tracked and untracked changes with:

```powershell
git stash push -u -m "api-only-cleanup-pre-sync"
git pull --rebase origin main
git stash pop
```

Expected: local `main` includes remote commits and the plan commit. If conflicts occur, resolve only in files related to the plan/docs/CI; do not revert user changes silently.

- [ ] **Step 8: Verify branch safety**

Run:

```powershell
git status --short --branch --untracked-files=all
git branch -a -vv
```

Expected: `legacy-platforms` exists locally and remotely, `upstream-main` exists, and `main` is ready for cleanup.

- [ ] **Step 9: Commit only if sync changed files**

If conflict resolution changed tracked files, run:

```powershell
git add README.md .github/workflows/check-upstream-updates.yml scripts/write-version-badges.mjs scripts/verify-issue-close-tooling.mjs
git commit -m "chore: reconcile api-only planning branch"
```

Expected: a commit is created only for real conflict resolution. If no files changed, skip this step.

---

### Task 2: Remove Platform Code From `main`

**Files:**
- Delete: `android-shell/`
- Delete: `cloudflare-worker/`
- Delete: `gio-client/`
- Delete: `go-cli/`
- Delete: `image-studio/`
- Delete: `go.work`
- Delete: `go.work.sum`
- Modify: `.gitignore`
- Modify or delete platform-only docs and scripts listed in the target structure.

- [ ] **Step 1: Verify archive branch before deleting**

Run:

```powershell
git ls-remote --heads origin legacy-platforms
```

Expected: output contains `refs/heads/legacy-platforms`. Stop if empty.

- [ ] **Step 2: Delete platform directories with native PowerShell**

Run:

```powershell
$repo = (Resolve-Path .).Path
$targets = @(
  'android-shell',
  'cloudflare-worker',
  'gio-client',
  'go-cli',
  'image-studio'
)
foreach ($target in $targets) {
  $resolved = Join-Path $repo $target
  if (-not (Resolve-Path -LiteralPath $resolved -ErrorAction SilentlyContinue)) {
    continue
  }
  $full = (Resolve-Path -LiteralPath $resolved).Path
  if (-not $full.StartsWith($repo, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to delete outside repo: $full"
  }
  Remove-Item -LiteralPath $full -Recurse -Force
}
Remove-Item -LiteralPath 'go.work','go.work.sum' -Force -ErrorAction SilentlyContinue
```

Expected: platform directories are removed from the working tree. This command uses one shell and checks paths stay inside the repo.

- [ ] **Step 3: Delete platform workflows**

Run:

```powershell
$workflowTargets = @(
  '.github/workflows/live-verify-platform-kernel.yml',
  '.github/workflows/release.yml',
  '.github/workflows/verify-platform-kernel.yml',
  '.github/workflows/windows-portable-fixed-webview.yml'
)
foreach ($target in $workflowTargets) {
  Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
}
```

Expected: only API-relevant workflows remain.

- [ ] **Step 4: Delete platform scripts**

Run:

```powershell
$scriptTargets = @(
  'scripts/build-windows-portable-fixed-webview.ps1',
  'scripts/build-msix.ps1',
  'scripts/generate-msix-assets.py',
  'scripts/package-local-macos-app.sh',
  'scripts/register-gio-linux-scheme.sh',
  'scripts/sign-windows-binary.ps1',
  'scripts/verify-local-android-shell.mjs',
  'scripts/verify-local-live-verify.mjs',
  'scripts/verify-local-macos-release.mjs',
  'scripts/verify-local-platform-kernel.mjs',
  'scripts/live-verify.mjs',
  'scripts/local-smoke-check.mjs',
  'scripts/runtime-smoke-process.mjs',
  'scripts/runtime-smoke-server.mjs',
  'scripts/render-live-verify-summary.mjs',
  'scripts/render-verify-platform-summary.mjs',
  'scripts/prepare-external-verification-bundle.mjs'
)
foreach ($target in $scriptTargets) {
  Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
}
```

Expected: platform-only scripts are gone. Keep scripts used by upstream checks, version badges, and issue tooling.

- [ ] **Step 5: Delete platform-only docs and media**

Run:

```powershell
$docTargets = @(
  'docs/build.md',
  'docs/cross-platform-kernel-plan.md',
  'docs/features.md',
  'docs/gio-client.md',
  'docs/manual-verification.md',
  'docs/mumu-android-debug.md',
  'docs/packages.md',
  'docs/privacy-policy.md',
  'docs/project-structure.md',
  'docs/showcase.md',
  'docs/troubleshooting.md',
  'docs/usage.md',
  'docs/picture'
)
foreach ($target in $docTargets) {
  Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue
}
```

Expected: docs now describe API-only project plus planning docs.

- [ ] **Step 6: Search for stale platform references**

Run:

```powershell
rg -n "Wails|Android|Gio|Cloudflare|macOS|Windows|Linux|APK|MSIX|WebView|desktop|platform" README.md docs server scripts .github skills
```

Expected: remaining matches are either historical references in the spec/plan, upstream links, or deliberate statements that platform clients were archived.

- [ ] **Step 7: Update `.gitignore` for API-only output**

Modify `.gitignore` so it still ignores Node, Python, Docker, logs, and output directories. Ensure it contains these entries:

```gitignore
node_modules/
.env
.env.*
!.env.example
data/
outputs/
*.log
.DS_Store
Thumbs.db
.tmp/
coverage/
```

Remove ignore entries that only refer to deleted Wails/Android build outputs if they become confusing.

- [ ] **Step 8: Run file inventory check**

Run:

```powershell
rg --files
```

Expected: no files under `android-shell/`, `cloudflare-worker/`, `gio-client/`, `go-cli/`, or `image-studio/`.

- [ ] **Step 9: Commit platform cleanup**

Run:

```powershell
git add -A
git commit -m "chore: archive platform clients from main"
```

Expected: one cleanup commit that removes platform code from `main`.

---

### Task 3: Rewrite API-Only Docs And Badges

**Files:**
- Modify: `README.md`
- Modify: `server/README.md`
- Modify: `docs/self-hosted-api.md`
- Create: `docs/operations.md`
- Create: `docs/docker-updates.md`
- Modify: `scripts/write-version-badges.mjs`
- Modify: `badges/*.json` through script output

- [ ] **Step 1: Update README badges and opening**

Replace the README badge block with API-only badges:

```markdown
![license](https://img.shields.io/badge/license-AGPLv3-b22222)
![node](https://img.shields.io/badge/node-%3E%3D20-43853D)
![docker](https://img.shields.io/badge/docker-self--hosted-2496ED)
![api](https://img.shields.io/badge/API-OpenAI--compatible-111827)
![skill](https://img.shields.io/badge/Codex-skill-6f42c1)
```

Expected: no Wails/platform badge remains.

- [ ] **Step 2: Replace README product scope**

Ensure the README contains this wording near the top:

```markdown
## 这个 fork 想解决什么

这个 fork 的目标是把 Image Studio 整理成一个可以部署在自己服务器上的私有 API 服务。Codex、OpenClaw、DeepSeek、MCP 或其他 AI 工具先理解用户需求，再通过这个服务调用生图接口，最后把图片结果回传给用户。

它不是桌面端、Android 端或 Cloudflare Worker 发行线。那些平台代码已经归档到 `legacy-platforms` 分支；作者原版镜像保留在 `upstream-main` 分支。
```

Expected: README clearly says `main` is API-only.

- [ ] **Step 3: Keep upstream links instead of upstream feature copies**

Ensure README has:

```markdown
## 原项目说明

原项目的桌面端能力、安装包、使用方式、排障说明、赞助信息和完整文档，请直接查看原作者仓库:

- 原作者仓库: [RoseKhlifa/Image-Studio](https://github.com/RoseKhlifa/Image-Studio)
- 原作者 README: [RoseKhlifa/Image-Studio#readme](https://github.com/RoseKhlifa/Image-Studio#readme)
- 原作者 Releases: [RoseKhlifa/Image-Studio Releases](https://github.com/RoseKhlifa/Image-Studio/releases)
- 原作者文档目录: [RoseKhlifa/Image-Studio/tree/main/docs](https://github.com/RoseKhlifa/Image-Studio/tree/main/docs)
```

Expected: no long copied upstream feature list in README.

- [ ] **Step 4: Add branch policy section**

Add:

```markdown
## 分支策略

| 分支 | 用途 |
|---|---|
| `main` | 自托管 API、后台、skills、Docker 发布 |
| `upstream-main` | 原作者仓库镜像，用于版本对齐和同步 |
| `legacy-platforms` | API-only 清理前的全平台 fork 快照 |
```

Expected: users can see where platform code went.

- [ ] **Step 5: Create operations docs**

Create `docs/operations.md` with:

````markdown
# Operations

## Secrets

Do not put `UPSTREAM_API_KEY` into skills, client scripts, screenshots, issue comments, or public docs.

## Recommended Self-Use Settings

| Setting | Value |
|---|---|
| `MAX_CONCURRENT_REQUESTS` | `1` or `2` |
| `RATE_LIMIT_PER_MINUTE` | `5` to `10` |
| `REQUEST_TIMEOUT_SECONDS` | `120` to `300` |

## Logs

Runtime logs are stored under `/data/logs` when Docker Compose is used.

## Health

Use:

```bash
curl http://SERVER_IP:8787/healthz
```

The health check does not call the paid upstream model API.
````

Expected: operations doc covers secrets and health.

- [ ] **Step 6: Create Docker update docs**

Create `docs/docker-updates.md` with:

```markdown
# Docker Release Updates

The recommended update model is host-side:

1. Check the latest GitHub Release.
2. Pull the matching Docker image.
3. Restart with Docker Compose.
4. Call `/healthz`.
5. Roll back to the previous image tag if health fails.

The container does not replace itself by default because mounting the Docker socket into the API container gives that container broad host control.
```

Expected: update approach is documented without promising unsafe self-replacement.

- [ ] **Step 7: Update `server/README.md` and `docs/self-hosted-api.md` links**

Add links to `docs/operations.md` and `docs/docker-updates.md` from both files:

```markdown
更多运维说明见 [docs/operations.md](../docs/operations.md)，Docker 更新说明见 [docs/docker-updates.md](../docs/docker-updates.md)。
```

For `docs/self-hosted-api.md`, use relative links:

```markdown
更多运维说明见 [operations.md](./operations.md)，Docker 更新说明见 [docker-updates.md](./docker-updates.md)。
```

Expected: docs form a coherent API-only set.

- [ ] **Step 8: Update version badge labels**

Modify `scripts/write-version-badges.mjs` so labels are API-only:

```js
await writeBadge(`${outDir}/current-version.json`, {
  schemaVersion: 1,
  label: "API 版本",
  message: currentVersion,
  color: aligned ? "2ea44f" : "d29922"
});
await writeBadge(`${outDir}/upstream-version.json`, {
  schemaVersion: 1,
  label: "作者版本",
  message: upstreamVersion,
  color: "0969da"
});
```

Expected: README table says `我的 API 版本` or `API 版本`, not platform project version.

- [ ] **Step 9: Regenerate badges and README version section**

Run:

```powershell
node scripts/write-version-badges.mjs
```

Expected: `badges/*.json` and README version section update successfully.

- [ ] **Step 10: Verify docs have no stale platform badges**

Run:

```powershell
rg -n "wails|platform-windows|android|macos|windows\\s*\\|" README.md docs badges scripts -i
```

Expected: only branch/archive explanations or upstream links remain.

- [ ] **Step 11: Commit docs update**

Run:

```powershell
git add README.md server/README.md docs/self-hosted-api.md docs/operations.md docs/docker-updates.md scripts/write-version-badges.mjs badges
git commit -m "docs: focus project on api-only self hosting"
```

Expected: docs commit succeeds.

---

### Task 4: Replace Platform CI With API CI

**Files:**
- Create: `.github/workflows/api-ci.yml`
- Create: `.github/workflows/docker-release.yml`
- Modify: `.github/workflows/check-upstream-updates.yml`
- Delete or keep removed in Task 2: platform workflows
- Modify: `server/package.json`

- [ ] **Step 1: Create API CI workflow**

Create `.github/workflows/api-ci.yml`:

```yaml
name: API CI

on:
  pull_request:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Check server syntax
        run: npm --prefix server run check

      - name: Run server tests
        run: npm --prefix server test

      - name: Run server smoke check
        run: npm --prefix server run smoke

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Run skill tests
        run: python skills/image-studio-generate/scripts/test_generate_image.py
```

Expected: workflow covers API and skill tests.

- [ ] **Step 2: Create Docker release workflow**

Create `.github/workflows/docker-release.yml`:

```yaml
name: Docker Release

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:

permissions:
  contents: write
  packages: write

env:
  IMAGE_NAME: ghcr.io/${{ github.repository_owner }}/image-studio-api

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Resolve version
        id: version
        shell: bash
        run: |
          if [[ "${GITHUB_REF}" == refs/tags/* ]]; then
            VERSION="${GITHUB_REF#refs/tags/}"
          else
            VERSION="manual-${GITHUB_SHA::12}"
          fi
          echo "version=${VERSION}" >> "$GITHUB_OUTPUT"

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: server/Dockerfile
          push: true
          tags: |
            ${{ env.IMAGE_NAME }}:${{ steps.version.outputs.version }}
            ${{ env.IMAGE_NAME }}:latest

      - name: Create GitHub Release
        if: startsWith(github.ref, 'refs/tags/')
        uses: softprops/action-gh-release@v2
        with:
          name: ${{ steps.version.outputs.version }}
          tag_name: ${{ steps.version.outputs.version }}
          generate_release_notes: true
```

Expected: tag pushes publish the Docker image and GitHub Release.

- [ ] **Step 3: Add Docker metadata labels to `server/Dockerfile`**

Add after `FROM node:22-alpine`:

```dockerfile
ARG IMAGE_STUDIO_VERSION=dev
LABEL org.opencontainers.image.title="Image Studio API"
LABEL org.opencontainers.image.description="Self-hosted private Image Studio API for AI tools"
LABEL org.opencontainers.image.version=$IMAGE_STUDIO_VERSION
```

Expected: Docker image carries version metadata.

- [ ] **Step 4: Pass Docker version build arg**

In `.github/workflows/docker-release.yml`, add:

```yaml
          build-args: |
            IMAGE_STUDIO_VERSION=${{ steps.version.outputs.version }}
```

inside the `docker/build-push-action` step.

Expected: Docker label version matches release tag.

- [ ] **Step 5: Keep upstream check workflow focused**

Open `.github/workflows/check-upstream-updates.yml` and ensure it only:

```text
checks out repo
adds upstream remote
runs scripts/check-upstream-updates.mjs
runs scripts/write-github-output-from-json.mjs
runs scripts/write-version-badges.mjs
commits badges and README version section
creates/updates upstream-sync issue
```

Expected: no platform workflow dependency remains.

- [ ] **Step 6: Run local CI commands**

Run:

```powershell
npm --prefix server run check
npm --prefix server test
npm --prefix server run smoke
python skills/image-studio-generate/scripts/test_generate_image.py
```

Expected: all commands pass.

- [ ] **Step 7: Validate workflow YAML files are present**

Run:

```powershell
Get-ChildItem -LiteralPath .github/workflows | Select-Object Name
```

Expected: only API-related workflows plus issue tooling if still needed.

- [ ] **Step 8: Commit CI update**

Run:

```powershell
git add .github/workflows server/Dockerfile server/package.json
git commit -m "ci: add api-only test and docker release workflows"
```

Expected: CI commit succeeds.

---

### Task 5: Refactor Server Into Focused Modules

**Files:**
- Modify: `server/src/app.js`
- Create: `server/src/http.js`
- Create: `server/src/auth.js`
- Create: `server/src/upstreamProxy.js`
- Modify: `server/src/index.js`
- Modify: `server/test/app.test.mjs`

- [ ] **Step 1: Write failing tests for exported auth helpers**

Create `server/test/auth.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getBearer, tokenFingerprint } from "../src/auth.js";

test("getBearer extracts bearer token case-insensitively", () => {
  const request = new Request("http://localhost/", {
    headers: { authorization: "Bearer client-token" },
  });
  assert.equal(getBearer(request), "client-token");
});

test("getBearer returns empty string for missing bearer token", () => {
  const request = new Request("http://localhost/");
  assert.equal(getBearer(request), "");
});

test("tokenFingerprint is stable and does not expose raw token", async () => {
  const first = await tokenFingerprint("client-token");
  const second = await tokenFingerprint("client-token");
  assert.equal(first, second);
  assert.match(first, /^tok_[a-f0-9]{16}$/);
  assert.equal(first.includes("client-token"), false);
});
```

- [ ] **Step 2: Run auth tests to verify failure**

Run:

```powershell
npm --prefix server test -- auth.test.mjs
```

Expected: FAIL because `server/src/auth.js` does not exist or exports are missing.

- [ ] **Step 3: Create `server/src/auth.js`**

Add:

```js
import { createHash } from "node:crypto";

export function getBearer(request) {
  const raw = request.headers.get("authorization") || "";
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}

export async function tokenFingerprint(token) {
  const value = String(token || "").trim();
  if (!value) return "";
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `tok_${digest}`;
}

export function isBearerAuthorized(request, expectedToken) {
  const expected = String(expectedToken || "").trim();
  if (!expected) return false;
  return getBearer(request) === expected;
}
```

- [ ] **Step 4: Create `server/src/http.js`**

Move shared response helpers into:

```js
export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

export function methodNotAllowed() {
  return json({ error: { message: "Method not allowed" } }, { status: 405 });
}

export function notFound() {
  return json({ error: { message: "Not found" } }, { status: 404 });
}

export function unauthorized(message) {
  return json({ error: { message } }, { status: 401 });
}

export function tooManyRequests(message) {
  return json({ error: { message } }, {
    status: 429,
    headers: { "retry-after": "60" },
  });
}
```

- [ ] **Step 5: Create `server/src/upstreamProxy.js`**

Move upstream forwarding logic from `app.js` into this file, exporting:

```js
export async function forwardOpenAIPath({ request, config, fetchImpl }) {
  // moved implementation from app.js
}
```

Keep function names and behavior the same:

```text
copyPassthroughHeaders
withGenerationDefaults
readBodyBuffer
resolveMaxAttempts
forwardRawWithRetry
createTimeoutSignal
sleep
```

Only export `forwardOpenAIPath` unless tests require more.

- [ ] **Step 6: Update `server/src/app.js` imports**

Replace local helper definitions with imports:

```js
import { getBearer, isBearerAuthorized } from "./auth.js";
import { json, methodNotAllowed, notFound, tooManyRequests, unauthorized } from "./http.js";
import { mergeConfigUpdate, normalizeConfig, publicConfig } from "./config.js";
import { forwardOpenAIPath } from "./upstreamProxy.js";
```

Implement auth checks:

```js
function requireClientAuth(request, config) {
  if (!config.imageApiToken) return unauthorized("Server is missing IMAGE_API_TOKEN");
  if (!isBearerAuthorized(request, config.imageApiToken)) return unauthorized("Unauthorized");
  return null;
}

function requireAdminAuth(request, adminToken) {
  if (!adminToken) return unauthorized("Server is missing ADMIN_TOKEN");
  if (!isBearerAuthorized(request, adminToken)) return unauthorized("Admin authorization required");
  return null;
}
```

- [ ] **Step 7: Run server tests**

Run:

```powershell
npm --prefix server test
```

Expected: all existing tests and `auth.test.mjs` pass.

- [ ] **Step 8: Run syntax and smoke checks**

Run:

```powershell
npm --prefix server run check
npm --prefix server run smoke
```

Expected: both pass.

- [ ] **Step 9: Commit server refactor**

Run:

```powershell
git add server/src server/test
git commit -m "refactor: split api server modules"
```

Expected: refactor commit succeeds with no behavior change.

---

### Task 6: Add JSONL Logs And Metrics

**Files:**
- Create: `server/src/logStore.js`
- Create: `server/src/metrics.js`
- Modify: `server/src/app.js`
- Modify: `server/src/index.js`
- Create: `server/test/logStore.test.mjs`
- Create: `server/test/metrics.test.mjs`
- Modify: `server/test/app.test.mjs`

- [ ] **Step 1: Write failing log store tests**

Create `server/test/logStore.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJsonlLogStore, sanitizeLogRecord } from "../src/logStore.js";

test("sanitizeLogRecord removes raw token fields", () => {
  const sanitized = sanitizeLogRecord({
    id: "1",
    token: "secret",
    authorization: "Bearer secret",
    nested: { upstreamApiKey: "key" },
    safe: "ok",
  });
  assert.equal(sanitized.token, undefined);
  assert.equal(sanitized.authorization, undefined);
  assert.equal(sanitized.nested.upstreamApiKey, undefined);
  assert.equal(sanitized.safe, "ok");
});

test("jsonl log store appends and reads newest records first", async () => {
  const dir = await mkdtemp(join(tmpdir(), "image-studio-log-"));
  try {
    const store = createJsonlLogStore({ path: join(dir, "api.jsonl"), maxRecords: 10 });
    await store.append({ id: "1", createdAt: "2026-06-15T00:00:00.000Z", value: "first" });
    await store.append({ id: "2", createdAt: "2026-06-15T00:00:01.000Z", value: "second" });
    const records = await store.readRecent(5);
    assert.deepEqual(records.map((item) => item.id), ["2", "1"]);
    const raw = await readFile(join(dir, "api.jsonl"), "utf8");
    assert.match(raw, /"id":"1"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run log tests to verify failure**

Run:

```powershell
npm --prefix server test -- logStore.test.mjs
```

Expected: FAIL because `logStore.js` is missing.

- [ ] **Step 3: Implement `server/src/logStore.js`**

Add:

```js
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const SECRET_KEYS = new Set([
  "token",
  "authorization",
  "upstreamApiKey",
  "imageApiToken",
  "adminToken",
  "apiKey",
]);

export function sanitizeLogRecord(value) {
  if (Array.isArray(value)) return value.map(sanitizeLogRecord);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEYS.has(key)) continue;
    out[key] = sanitizeLogRecord(child);
  }
  return out;
}

export function createJsonlLogStore({ path, maxRecords = 1000 }) {
  if (!path) throw new Error("createJsonlLogStore requires path");

  async function readAll() {
    try {
      const raw = await readFile(path, "utf8");
      return raw.split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async function writeAll(records) {
    await mkdir(dirname(path), { recursive: true });
    const kept = records.slice(-maxRecords);
    const raw = kept.map((record) => JSON.stringify(sanitizeLogRecord(record))).join("\n");
    await writeFile(path, raw ? `${raw}\n` : "", "utf8");
  }

  return {
    async append(record) {
      const records = await readAll();
      records.push(sanitizeLogRecord(record));
      await writeAll(records);
    },
    async readRecent(limit = 50) {
      const max = Math.max(1, Math.min(500, Number(limit) || 50));
      return (await readAll()).slice(-max).reverse();
    },
  };
}

export function createMemoryLogStore() {
  const records = [];
  return {
    async append(record) {
      records.push(sanitizeLogRecord(record));
    },
    async readRecent(limit = 50) {
      return records.slice(-limit).reverse();
    },
  };
}
```

- [ ] **Step 4: Write failing metrics tests**

Create `server/test/metrics.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { summarizeMetrics } from "../src/metrics.js";

test("summarizeMetrics counts calls and computes p95 latency", () => {
  const summary = summarizeMetrics({
    apiCalls: [
      { status: 200, durationMs: 10 },
      { status: 500, durationMs: 100 },
      { status: 200, durationMs: 50 },
    ],
    generations: [
      { status: "success", durationMs: 1000 },
      { status: "failed", durationMs: 2000 },
    ],
    activeRequests: 2,
  });
  assert.equal(summary.api.total, 3);
  assert.equal(summary.api.success, 2);
  assert.equal(summary.api.error, 1);
  assert.equal(summary.api.p50DurationMs, 50);
  assert.equal(summary.api.p95DurationMs, 100);
  assert.equal(summary.generations.total, 2);
  assert.equal(summary.generations.success, 1);
  assert.equal(summary.generations.failed, 1);
  assert.equal(summary.activeRequests, 2);
});
```

- [ ] **Step 5: Implement `server/src/metrics.js`**

Add:

```js
function percentile(values, ratio) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index];
}

export function summarizeMetrics({ apiCalls = [], generations = [], activeRequests = 0 } = {}) {
  const apiDurations = apiCalls.map((item) => Number(item.durationMs));
  const generationDurations = generations.map((item) => Number(item.durationMs));
  return {
    activeRequests,
    api: {
      total: apiCalls.length,
      success: apiCalls.filter((item) => Number(item.status) >= 200 && Number(item.status) < 400).length,
      error: apiCalls.filter((item) => Number(item.status) >= 400).length,
      p50DurationMs: percentile(apiDurations, 0.5),
      p95DurationMs: percentile(apiDurations, 0.95),
    },
    generations: {
      total: generations.length,
      success: generations.filter((item) => item.status === "success").length,
      failed: generations.filter((item) => item.status === "failed").length,
      p50DurationMs: percentile(generationDurations, 0.5),
      p95DurationMs: percentile(generationDurations, 0.95),
    },
  };
}
```

- [ ] **Step 6: Update `createSelfHostedApp` signature**

Modify `server/src/app.js`:

```js
export function createSelfHostedApp({
  store,
  adminToken = process.env.ADMIN_TOKEN || "",
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  apiLogStore = null,
  generationLogStore = null,
} = {}) {
```

Track `activeRequests` as already implemented.

- [ ] **Step 7: Log each handled API request**

In `handle(request)`, wrap route handling with timing:

```js
async function handle(request) {
  const startedAt = now();
  const url = new URL(request.url);
  let response;
  let authKind = "none";
  let errorSummary = "";
  try {
    response = await routeRequest(request, url);
    return response;
  } catch (error) {
    errorSummary = error?.message || String(error);
    throw error;
  } finally {
    if (apiLogStore) {
      await apiLogStore.append({
        id: `${startedAt}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date(startedAt).toISOString(),
        method: request.method,
        path: url.pathname,
        authKind,
        status: response?.status || 500,
        durationMs: now() - startedAt,
        errorSummary,
      });
    }
  }
}
```

Move the existing routing body into `routeRequest(request, url)`. Set `authKind = "admin"` before `/api/config` admin auth, and `authKind = "client"` before `/v1/*` client auth. If JavaScript scoping makes this awkward, define `authKind` in the outer `handle` and mutate it before calling helper branches.

- [ ] **Step 8: Log generation outcomes for `/v1/images/generations` and `/v1/images/edits`**

After `forwardOpenAIPath`, append a generation record when the path starts with `/v1/images/`:

```js
if (generationLogStore && url.pathname.startsWith("/v1/images/")) {
  await generationLogStore.append({
    id: `${startedAt}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(now()).toISOString(),
    status: response.status >= 200 && response.status < 400 ? "success" : "failed",
    endpoint: url.pathname,
    upstreamStatus: response.status,
    durationMs: now() - startedAt,
  });
}
```

If response body parsing is not cheap, do not parse image counts in this task.

- [ ] **Step 9: Add `/api/logs` and `/api/metrics` admin routes**

In `routeRequest`:

```js
if (url.pathname === "/api/logs") {
  const authError = requireAdminAuth(request, adminToken);
  if (authError) return authError;
  const type = url.searchParams.get("type") === "generations" ? "generations" : "api";
  const logStore = type === "generations" ? generationLogStore : apiLogStore;
  return json({ records: logStore ? await logStore.readRecent(100) : [] });
}

if (url.pathname === "/api/metrics") {
  const authError = requireAdminAuth(request, adminToken);
  if (authError) return authError;
  const apiCalls = apiLogStore ? await apiLogStore.readRecent(500) : [];
  const generations = generationLogStore ? await generationLogStore.readRecent(500) : [];
  return json({ metrics: summarizeMetrics({ apiCalls, generations, activeRequests }) });
}
```

Import `summarizeMetrics`.

- [ ] **Step 10: Wire file log stores in `server/src/index.js`**

Add:

```js
import { dirname, join } from "node:path";
import { createJsonlLogStore } from "./logStore.js";
```

After resolving `configPath`:

```js
const dataDir = dirname(configPath);
const apiLogStore = createJsonlLogStore({ path: join(dataDir, "logs", "api-calls.jsonl") });
const generationLogStore = createJsonlLogStore({ path: join(dataDir, "logs", "generations.jsonl") });
```

Pass to `createSelfHostedApp`.

- [ ] **Step 11: Add app tests for logs and metrics**

Append to `server/test/app.test.mjs`:

```js
function memoryLogStore() {
  const records = [];
  return {
    async append(record) {
      records.push(record);
    },
    async readRecent(limit = 50) {
      return records.slice(-limit).reverse();
    },
    records,
  };
}

test("admin can read api logs and metrics", async () => {
  const apiLogStore = memoryLogStore();
  const generationLogStore = memoryLogStore();
  const app = createSelfHostedApp({
    store: memoryStore({
      imageApiToken: "client-token",
      upstreamBaseURL: "https://upstream.example",
      upstreamApiKey: "upstream-key",
    }),
    adminToken: "admin-token",
    apiLogStore,
    generationLogStore,
    fetchImpl: async () => new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });

  await app.handle(jsonRequest("/v1/images/generations", { prompt: "log me" }, {
    authorization: "Bearer client-token",
  }));

  const logs = await app.handle(new Request("http://localhost/api/logs?type=generations", {
    headers: { authorization: "Bearer admin-token" },
  }));
  assert.equal(logs.status, 200);
  assert.equal((await logs.json()).records.length, 1);

  const metrics = await app.handle(new Request("http://localhost/api/metrics", {
    headers: { authorization: "Bearer admin-token" },
  }));
  assert.equal(metrics.status, 200);
  assert.equal((await metrics.json()).metrics.generations.total, 1);
});
```

- [ ] **Step 12: Run tests**

Run:

```powershell
npm --prefix server test
npm --prefix server run smoke
```

Expected: tests and smoke pass.

- [ ] **Step 13: Commit logs and metrics**

Run:

```powershell
git add server/src server/test
git commit -m "feat: add api logs and metrics"
```

Expected: commit succeeds.

---

### Task 7: Add Admin Dashboard Sections

**Files:**
- Modify: `server/src/adminPage.js`
- Modify: `server/test/app.test.mjs`
- Optionally create: `server/test/adminPage.test.mjs`

- [ ] **Step 1: Add admin page render test**

Create `server/test/adminPage.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { renderAdminPage } from "../src/adminPage.js";

test("admin page includes dashboard panels", () => {
  const html = renderAdminPage();
  assert.match(html, /id="metricsPanel"/);
  assert.match(html, /id="generationLogs"/);
  assert.match(html, /id="apiLogs"/);
  assert.match(html, /id="updateStatus"/);
});
```

- [ ] **Step 2: Run admin page test to verify failure**

Run:

```powershell
npm --prefix server test -- adminPage.test.mjs
```

Expected: FAIL because dashboard panel ids are not present.

- [ ] **Step 3: Add dashboard layout to `renderAdminPage`**

In `server/src/adminPage.js`, after the config form, add:

```html
<section class="dashboard">
  <h2>Dashboard</h2>
  <div id="metricsPanel" class="panel"></div>
  <div class="log-grid">
    <section class="panel">
      <h3>Generation Logs</h3>
      <div id="generationLogs"></div>
    </section>
    <section class="panel">
      <h3>API Logs</h3>
      <div id="apiLogs"></div>
    </section>
  </div>
  <section class="panel">
    <h3>Updates</h3>
    <div id="updateStatus"></div>
  </section>
</section>
```

Add CSS:

```css
.dashboard {
  margin-top: 24px;
  display: grid;
  gap: 16px;
}
.dashboard h2, .dashboard h3 {
  margin: 0 0 10px;
}
.panel {
  border: 1px solid #d8d8d0;
  border-radius: 8px;
  padding: 14px;
  background: #fbfbf8;
}
.log-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.log-row {
  display: grid;
  gap: 2px;
  padding: 8px 0;
  border-top: 1px solid #e6e6df;
  font-size: 12px;
}
@media (max-width: 720px) {
  .log-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Add dashboard JavaScript**

Inside the existing `<script>`, add:

```js
async function fetchAdminJSON(path) {
  const response = await fetch(path, { headers: tokenHeader() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "Request failed.");
  return data;
}

function renderMetrics(metrics) {
  document.getElementById("metricsPanel").innerHTML = [
    "Active: " + metrics.activeRequests,
    "API total: " + metrics.api.total,
    "API errors: " + metrics.api.error,
    "API p95: " + metrics.api.p95DurationMs + "ms",
    "Generations: " + metrics.generations.total,
    "Generation failures: " + metrics.generations.failed
  ].map((item) => "<div>" + item + "</div>").join("");
}

function renderRows(id, records) {
  const el = document.getElementById(id);
  if (!records.length) {
    el.textContent = "No records yet.";
    return;
  }
  el.innerHTML = records.slice(0, 20).map((record) => {
    const status = record.status || record.upstreamStatus || "";
    const path = record.path || record.endpoint || "";
    const duration = record.durationMs === undefined ? "" : record.durationMs + "ms";
    return "<div class='log-row'><strong>" + status + " " + path + "</strong><span>" + (record.createdAt || "") + " · " + duration + "</span></div>";
  }).join("");
}

async function loadDashboard() {
  if (!adminTokenEl.value.trim()) return;
  try {
    const metrics = await fetchAdminJSON("/api/metrics");
    renderMetrics(metrics.metrics);
    const generationLogs = await fetchAdminJSON("/api/logs?type=generations");
    renderRows("generationLogs", generationLogs.records || []);
    const apiLogs = await fetchAdminJSON("/api/logs?type=api");
    renderRows("apiLogs", apiLogs.records || []);
  } catch (error) {
    document.getElementById("metricsPanel").textContent = error.message;
  }
}
```

Call `loadDashboard()` at the end of `loadConfig()` after status is set to loaded.

- [ ] **Step 5: Add dashboard refresh button**

Add button next to existing actions:

```html
<button type="button" class="secondary" id="dashboardBtn">Refresh Dashboard</button>
```

Add listener:

```js
document.getElementById("dashboardBtn").addEventListener("click", loadDashboard);
```

- [ ] **Step 6: Run admin page test**

Run:

```powershell
npm --prefix server test -- adminPage.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Run full server tests and smoke**

Run:

```powershell
npm --prefix server test
npm --prefix server run smoke
```

Expected: PASS.

- [ ] **Step 8: Commit dashboard**

Run:

```powershell
git add server/src/adminPage.js server/test
git commit -m "feat: add admin dashboard panels"
```

Expected: commit succeeds.

---

### Task 8: Add Release Check And Host Update Script

**Files:**
- Create: `server/src/updateService.js`
- Modify: `server/src/app.js`
- Modify: `server/src/index.js`
- Create: `server/test/updateService.test.mjs`
- Create: `scripts/update-compose-image.ps1`
- Modify: `docs/docker-updates.md`

- [ ] **Step 1: Write release comparison tests**

Create `server/test/updateService.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { compareReleaseVersions, createUpdateService } from "../src/updateService.js";

test("compareReleaseVersions detects newer semver tag", () => {
  assert.equal(compareReleaseVersions("v1.2.5", "v1.2.6"), "newer");
  assert.equal(compareReleaseVersions("v1.2.5", "v1.2.5"), "same");
  assert.equal(compareReleaseVersions("v1.2.6", "v1.2.5"), "older");
});

test("update service reads latest GitHub release", async () => {
  const service = createUpdateService({
    currentVersion: "v1.2.5",
    repository: "owner/repo",
    fetchImpl: async (url) => {
      assert.equal(String(url), "https://api.github.com/repos/owner/repo/releases/latest");
      return new Response(JSON.stringify({
        tag_name: "v1.2.6",
        html_url: "https://github.com/owner/repo/releases/tag/v1.2.6",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.deepEqual(await service.checkLatest(), {
    currentVersion: "v1.2.5",
    latestVersion: "v1.2.6",
    status: "newer",
    releaseURL: "https://github.com/owner/repo/releases/tag/v1.2.6",
  });
});
```

- [ ] **Step 2: Run update tests to verify failure**

Run:

```powershell
npm --prefix server test -- updateService.test.mjs
```

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement `server/src/updateService.js`**

Add:

```js
function parseSemver(tag) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(tag || "").trim());
  if (!match) return null;
  return match.slice(1).map(Number);
}

export function compareReleaseVersions(current, latest) {
  const left = parseSemver(current);
  const right = parseSemver(latest);
  if (!left || !right) return "unknown";
  for (let index = 0; index < 3; index += 1) {
    if (right[index] > left[index]) return "newer";
    if (right[index] < left[index]) return "older";
  }
  return "same";
}

export function createUpdateService({
  currentVersion = process.env.IMAGE_STUDIO_VERSION || "dev",
  repository = process.env.IMAGE_STUDIO_GITHUB_REPOSITORY || "",
  fetchImpl = globalThis.fetch,
} = {}) {
  return {
    async checkLatest() {
      if (!repository) {
        return {
          currentVersion,
          latestVersion: "",
          status: "unconfigured",
          releaseURL: "",
        };
      }
      const response = await fetchImpl(`https://api.github.com/repos/${repository}/releases/latest`, {
        headers: { accept: "application/vnd.github+json" },
      });
      if (!response.ok) {
        return {
          currentVersion,
          latestVersion: "",
          status: "error",
          releaseURL: "",
        };
      }
      const data = await response.json();
      const latestVersion = data.tag_name || "";
      return {
        currentVersion,
        latestVersion,
        status: compareReleaseVersions(currentVersion, latestVersion),
        releaseURL: data.html_url || "",
      };
    },
  };
}
```

- [ ] **Step 4: Add admin update route**

In `createSelfHostedApp` signature add:

```js
  updateService = null,
```

Add route:

```js
if (url.pathname === "/api/update/check") {
  const authError = requireAdminAuth(request, adminToken);
  if (authError) return authError;
  if (!updateService) {
    return json({ update: { status: "unconfigured" } });
  }
  return json({ update: await updateService.checkLatest() });
}
```

- [ ] **Step 5: Wire update service in `server/src/index.js`**

Import:

```js
import { createUpdateService } from "./updateService.js";
```

Create:

```js
const updateService = createUpdateService({
  currentVersion: process.env.IMAGE_STUDIO_VERSION || "dev",
  repository: process.env.IMAGE_STUDIO_GITHUB_REPOSITORY || "",
  fetchImpl: globalThis.fetch,
});
```

Pass into `createSelfHostedApp`.

- [ ] **Step 6: Update admin page to show update result**

Add to `server/src/adminPage.js`:

```js
async function checkUpdate() {
  if (!adminTokenEl.value.trim()) return;
  try {
    const data = await fetchAdminJSON("/api/update/check");
    const update = data.update || {};
    document.getElementById("updateStatus").textContent =
      "Current: " + (update.currentVersion || "") +
      " · Latest: " + (update.latestVersion || "") +
      " · Status: " + (update.status || "");
  } catch (error) {
    document.getElementById("updateStatus").textContent = error.message;
  }
}
```

Call `checkUpdate()` inside `loadDashboard()`.

- [ ] **Step 7: Create host updater script**

Create `scripts/update-compose-image.ps1`:

```powershell
param(
  [Parameter(Mandatory = $true)]
  [string]$ComposeFile,

  [Parameter(Mandatory = $true)]
  [string]$Image,

  [Parameter(Mandatory = $true)]
  [string]$Tag,

  [string]$HealthUrl = "http://127.0.0.1:8787/healthz"
)

$ErrorActionPreference = "Stop"
$composePath = (Resolve-Path -LiteralPath $ComposeFile).Path
$root = Split-Path -Parent $composePath

Push-Location $root
try {
  docker compose -f $composePath pull
  docker compose -f $composePath up -d
  Start-Sleep -Seconds 3
  $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 15
  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
    throw "Health check failed with status $($response.StatusCode)"
  }
  Write-Host "Updated $Image:$Tag and health check passed."
} finally {
  Pop-Location
}
```

This script intentionally does not edit Compose YAML yet; it assumes the operator has updated `image:` or uses a pinned env var. Add YAML editing only in a later task if needed.

- [ ] **Step 8: Expand Docker update docs**

Add to `docs/docker-updates.md`:

````markdown
## Host Script

```powershell
scripts/update-compose-image.ps1 `
  -ComposeFile docker-compose.self-hosted.yml `
  -Image ghcr.io/OWNER/image-studio-api `
  -Tag v1.2.5 `
  -HealthUrl http://127.0.0.1:8787/healthz
```

The script pulls and restarts Compose, then checks `/healthz`.
````

- [ ] **Step 9: Run update tests and full server tests**

Run:

```powershell
npm --prefix server test
npm --prefix server run smoke
```

Expected: PASS.

- [ ] **Step 10: Commit update support**

Run:

```powershell
git add server/src server/test scripts/update-compose-image.ps1 docs/docker-updates.md
git commit -m "feat: add release check and docker update docs"
```

Expected: commit succeeds.

---

### Task 9: Final Verification And Push

**Files:**
- Modify only if verification finds issues.

- [ ] **Step 1: Run full local verification**

Run:

```powershell
npm --prefix server run check
npm --prefix server test
npm --prefix server run smoke
python skills/image-studio-generate/scripts/test_generate_image.py
node scripts/check-upstream-updates.mjs
node scripts/write-version-badges.mjs
```

Expected: all commands pass. `check-upstream-updates.mjs` may fetch remotes and print JSON.

- [ ] **Step 2: Run Docker build**

Run:

```powershell
docker build -f server/Dockerfile -t image-studio-api:local .
```

Expected: image builds successfully.

- [ ] **Step 3: Run Docker Compose smoke if Docker is available**

Create a temporary env file:

```powershell
@'
ADMIN_TOKEN=admin-token
IMAGE_API_TOKEN=client-token
UPSTREAM_BASE_URL=https://upstream.example/v1
UPSTREAM_API_KEY=upstream-key
PORT=8787
'@ | Set-Content -LiteralPath server/.env.local-smoke -Encoding ASCII
```

Temporarily run with the env file by setting `ENV_FILE` if supported, or copy to `server/.env` after backing up an existing one:

```powershell
if (Test-Path server/.env) { Copy-Item server/.env server/.env.backup-api-only-smoke -Force }
Copy-Item server/.env.local-smoke server/.env -Force
docker compose -f docker-compose.self-hosted.yml up -d --build
Invoke-WebRequest -Uri http://127.0.0.1:8787/healthz -UseBasicParsing
docker compose -f docker-compose.self-hosted.yml down
if (Test-Path server/.env.backup-api-only-smoke) { Move-Item server/.env.backup-api-only-smoke server/.env -Force }
Remove-Item server/.env.local-smoke -Force -ErrorAction SilentlyContinue
```

Expected: `/healthz` returns 200.

- [ ] **Step 4: Search for stale removed directories**

Run:

```powershell
rg -n "android-shell|cloudflare-worker|gio-client|go-cli|image-studio/frontend|wails|msix|apk|webview" README.md docs scripts server .github skills -i
```

Expected: matches only appear in specs/plans or archive explanations.

- [ ] **Step 5: Inspect final status**

Run:

```powershell
git status --short --branch --untracked-files=all
git log --oneline --decorate --max-count=12
```

Expected: clean working tree except intentional generated files already committed.

- [ ] **Step 6: Push branch**

Run:

```powershell
git push origin main
```

Expected: push succeeds. If non-fast-forward occurs, fetch and rebase rather than force pushing:

```powershell
git fetch origin --prune
git pull --rebase origin main
git push origin main
```

- [ ] **Step 7: Watch GitHub Actions**

Run:

```powershell
gh run list --limit 5
```

Expected: `API CI` and upstream check workflows appear. If `gh` is unavailable, check GitHub manually.

- [ ] **Step 8: Fix CI failures with focused commits**

If CI fails, inspect logs:

```powershell
gh run view --log-failed
```

Make the smallest fix, run the matching local command, then commit:

```powershell
git add <fixed-files>
git commit -m "ci: fix api-only workflow"
git push origin main
```

Expected: CI turns green.

---

## Self-Review Checklist

- Spec coverage: Tasks cover branch strategy, main cleanup, README/docs, CI, server module split, logs, metrics, admin dashboard, release check, Docker update docs, and final verification.
- Placeholder scan: No unresolved placeholders or vague unbounded steps remain.
- Type consistency: Planned module exports are `getBearer`, `tokenFingerprint`, `isBearerAuthorized`, `json`, `methodNotAllowed`, `notFound`, `unauthorized`, `tooManyRequests`, `forwardOpenAIPath`, `createJsonlLogStore`, `createMemoryLogStore`, `sanitizeLogRecord`, `summarizeMetrics`, `compareReleaseVersions`, and `createUpdateService`.
- Execution safety: Destructive directory removal is gated by `legacy-platforms` remote confirmation and PowerShell path checks.
