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

    def do_POST(self):
        length = int(self.headers.get("content-length", "0"))
        body = json.loads(self.rfile.read(length).decode("utf-8"))
        Handler.seen = {
            "path": self.path,
            "authorization": self.headers.get("authorization"),
            "body": body,
        }
        payload = {
            "data": [
                {
                    "b64_json": base64.b64encode(b"fake-png").decode("ascii"),
                    "mime_type": "image/png",
                }
            ]
        }
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, *_args):
        return


class GenerateImageScriptTest(TestCase):
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


if __name__ == "__main__":
    main()
