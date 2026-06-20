#!/usr/bin/env python3
import argparse
import base64
import json
import mimetypes
import os
import sys
import time
import uuid
import urllib.error
import urllib.request
from http.client import IncompleteRead
from pathlib import Path


DEFAULT_QUALITY = "high"
DEFAULT_STREAM = True
DEFAULT_PARTIAL_IMAGES = 1


def read_config_file():
    candidates = []
    configured = os.environ.get("IMAGE_STUDIO_CONFIG", "").strip()
    if configured:
        candidates.append(Path(configured))
    home = Path.home()
    candidates.extend(
        [
            home / ".codex" / "image-studio-generate.env",
            home / ".config" / "image-studio-generate.env",
        ]
    )

    values = {}
    for path in candidates:
        if not path.is_file():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip("\"'")
        break
    return values


CONFIG = read_config_file()


def env(name, default=""):
    return os.environ.get(name, CONFIG.get(name, default)).strip()


def windows_user_env(name):
    if os.name != "nt":
        return ""
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            value, _value_type = winreg.QueryValueEx(key, name)
            return str(value).strip()
    except Exception:
        return ""


def config_value(name, default=""):
    return env(name, windows_user_env(name) or default)


def fail(message, status=None, raw=None):
    payload = {"ok": False, "error": {"message": message}}
    if status is not None:
        payload["error"]["status"] = status
    if raw:
        payload["error"]["raw"] = raw[:1500]
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 1


def detect_extension(item):
    if item.get("mime_type"):
        return mimetypes.guess_extension(item["mime_type"]) or ".png"
    if item.get("output_format"):
        return "." + str(item["output_format"]).strip().lstrip(".")
    return ".png"


def decode_images(data, output_dir, prefix):
    output_dir.mkdir(parents=True, exist_ok=True)
    files = []
    for index, item in enumerate(data.get("data", []), start=1):
        encoded = item.get("b64_json")
        if not encoded:
            continue
        extension = detect_extension(item)
        path = output_dir / f"{prefix}-{index}{extension}"
        path.write_bytes(base64.b64decode(encoded))
        files.append(str(path.resolve()))
    return files


def collect_urls(data):
    urls = []
    for item in data.get("data", []):
        if item.get("url"):
            urls.append(item["url"])
    return urls


def build_payload(args):
    payload = {
        "prompt": args.prompt,
        "n": args.n,
    }
    model = args.model or env("IMAGE_STUDIO_DEFAULT_MODEL")
    size = args.size or env("IMAGE_STUDIO_DEFAULT_SIZE")
    quality = args.quality or env("IMAGE_STUDIO_DEFAULT_QUALITY", DEFAULT_QUALITY)
    output_format = args.output_format
    if model:
        payload["model"] = model
    if size:
        payload["size"] = size
    if quality:
        payload["quality"] = quality
    if output_format:
        payload["output_format"] = output_format
    if args.response_format:
        payload["response_format"] = args.response_format
    if args.stream:
        payload["stream"] = True
        payload["partial_images"] = args.partial_images
    return payload


def build_form_fields(args):
    fields = {
        "prompt": args.prompt,
        "n": str(args.n),
    }
    model = args.model or env("IMAGE_STUDIO_DEFAULT_MODEL")
    size = args.size or env("IMAGE_STUDIO_DEFAULT_SIZE")
    quality = args.quality or env("IMAGE_STUDIO_DEFAULT_QUALITY", DEFAULT_QUALITY)
    output_format = args.output_format
    if model:
        fields["model"] = model
    if size:
        fields["size"] = size
    if quality:
        fields["quality"] = quality
    if output_format:
        fields["output_format"] = output_format
    if args.response_format:
        fields["response_format"] = args.response_format
    if args.stream:
        fields["stream"] = "true"
        fields["partial_images"] = str(args.partial_images)
    return fields


def resolve_prompt(args):
    if args.prompt_file:
        return Path(args.prompt_file).read_text(encoding="utf-8").strip()
    return args.prompt.strip()


def write_metadata(output_dir, prefix, mode, prompt, payload, response_metadata, files, urls):
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"{prefix}.json"
    metadata = {
        "created_at": int(time.time()),
        "mode": mode,
        "prompt": prompt,
        "payload": payload,
        "files": files,
        "urls": urls,
        "response": response_metadata,
    }
    path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(path.resolve())


