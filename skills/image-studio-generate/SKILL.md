---
name: image-studio-generate
description: Generate images through a private self-hosted Image Studio API. Use when the user asks Codex to create, draw, render, illustrate, make a cover/poster/icon/concept art/product image, or otherwise produce a new image using the user's own Image Studio self-hosted endpoint.
---

# Image Studio Generate

## Overview

Use the bundled script to call a private Image Studio self-hosted API and save generated images locally. The skill expects the service from this repository's `server/` directory, but also works with OpenAI-compatible `/v1/images/generations` endpoints that accept Bearer authentication.

## Configuration

Require these environment variables before generating:

- `IMAGE_STUDIO_ENDPOINT`: Base URL of the private service, for example `http://43.134.31.179:8787`.
- `IMAGE_STUDIO_API_TOKEN`: Client token configured as `IMAGE_API_TOKEN` on the server.

Optional environment variables:

- `IMAGE_STUDIO_OUTPUT_DIR`: Local directory for decoded image files. Default: `./outputs/image-studio`.
- `IMAGE_STUDIO_DEFAULT_MODEL`: Override the server default model.
- `IMAGE_STUDIO_DEFAULT_SIZE`: Override the server default size.
- `IMAGE_STUDIO_DEFAULT_QUALITY`: Override the server default quality.

Never ask the user for, print, or store the upstream model API key. Only the self-hosted server should know `UPSTREAM_API_KEY`.

## Workflow

1. Restate the image intent internally as a concise production prompt. Preserve user-specified subject, style, composition, text, aspect ratio, colors, and constraints.
2. Choose practical defaults when the user is underspecified:
   - `size`: use the service default unless the user asks for a clear aspect ratio.
   - `quality`: use the service default.
   - `n`: use `1` unless the user explicitly asks for multiple options.
3. Run `scripts/generate_image.py` with the prompt and any explicit parameters.
4. Read the JSON output. Report saved file paths or returned image URLs. If the script returns an error, summarize the server error without exposing tokens.

## Commands

Generate one image:

```bash
python skills/image-studio-generate/scripts/generate_image.py --prompt "a ceramic tea cup on a walnut desk, soft morning light"
```

Generate with explicit options:

```bash
python skills/image-studio-generate/scripts/generate_image.py \
  --prompt "minimal black and gold app icon for Image Studio" \
  --size 1024x1024 \
  --quality high \
  --output-dir ./outputs/icons
```

The script prints JSON with:

- `ok`: boolean
- `files`: saved local image paths when `b64_json` is returned
- `urls`: remote image URLs when the upstream returns URLs
- `response`: compact raw response metadata

## Failure Handling

- `401`: The client token is missing or wrong. Tell the user to check `IMAGE_STUDIO_API_TOKEN` and the server `IMAGE_API_TOKEN`.
- `400` or `500` mentioning upstream config: Tell the user to open `/admin` and check `UPSTREAM_BASE_URL` and `UPSTREAM_API_KEY`.
- `429`: The service rate limit or concurrency limit was reached. Tell the user to wait or adjust admin settings.
- Network errors: Check that the server is running and reachable at `IMAGE_STUDIO_ENDPOINT`.
