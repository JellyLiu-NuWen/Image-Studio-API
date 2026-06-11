#!/usr/bin/env python3
import argparse
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def env(name, default=""):
    return os.environ.get(name, default).strip()


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
    quality = args.quality or env("IMAGE_STUDIO_DEFAULT_QUALITY")
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
    return payload


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
        raw = response.read().decode("utf-8")
        return response.status, raw


def main(argv):
    parser = argparse.ArgumentParser(description="Generate images through a private Image Studio self-hosted API.")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--endpoint", default=env("IMAGE_STUDIO_ENDPOINT"))
    parser.add_argument("--token", default=env("IMAGE_STUDIO_API_TOKEN"))
    parser.add_argument("--model", default="")
    parser.add_argument("--size", default="")
    parser.add_argument("--quality", default="")
    parser.add_argument("--output-format", default="")
    parser.add_argument("--response-format", default="")
    parser.add_argument("--n", type=int, default=1)
    parser.add_argument("--output-dir", default=env("IMAGE_STUDIO_OUTPUT_DIR", "./outputs/image-studio"))
    parser.add_argument("--timeout", type=int, default=180)
    args = parser.parse_args(argv)

    if not args.endpoint:
        return fail("Missing IMAGE_STUDIO_ENDPOINT or --endpoint")
    if not args.token:
        return fail("Missing IMAGE_STUDIO_API_TOKEN or --token")

    endpoint = args.endpoint.rstrip("/")
    url = f"{endpoint}/v1/images/generations"
    payload = build_payload(args)

    try:
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
        data = json.loads(raw)
    except json.JSONDecodeError:
        return fail("Image API returned non-JSON response", status=status, raw=raw)

    prefix = f"image-studio-{int(time.time())}"
    files = decode_images(data, Path(args.output_dir), prefix)
    urls = collect_urls(data)
    result = {
        "ok": True,
        "files": files,
        "urls": urls,
        "response": {
            "status": status,
            "data_count": len(data.get("data", [])) if isinstance(data.get("data"), list) else 0,
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
