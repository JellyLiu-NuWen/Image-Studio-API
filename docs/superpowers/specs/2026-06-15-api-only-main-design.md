# Image Studio API-Only Main Design

## Goal

Turn `main` into a focused self-hosted API project for personal and private AI-tool use.

The project should no longer present itself as a maintained Windows, macOS, Linux, Android, Wails, Gio, or Cloudflare distribution. `main` should be the deployable `Image-Studio-API` line:

- private HTTP API for image generation and related OpenAI-compatible routes
- `/admin` configuration and operations console
- Codex skill and portable client scripts for AI agents
- Docker deployment and release-based update flow
- upstream version alignment against `RoseKhlifa/Image-Studio`

## Non-Goals

- No desktop app releases from `main`.
- No Android APK releases from `main`.
- No Gio client releases from `main`.
- No Cloudflare Worker deployment path in `main`.
- No public SaaS/gallery/multi-tenant product work in this phase.
- No browser visual companion or local URL workflow is required for this design.

## Branch Strategy

Use three long-lived lines:

| Branch | Purpose | Maintenance |
|---|---|---|
| `main` | `Image-Studio-API`: self-hosted API, admin console, skills, Docker release | actively maintained |
| `upstream-main` | clean mirror of `RoseKhlifa/Image-Studio` | fast-forward or merge from upstream only |
| `legacy-platforms` | archive of the current fork before API-only cleanup | reference only |

Do not keep platform clients as folders in `main`. Keeping them in the main branch would keep CI, README, release notes, dependency updates, and issue expectations tied to platforms that are no longer product scope.

Before deleting platform code from `main`, create and push `legacy-platforms` from the current full-platform state. That branch is the recovery point for Windows, macOS, Linux, Android, Wails, Gio, Go CLI, and Cloudflare experiments.

## Main Branch Contents

Keep:

- `server/`
- `skills/image-studio-generate/`
- `shared/kernel/`
- `docs/` entries related to self-hosting, API usage, skill usage, deployment, operations, and upstream sync
- `badges/` version metadata
- `scripts/` needed by API CI, Docker release, upstream checks, version badges, and docs maintenance
- `.github/workflows/` needed by API tests, Docker release, upstream checks, and issue/doc checks that still apply
- `docker-compose.self-hosted.yml`
- `README.md`
- `LICENSE`
- `.gitignore`

Remove from `main` after archiving:

- `image-studio/` Wails desktop app
- `android-shell/`
- `gio-client/`
- `go-cli/` unless a small subset is intentionally migrated into `shared/` or `server/`
- `cloudflare-worker/`
- desktop/mobile release scripts
- platform verification workflows
- docs and images that only describe desktop/mobile/cloudflare distribution
- badges that advertise Wails or platform support

## README Positioning

The `README.md` should introduce this fork as `Image-Studio-API`, not as a general Image Studio distribution.

Required README sections:

- project purpose: private self-hosted API for Codex/OpenClaw/DeepSeek/MCP-style callers
- upstream relationship: based on `RoseKhlifa/Image-Studio`, with links to upstream docs instead of copying upstream feature content
- version alignment table: current fork version, upstream version, alignment status
- quick deployment: Docker Compose first, direct Node second
- required secrets: `ADMIN_TOKEN`, `IMAGE_API_TOKEN`, `UPSTREAM_BASE_URL`, `UPSTREAM_API_KEY`
- skill usage: `IMAGE_STUDIO_ENDPOINT`, `IMAGE_STUDIO_API_TOKEN`
- operations roadmap: logs, dashboard, Docker release update flow
- branch policy: `main`, `upstream-main`, `legacy-platforms`
- AGPL license reminder

The platform badges should be removed from `main`. Technical badges should describe the API project only, for example Node, Docker, API, Skill, AGPL.

## Runtime Architecture

```text
Codex / OpenClaw / DeepSeek / MCP / custom AI agent
  -> image-studio-generate skill or HTTP tool
  -> Image Studio API server
  -> server-side upstream API key
  -> OpenAI-compatible image upstream
  -> generated image response
  -> local saved file path or URL returned to caller
```

The upstream model key must remain server-side. Agent clients only receive `IMAGE_API_TOKEN`.

## Server Components

Split the current `server/src/app.js` responsibilities into clearer modules during implementation:

- routing: health, admin config, API proxy, logs, metrics, update endpoints
- auth: admin token and image API token validation
- config store: file-backed config with env fallback
- upstream proxy: request normalization, retries, timeout handling, response forwarding
- generation log store: image request records and outcomes
- API call log store: all authenticated API calls with status and latency
- metrics service: aggregated dashboard numbers
- update service: GitHub Release check and update instruction generation

This keeps the existing lightweight Node service while preventing `app.js` from becoming the whole application.

## Logging And Dashboard

Add persistent local logs under `/data`, because Docker Compose already mounts that volume.

Suggested files:

- `/data/config.json`
- `/data/logs/api-calls.jsonl`
- `/data/logs/generations.jsonl`
- `/data/updates/state.json`

Generation log fields:

- id
- createdAt
- finishedAt
- status: `success`, `failed`, `cancelled`
- caller token fingerprint, never the raw token
- endpoint
- model
- size
- quality
- output format
- prompt preview and prompt hash
- upstream status
- durationMs
- output count
- saved file paths or returned URL count when available
- error summary

API call log fields:

- id
- createdAt
- method
- path
- auth kind: `admin`, `client`, `none`
- caller token fingerprint when authenticated
- status
- durationMs
- request bytes when available
- response bytes when available
- error summary

Dashboard should be part of `/admin`:

- service health and current version
- upstream config status without exposing secrets
- recent generation logs
- recent API calls
- request count and success/error counts
- p50/p95 latency
- active request count
- current concurrency/rate-limit settings
- latest release check result

Keep the first dashboard implementation server-rendered or static HTML with small embedded JavaScript. A full React admin app is unnecessary for the first API-only milestone.

## Performance Improvements

Priority order:

1. Measure first: add per-route latency, upstream latency, active request count, and error counters.
2. Avoid avoidable body buffering for large/streamed responses where possible.
3. Keep concurrency explicit. Default self-use can stay at `1`, but queueing should return clear `429` or optional queued status instead of silent stalls.
4. Cache config reads in memory with safe invalidation on admin save.
5. Add structured JSON logs and bounded retention so dashboard reads do not scan unbounded files.
6. Keep Docker image small and deterministic with production-only dependencies.
7. Add health checks that verify server readiness without hitting paid upstream APIs.

Do not prematurely add Redis, a database, or a job system unless local JSONL logs become a real bottleneck.

## Docker Release And Update Flow

Use GitHub Releases as the public version signal and Docker images as the deployable artifact.

Release flow:

```text
push tag vX.Y.Z
  -> GitHub Actions runs tests
  -> build linux/amd64 Docker image
  -> optionally build linux/arm64 later
  -> push image to ghcr.io/<owner>/image-studio-api:vX.Y.Z
  -> also update ghcr.io/<owner>/image-studio-api:latest when configured
  -> create or update GitHub Release with compose example and changelog
```

Server update flow:

```text
admin clicks/checks update or host updater runs
  -> query GitHub latest release
  -> compare current version to latest release tag
  -> docker compose pull
  -> docker compose up -d
  -> call /healthz
  -> keep new version on success
  -> rollback to previous tag on failure when host updater controls compose
```

The container should not try to replace itself by default. Self-replacement requires Docker socket access, which is powerful and easy to misuse. Prefer a host-side updater script or optional sidecar.

The `YaoPopReleaseManager` reference should influence:

- tag-based release discipline
- suggested next version
- GitHub tag/release triggering
- registry/tag visibility
- post-deploy health verification

This project should start lighter than that tool: one API image, one Compose file, one optional host updater script.

## CI Design

Keep workflows:

- API syntax/test/smoke
- skill script tests
- upstream version check and version badge refresh
- Docker image build on PR/push
- Docker publish on tag

Remove or archive workflows from `main`:

- desktop release
- Windows portable/WebView release
- Android APK release
- Gio release
- platform kernel live verification
- platform packaging verification

API CI should run quickly and deterministically:

```text
npm --prefix server run check
npm --prefix server test
npm --prefix server run smoke
python skills/image-studio-generate/scripts/test_generate_image.py
```

## Version Alignment

The project version should continue to align with the upstream semantic release tag where possible.

Distinguish two values:

- upstream base version: latest upstream `vX.Y.Z`
- API release version: normally the same `vX.Y.Z`; if API-only changes need an extra release before upstream changes, use a suffix or build metadata policy documented before use

For now, keep the simple rule: release tags follow upstream semantic tags. If upstream is `v1.2.5`, API release is `v1.2.5`.

The README version table and `badges/*.json` should be generated, not hand-edited.

## Migration Steps

1. Sync local `main` with remote and protect any current dirty work.
2. Create `legacy-platforms` from the full current tree and push it.
3. Confirm `upstream-main` matches `RoseKhlifa/Image-Studio`.
4. Remove platform directories and platform-only docs from `main`.
5. Remove platform-only workflows and release scripts from `main`.
6. Rewrite README and docs around API-only scope.
7. Refactor `server/` into focused modules without changing public endpoints.
8. Add API and generation logs.
9. Add `/admin` dashboard sections backed by logs and metrics.
10. Add Docker image publish workflow.
11. Add host-side update documentation and optional updater script.
12. Run API, skill, Docker build, and upstream check verification.

## Testing Strategy

Unit tests:

- config normalization and secret preservation
- auth failures and success paths
- request defaults
- retry/error classification
- log redaction and token fingerprinting
- metrics aggregation
- release version comparison

Integration tests:

- `/healthz`
- `/admin`
- `/api/config`
- `/v1/images/generations` against mock upstream
- rate limiting
- concurrency limiting
- log writing and dashboard API reads
- Docker smoke start with mounted `/data`

Manual verification:

- deploy with `docker compose`
- configure `/admin`
- call skill script with local env
- verify logs appear
- verify dashboard counters
- verify release check detects latest GitHub Release

## Risks And Controls

| Risk | Control |
|---|---|
| Accidentally losing platform work | create and push `legacy-platforms` before cleanup |
| Confusing users about upstream features | link upstream docs instead of copying desktop/mobile descriptions |
| Exposing upstream API key | never return raw secrets; log only token fingerprints |
| Container update breaks service | host updater performs health check and can rollback |
| JSONL logs grow forever | add retention limits and dashboard pagination |
| Local branch is behind remote | sync before implementation and avoid mixing stale dirty changes |

## Approval State

The user approved the API-only direction on 2026-06-15.

This design is ready for review. Implementation should start only after the user reviews this spec and approves moving to the implementation plan.
