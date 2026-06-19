import base64
import json
import os
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from unittest import TestCase, main


SCRIPT = Path(__file__).with_name("generate_image.py")


class Handler(BaseHTTPRequestHandler):
    seen = {}
    mode = "json"

    def do_POST(self):
        length = int(self.headers.get("content-length", "0"))
        raw_body = self.rfile.read(length)
        content_type = self.headers.get("content-type", "")
        body = None
        body_text = raw_body.decode("utf-8", errors="replace")
        if content_type.startswith("application/json"):
            body = json.loads(body_text)
        Handler.seen = {
            "path": self.path,
            "authorization": self.headers.get("authorization"),
            "content_type": content_type,
            "body": body,
            "body_text": body_text,
        }
        if Handler.mode == "stream":
            payloads = [
                {"type": "image_generation.partial_image", "b64_json": base64.b64encode(b"partial").decode("ascii")},
                {"type": "image_generation.completed", "b64_json": base64.b64encode(b"fake-png").decode("ascii"), "output_format": "png"},
            ]
            raw = "".join(f"data: {json.dumps(payload)}\n\n" for payload in payloads).encode("utf-8")
            content_type = "text/event-stream"
        else:
            payload = {
                "data": [
                    {
                        "b64_json": base64.b64encode(b"fake-png").decode("ascii"),
                        "mime_type": "image/png",
                    }
                ]
            }
            raw = json.dumps(payload).encode("utf-8")
            content_type = "application/json"
        self.send_response(200)
        self.send_header("content-type", content_type)
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, *_args):
        return


