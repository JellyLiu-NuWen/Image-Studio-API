import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(baseURL, timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseURL}/healthz`);
      if (response.ok) return;
    } catch {
      await wait(200);
    }
  }
  throw new Error("Timed out waiting for /healthz");
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "image-studio-api-"));
  const port = 18_787 + Math.floor(Math.random() * 1000);
  const baseURL = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["src/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      CONFIG_PATH: join(tempDir, "config.json"),
      ADMIN_TOKEN: "admin-token",
      IMAGE_API_TOKEN: "client-token",
      UPSTREAM_BASE_URL: "https://upstream.example/v1",
      UPSTREAM_API_KEY: "upstream-key",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForHealth(baseURL);
    const admin = await fetch(`${baseURL}/admin`);
    if (!admin.ok) throw new Error(`/admin returned ${admin.status}`);
    const config = await fetch(`${baseURL}/api/config`, {
      headers: { authorization: "Bearer admin-token" },
    });
    if (!config.ok) throw new Error(`/api/config returned ${config.status}`);
    const data = await config.json();
    if (!data.config?.upstreamApiKeySet || !data.config?.imageApiTokenSet) {
      throw new Error("/api/config did not report saved secrets");
    }
    console.log("smoke check passed");
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
    await rm(tempDir, { recursive: true, force: true });
  }

  if (stderr.trim()) {
    console.error(stderr.trim());
  }
  if (!stdout.includes("Image Studio self-hosted API listening")) {
    throw new Error("server did not print startup banner");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
