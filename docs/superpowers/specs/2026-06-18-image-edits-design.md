# Image Edits Design

## Goal

Add image-to-image support to the bundled Image Studio client flow while preserving the existing text-to-image command.

## Design

`skills/image-studio-generate/scripts/generate_image.py` keeps its current text-to-image behavior when no input image is provided. When one or more `--image` arguments are present, the script switches to `POST /v1/images/edits` and sends a multipart/form-data request with repeated `image[]` fields, an optional `mask` file, and the existing prompt/model/size/quality/output settings.

The self-hosted server already exposes `/v1/images/edits` and forwards non-JSON bodies unchanged. A server regression test will lock down that multipart edit requests are accepted, authenticated with the client token, forwarded with the upstream API key, and logged as generation activity.

## Interface

Examples:

```bash
python skills/image-studio-generate/scripts/generate_image.py --prompt "make this rainy" --image input.png
python skills/image-studio-generate/scripts/generate_image.py --prompt "combine styles" --image a.png --image b.png --mask mask.png
```

## Testing

- Python script test verifies multi-image and mask requests use `/v1/images/edits` and include multipart fields.
- Existing Python script tests continue to verify text-to-image uses `/v1/images/generations`.
- Node server test verifies multipart `/v1/images/edits` proxy behavior.