class GenerateImageScriptTest(TestCase):
    def setUp(self):
        Handler.mode = "json"

    def test_posts_prompt_and_saves_b64_image(self):
        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                env = {
                    **os.environ,
                    "IMAGE_STUDIO_ENDPOINT": f"http://127.0.0.1:{server.server_port}",
                    "IMAGE_STUDIO_API_TOKEN": "client-token",
                }
                result = subprocess.run(
                    [
                        sys.executable,
                        str(SCRIPT),
                        "--prompt",
                        "a red cat",
                        "--output-dir",
                        temp_dir,
                    ],
                    env=env,
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                data = json.loads(result.stdout)
                self.assertTrue(data["ok"])
                self.assertEqual(Handler.seen["path"], "/v1/images/generations")
                self.assertEqual(Handler.seen["authorization"], "Bearer client-token")
                self.assertEqual(Handler.seen["body"]["prompt"], "a red cat")
                self.assertEqual(len(data["files"]), 1)
                self.assertEqual(Path(data["files"][0]).read_bytes(), b"fake-png")
        finally:
            server.shutdown()
            server.server_close()

    def test_reads_endpoint_and_token_from_local_config_file(self):
        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                config_path = Path(temp_dir) / "image-studio-generate.env"
                config_path.write_text(
                    "\n".join(
                        [
                            f"IMAGE_STUDIO_ENDPOINT=http://127.0.0.1:{server.server_port}",
                            "IMAGE_STUDIO_API_TOKEN=config-token",
                        ]
                    ),
                    encoding="utf-8",
                )
                env = {
                    **os.environ,
                    "IMAGE_STUDIO_CONFIG": str(config_path),
                }
                env.pop("IMAGE_STUDIO_ENDPOINT", None)
                env.pop("IMAGE_STUDIO_API_TOKEN", None)
                result = subprocess.run(
                    [
                        sys.executable,
                        str(SCRIPT),
                        "--prompt",
                        "a blue cube",
                        "--output-dir",
                        temp_dir,
                    ],
                    env=env,
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                data = json.loads(result.stdout)
                self.assertTrue(data["ok"])
                self.assertEqual(Handler.seen["path"], "/v1/images/generations")
                self.assertEqual(Handler.seen["authorization"], "Bearer config-token")
                self.assertEqual(Handler.seen["body"]["prompt"], "a blue cube")
        finally:
            server.shutdown()
            server.server_close()

    def test_reads_prompt_file_defaults_to_high_quality_and_saves_metadata(self):
        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                prompt_path = Path(temp_dir) / "prompt.txt"
                prompt_path.write_text("a detailed product poster", encoding="utf-8")
                env = {
                    **os.environ,
                    "IMAGE_STUDIO_ENDPOINT": f"http://127.0.0.1:{server.server_port}",
                    "IMAGE_STUDIO_API_TOKEN": "client-token",
                }
                env.pop("IMAGE_STUDIO_DEFAULT_QUALITY", None)
                result = subprocess.run(
                    [
                        sys.executable,
                        str(SCRIPT),
                        "--prompt-file",
                        str(prompt_path),
                        "--output-dir",
                        temp_dir,
                    ],
                    env=env,
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                data = json.loads(result.stdout)
                self.assertTrue(data["ok"])
                self.assertEqual(Handler.seen["path"], "/v1/images/generations")
                self.assertEqual(Handler.seen["body"]["prompt"], "a detailed product poster")
                self.assertEqual(Handler.seen["body"]["quality"], "high")
                metadata_path = Path(data["metadata_file"])
                self.assertTrue(metadata_path.is_file())
                metadata_text = metadata_path.read_text(encoding="utf-8")
                metadata = json.loads(metadata_text)
                self.assertEqual(metadata["prompt"], "a detailed product poster")
                self.assertEqual(metadata["payload"]["quality"], "high")
                self.assertEqual(metadata["mode"], "generation")
                self.assertNotIn("client-token", metadata_text)
        finally:
            server.shutdown()
            server.server_close()

    def test_requests_streaming_and_saves_completed_stream_image(self):
        Handler.mode = "stream"
        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                env = {
                    **os.environ,
                    "IMAGE_STUDIO_ENDPOINT": f"http://127.0.0.1:{server.server_port}",
                    "IMAGE_STUDIO_API_TOKEN": "client-token",
                }
                result = subprocess.run(
                    [
                        sys.executable,
                        str(SCRIPT),
                        "--prompt",
                        "a streaming poster",
                        "--output-dir",
                        temp_dir,
                    ],
                    env=env,
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                data = json.loads(result.stdout)
                self.assertTrue(data["ok"])
                self.assertEqual(Handler.seen["body"]["stream"], True)
                self.assertEqual(Handler.seen["body"]["partial_images"], 1)
                self.assertEqual(Path(data["files"][0]).read_bytes(), b"fake-png")
                metadata = json.loads(Path(data["metadata_file"]).read_text(encoding="utf-8"))
                self.assertEqual(metadata["response"]["stream"], True)
                self.assertEqual(metadata["response"]["partial_count"], 1)
        finally:
            server.shutdown()
            server.server_close()

    def test_posts_multiple_images_and_mask_as_multipart_edit(self):
        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                first = Path(temp_dir) / "first.png"
                second = Path(temp_dir) / "second.jpg"
                mask = Path(temp_dir) / "mask.png"
                first.write_bytes(b"first-image")
                second.write_bytes(b"second-image")
                mask.write_bytes(b"mask-image")
                env = {
                    **os.environ,
                    "IMAGE_STUDIO_ENDPOINT": f"http://127.0.0.1:{server.server_port}",
                    "IMAGE_STUDIO_API_TOKEN": "client-token",
                }
                result = subprocess.run(
                    [
                        sys.executable,
                        str(SCRIPT),
                        "--prompt",
                        "combine these with a clean product style",
                        "--image",
                        str(first),
                        "--image",
                        str(second),
                        "--mask",
                        str(mask),
                        "--model",
                        "gpt-image-1.5",
                        "--size",
                        "1024x1024",
                        "--quality",
                        "high",
                        "--output-dir",
                        temp_dir,
                    ],
                    env=env,
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                data = json.loads(result.stdout)
                self.assertTrue(data["ok"])
                self.assertEqual(Handler.seen["path"], "/v1/images/edits")
                self.assertEqual(Handler.seen["authorization"], "Bearer client-token")
                self.assertIn("multipart/form-data; boundary=", Handler.seen["content_type"])
                body = Handler.seen["body_text"]
                self.assertEqual(body.count('name="image[]"'), 2)
                self.assertIn('filename="first.png"', body)
                self.assertIn('filename="second.jpg"', body)
                self.assertIn('name="mask"; filename="mask.png"', body)
                self.assertIn('name="prompt"', body)
                self.assertIn("combine these with a clean product style", body)
                self.assertIn('name="model"', body)
                self.assertIn("gpt-image-1.5", body)
                self.assertIn('name="size"', body)
                self.assertIn("1024x1024", body)
                self.assertIn('name="quality"', body)
                self.assertIn("high", body)
                self.assertEqual(len(data["files"]), 1)
        finally:
            server.shutdown()
            server.server_close()

    def test_mask_requires_an_input_image(self):
        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                mask = Path(temp_dir) / "mask.png"
                mask.write_bytes(b"mask-image")
                env = {
                    **os.environ,
                    "IMAGE_STUDIO_ENDPOINT": f"http://127.0.0.1:{server.server_port}",
                    "IMAGE_STUDIO_API_TOKEN": "client-token",
                }
                result = subprocess.run(
                    [
                        sys.executable,
                        str(SCRIPT),
                        "--prompt",
                        "edit with mask",
                        "--mask",
                        str(mask),
                    ],
                    env=env,
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                )
                self.assertEqual(result.returncode, 1, result.stderr)
                data = json.loads(result.stdout)
                self.assertFalse(data["ok"])
                self.assertIn("--mask requires at least one --image", data["error"]["message"])
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
