---
name: image-studio-generate
description: Generate, edit, and improve high-quality images through a private self-hosted Image Studio API. Use when the user asks Codex to create, draw, render, illustrate, make a cover/poster/icon/concept art/product image, edit an existing image, rewrite an image prompt, or optimize poor image-generation results using the user's own Image Studio self-hosted endpoint.
---

# Image Studio Generate

## Overview

Use the bundled script to call a private Image Studio self-hosted API and save generated images locally. The skill expects the service from this repository's `server/` directory, but also works with OpenAI-compatible `/v1/images/generations` and `/v1/images/edits` endpoints that accept Bearer authentication.

Before generating or editing, convert the user's request into a production prompt. For anything more complex than a single obvious subject, read `references/prompt-quality.md` and use its structure.

## Configuration

Require these values before generating:

- `IMAGE_STUDIO_ENDPOINT`: Base URL of the private service, for example `http://43.134.31.179:8787`.
- `IMAGE_STUDIO_API_TOKEN`: client token configured in the admin dashboard as the Skill/API calling key.

Prefer a local private config file when the host environment does not persist variables reliably. The script reads configuration in this order: process environment variables, `IMAGE_STUDIO_CONFIG` file path, `~/.codex/image-studio-generate.env`, `~/.config/image-studio-generate.env`, then Windows user environment variables.

Local config file example:

```env
IMAGE_STUDIO_ENDPOINT=http://SERVER_IP:8787
IMAGE_STUDIO_API_TOKEN=your-skill-calling-key
```

Do not commit the local config file or any real token to GitHub.

Optional environment variables:

- `IMAGE_STUDIO_OUTPUT_DIR`: Local directory for decoded image files. Default: `./outputs/image-studio`.
- `IMAGE_STUDIO_DEFAULT_MODEL`: Override the server default model.
- `IMAGE_STUDIO_DEFAULT_SIZE`: Override the server default size.
- `IMAGE_STUDIO_DEFAULT_QUALITY`: Override the default request quality. The script defaults to `high`; set this to `auto`, `medium`, or a gateway-supported value if cost or compatibility matters more than quality.

Never ask the user for, print, or store the upstream model API key. Only the self-hosted server should know `UPSTREAM_API_KEY`.

The script sends Images API requests with `stream=true` and `partial_images=0` by default. This keeps long image generation and edit jobs active through reverse proxies that otherwise time out after about 60 seconds of silence, while waiting for the final image instead of saving a paid partial preview. Use `--partial-images 1` only when you explicitly need preview events, and use `--no-stream` only when the upstream does not support image streaming.

## Workflow

1. Detect the user's language and target output type: UI, infographic, poster, product, brand, photo realism, illustration, character, scene, document, academic figure, technical diagram, or image edit.
2. Rewrite the request into a production prompt. Preserve user-specified subject, style, composition, text, aspect ratio, colors, and constraints. For complex images, use structured JSON-like prompt text with `type`, `goal`, `subject`, `scene`, `layout`, `style`, `text`, and `constraints`.
3. Ask only when missing information would likely ruin the image: absent subject, missing exact text, conflicting style/use case, or required reference image.
4. Choose quality-forward defaults when the user is underspecified:
   - `size`: `1024x1024` for square assets, `1024x1536` for portrait posters, `1536x1024` for landscape banners when supported; otherwise use the service default.
   - `quality`: `high` unless the user prioritizes speed, cost, or compatibility.
   - `n`: use `1` unless the user explicitly asks for multiple options.
5. Run `scripts/generate_image.py` with the final prompt and any explicit parameters. Use `--prompt-file` for long structured prompts. For image-to-image work, pass one or more `--image` arguments; pass `--mask` only with at least one `--image`.
6. Read the JSON output. When local image files are returned, display them directly in Codex with Markdown image syntax (`![description](absolute/path.png)`) and include the saved file paths only as secondary detail. If only URLs are returned, display or link those URLs. Mention the `metadata_file` path when useful for iteration. If the script returns an error, summarize the server error without exposing tokens.

## Quality Workflow

- Do not send a vague one-liner when the user asks for a polished result. Expand it into subject, composition, lighting, material, palette, visible text, aspect ratio, and negative constraints.
- For UI, infographic, product, academic, technical, and multi-panel images, prefer a structured JSON-like prompt. The JSON is prompt text, not a replacement for the API payload.
- Keep visible text short and exact. State the language and "readable text" requirement when text matters.
- For series or variants, keep one fixed identity/style block and vary only the requested dimensions.
- If the output is poor, inspect the saved metadata and revise the prompt layer that failed instead of rerunning the same request.

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

Generate from a long structured prompt file:

```bash
python skills/image-studio-generate/scripts/generate_image.py \
  --prompt-file ./outputs/image-studio/product-poster-prompt.txt \
  --size 1024x1536 \
  --quality high
```

Edit one image:

```bash
python skills/image-studio-generate/scripts/generate_image.py \
  --prompt "turn this product photo into a clean studio shot" \
  --image ./input/product.png
```

Edit with multiple reference images and a mask:

```bash
python skills/image-studio-generate/scripts/generate_image.py \
  --prompt "combine the bag from the first image with the fabric texture from the second" \
  --image ./input/bag.png \
  --image ./input/fabric.png \
  --mask ./input/mask.png
```

When `--image` is present, the script uses `/v1/images/edits` and sends multipart/form-data. Without `--image`, it uses `/v1/images/generations` and sends JSON.
Do not override `--model` or `IMAGE_STUDIO_DEFAULT_MODEL` just because the request is an edit; the self-hosted service is expected to route GPT Image 2 edits when configured.

Disable streaming for a compatibility-only upstream:

```bash
python skills/image-studio-generate/scripts/generate_image.py \
  --prompt "simple compatibility test" \
  --no-stream
```

The script prints JSON with:

- `ok`: boolean
- `files`: saved local image paths when `b64_json` is returned
- `urls`: remote image URLs when the upstream returns URLs
- `metadata_file`: saved prompt, request payload, mode, returned files/URLs, and compact response metadata; it never stores the API token
- `response`: compact raw response metadata

## Failure Handling

- `401`: The client token is missing or wrong. Tell the user to check `IMAGE_STUDIO_API_TOKEN` and the admin dashboard's Skill/API calling key.
- `400` or `500` mentioning upstream config: Tell the user to open `/admin` and check `UPSTREAM_BASE_URL` and `UPSTREAM_API_KEY`.
- `429`: The service rate limit or concurrency limit was reached. Tell the user to wait or adjust admin settings.
- Network errors: Check that the server is running and reachable at `IMAGE_STUDIO_ENDPOINT`.