def event_image_item(event):
    if not isinstance(event, dict):
        return None
    item = event.get("item")
    if isinstance(item, dict) and item.get("result"):
        return {
            "b64_json": item.get("result"),
            "mime_type": item.get("mime_type") or event.get("mime_type"),
            "output_format": item.get("output_format") or event.get("output_format"),
        }
    for key in ["b64_json", "result", "image_b64", "partial_image_b64"]:
        if event.get(key):
            return {
                "b64_json": event.get(key),
                "mime_type": event.get("mime_type"),
                "output_format": event.get("output_format"),
            }
    data = event.get("data")
    if isinstance(data, list):
        for child in data:
            item = event_image_item(child)
            if item:
                return item
    return None


def parse_sse_image_response(raw):
    completed = []
    partials = []
    errors = []
    for line in str(raw or "").splitlines():
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            continue
        if isinstance(event, dict) and isinstance(event.get("error"), dict):
            errors.append(event["error"])
            continue
        event_type = str(event.get("type") or "")
        item = event_image_item(event)
        if not item:
            continue
        if "partial" in event_type:
            partials.append(item)
        else:
            completed.append(item)
    return {
        "data": completed or partials,
        "_stream": {
            "partial_count": len(partials),
            "completed_count": len(completed),
            "errors": errors,
        },
    }


def stream_error(data):
    stream_meta = data.get("_stream") if isinstance(data.get("_stream"), dict) else {}
    errors = stream_meta.get("errors")
    if not isinstance(errors, list) or not errors:
        return None
    error = errors[-1] if isinstance(errors[-1], dict) else {}
    return {
        "message": str(error.get("message") or "Image API stream returned an error event."),
        "status": error.get("upstreamStatus") or error.get("status"),
    }


def guess_content_type(path):
    return mimetypes.guess_type(str(path))[0] or "application/octet-stream"


def validate_file(path_value, label):
    path = Path(path_value)
    if not path.is_file():
        raise FileNotFoundError(f"{label} file not found: {path}")
    return path


def multipart_escape(value):
    return str(value).replace("\\", "\\\\").replace('"', '\\"')


def build_multipart_body(fields, files):
    boundary = f"image-studio-{uuid.uuid4().hex}"
    chunks = []
    for name, path in files:
        chunks.extend([
            f"--{boundary}\r\n".encode("utf-8"),
            (
                "Content-Disposition: form-data; "
                f'name="{multipart_escape(name)}"; filename="{multipart_escape(path.name)}"\r\n'
            ).encode("utf-8"),
            f"Content-Type: {guess_content_type(path)}\r\n\r\n".encode("utf-8"),
            path.read_bytes(),
            b"\r\n",
        ])
    for name, value in fields.items():
        chunks.extend([
            f"--{boundary}\r\n".encode("utf-8"),
            f'Content-Disposition: form-data; name="{multipart_escape(name)}"\r\n\r\n'.encode("utf-8"),
            str(value).encode("utf-8"),
            b"\r\n",
        ])
    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks), boundary


def post_json(url, token, payload, timeout):
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "authorization": f"Bearer {token}",
            "content-type": "application/json",
            "accept": "application/json",
            "user-agent": "image-studio-generate-skill/0.1",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = read_response_text(response)
        return response.status, raw


def post_multipart(url, token, fields, files, timeout):
    body, boundary = build_multipart_body(fields, files)
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "authorization": f"Bearer {token}",
            "content-type": f"multipart/form-data; boundary={boundary}",
            "accept": "application/json",
            "user-agent": "image-studio-generate-skill/0.1",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = read_response_text(response)
        return response.status, raw


def read_response_text(response):
    chunks = []
    while True:
        try:
            chunk = response.read(8192)
        except IncompleteRead as error:
            if error.partial:
                chunks.append(error.partial)
            break
        if not chunk:
            break
        chunks.append(chunk)
    return b"".join(chunks).decode("utf-8", errors="replace")


