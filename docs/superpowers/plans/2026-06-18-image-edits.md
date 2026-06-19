# Image Edits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-image and mask image-to-image support to the Image Studio client script.

**Architecture:** The Python script remains the single CLI entry point. It chooses JSON `/v1/images/generations` for text-only requests and multipart `/v1/images/edits` when `--image` is provided. The Node server remains a raw OpenAI-compatible proxy, with tests locking down multipart forwarding.

**Tech Stack:** Python standard library `urllib`, `http.server`, `unittest`; Node 20 `node:test`; existing Image Studio self-hosted API.

---

### Task 1: Python CLI Image Edit Mode

**Files:**
- Modify: `skills/image-studio-generate/scripts/test_generate_image.py`
- Modify: `skills/image-studio-generate/scripts/generate_image.py`

- [ ] **Step 1: Write the failing test**

Add a test that runs `generate_image.py --prompt ... --image a.png --image b.png --mask mask.png` against the local test server and asserts the request path is `/v1/images/edits`, the request is multipart, and the fields include two `image[]` files, one `mask` file, and the prompt.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
python skills/image-studio-generate/scripts/test_generate_image.py
```

Expected: failure because `--image` and `--mask` are not recognized yet.

- [ ] **Step 3: Implement multipart mode**

Add repeated `--image`, optional `--mask`, file validation, multipart body construction, and routing to `/v1/images/edits` when images are present.

- [ ] **Step 4: Run Python tests**

Run:

```bash
python skills/image-studio-generate/scripts/test_generate_image.py
```

Expected: all tests pass.

### Task 2: Server Multipart Edit Proxy Regression

**Files:**
- Modify: `server/test/app.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a Node test that posts multipart data to `/v1/images/edits`, authenticates with the client token, and asserts the upstream receives `/v1/images/edits`, the server-side upstream bearer token, and the multipart content type/body.

- [ ] **Step 2: Run test to verify it fails if route behavior regresses**

Run:

```bash
npm --prefix server test
```

Expected before implementation: current proxy may pass; if so, the test documents existing server support. The Python CLI test remains the required red test for the feature.

- [ ] **Step 3: Keep server implementation unchanged unless the test exposes a real gap**

The server already forwards non-JSON bodies unchanged through `forwardOpenAIPath`.

- [ ] **Step 4: Run Node tests**

Run:

```bash
npm --prefix server test
```

Expected: all tests pass.

### Task 3: Documentation

**Files:**
- Modify: `skills/image-studio-generate/SKILL.md`
- Modify: `server/README.md`
- Modify: `docs/self-hosted-api.md`

- [ ] **Step 1: Document edit examples**

Add concise examples for `--image`, repeated `--image`, and `--mask`.

- [ ] **Step 2: Run final verification**

Run:

```bash
python skills/image-studio-generate/scripts/test_generate_image.py
npm --prefix server test
```

Expected: both commands exit 0.