def main(argv):
    parser = argparse.ArgumentParser(description="Generate images through a private Image Studio self-hosted API.")
    prompt_group = parser.add_mutually_exclusive_group(required=True)
    prompt_group.add_argument("--prompt")
    prompt_group.add_argument("--prompt-file")
    parser.add_argument("--endpoint", default=config_value("IMAGE_STUDIO_ENDPOINT"))
    parser.add_argument("--token", default=config_value("IMAGE_STUDIO_API_TOKEN"))
    parser.add_argument("--image", action="append", default=[], help="Input image for edit mode. Repeat for multiple images.")
    parser.add_argument("--mask", default="", help="Optional mask image for edit mode.")
    parser.add_argument("--model", default="")
    parser.add_argument("--size", default="")
    parser.add_argument("--quality", default="")
    parser.add_argument("--output-format", default="")
    parser.add_argument("--response-format", default="")
    parser.add_argument("--no-stream", action="store_true", help="Disable Images API streaming.")
    parser.add_argument("--partial-images", type=int, default=DEFAULT_PARTIAL_IMAGES)
    parser.add_argument("--n", type=int, default=1)
    parser.add_argument("--output-dir", default=env("IMAGE_STUDIO_OUTPUT_DIR", "./outputs/image-studio"))
    parser.add_argument("--timeout", type=int, default=180)
    args = parser.parse_args(argv)

    if not args.endpoint:
        return fail("Missing IMAGE_STUDIO_ENDPOINT or --endpoint")
    if not args.token:
        return fail("Missing IMAGE_STUDIO_API_TOKEN or --token")
    try:
        args.prompt = resolve_prompt(args)
    except Exception as error:
        return fail(str(error))

    endpoint = args.endpoint.rstrip("/")
    if args.mask and not args.image:
        return fail("--mask requires at least one --image")
    edit_files = []
    try:
        for image in args.image:
            edit_files.append(("image", validate_file(image, "Input image")))
        if args.mask:
            edit_files.append(("mask", validate_file(args.mask, "Mask")))
    except FileNotFoundError as error:
        return fail(str(error))

    is_edit = bool(args.image)
    args.stream = not args.no_stream
    args.partial_images = max(0, min(3, int(args.partial_images)))
    url = f"{endpoint}/v1/images/edits" if is_edit else f"{endpoint}/v1/images/generations"
    payload = build_form_fields(args) if is_edit else build_payload(args)

    try:
        if is_edit:
            status, raw = post_multipart(url, args.token, payload, edit_files, args.timeout)
        else:
            status, raw = post_json(url, args.token, payload, args.timeout)
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
            message = parsed.get("error", {}).get("message") or raw
        except json.JSONDecodeError:
            message = raw or str(error)
        return fail(message, status=error.code, raw=raw)
    except Exception as error:
        return fail(str(error))

    try:
        if args.stream and "data:" in raw:
            data = parse_sse_image_response(raw)
        else:
            data = json.loads(raw)
    except json.JSONDecodeError:
        return fail("Image API returned non-JSON response", status=status, raw=raw)
    if not data.get("data"):
        error_event = stream_error(data)
        if error_event:
            return fail(error_event["message"], status=error_event["status"], raw=raw)
        stream_meta = data.get("_stream") if isinstance(data.get("_stream"), dict) else {}
        if args.stream and raw.strip().startswith(": image-studio keepalive"):
            return fail(
                "Image API stream ended after keepalive without a completed image. "
                "The upstream image edit/generation backend likely timed out or closed the connection.",
                status=status,
                raw=raw,
            )
        if args.stream and not stream_meta.get("completed_count"):
            return fail("Image API stream ended without a completed image.", status=status, raw=raw)

    prefix = f"image-studio-{int(time.time())}"
    output_dir = Path(args.output_dir)
    files = decode_images(data, output_dir, prefix)
    urls = collect_urls(data)
    response_metadata = {
        "status": status,
        "data_count": len(data.get("data", [])) if isinstance(data.get("data"), list) else 0,
        "stream": bool(args.stream),
        "partial_count": int(data.get("_stream", {}).get("partial_count", 0)) if isinstance(data.get("_stream"), dict) else 0,
    }
    metadata_file = write_metadata(
        output_dir,
        prefix,
        "edit" if is_edit else "generation",
        args.prompt,
        payload,
        response_metadata,
        files,
        urls,
    )
    result = {
        "ok": True,
        "files": files,
        "urls": urls,
        "metadata_file": metadata_file,
        "response": response_metadata,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
