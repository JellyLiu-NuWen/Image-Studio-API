import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { createSelfHostedApp } from "./app.js";
import { createFileConfigStore, loadDotEnv } from "./config.js";
import { createJsonlLogStore } from "./logStore.js";
import { createJsonStateStore } from "./stateStore.js";
import { renderAdminPage } from "./adminPage.js";
import { createUpdateService } from "./updateService.js";
import { createAdminAssetHandler } from "./adminAssets.js";
import { writeWebResponse } from "./nodeResponse.js";

await loadDotEnv(resolve(process.env.ENV_FILE || ".env"));

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 8787);
const configPath = resolve(process.env.CONFIG_PATH || "data/config.json");
const dataDir = dirname(configPath);

const store = createFileConfigStore(configPath);
const adminAssetHandler = createAdminAssetHandler({
  distDir: resolve(process.env.ADMIN_DIST_DIR || "../admin/dist"),
});
const updateService = createUpdateService({
  currentVersion: process.env.IMAGE_STUDIO_VERSION || "dev",
  repository: process.env.IMAGE_STUDIO_GITHUB_REPOSITORY || "",
  fetchImpl: globalThis.fetch,
});
const app = createSelfHostedApp({
  store,
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  apiLogStore: createJsonlLogStore({ path: join(dataDir, "logs", "api-calls.jsonl") }),
  generationLogStore: createJsonlLogStore({ path: join(dataDir, "logs", "generations.jsonl") }),
  sessionStore: createJsonStateStore({ path: join(dataDir, "state", "admin-sessions.json"), fallback: [] }),
  auditRecordStore: createJsonStateStore({ path: join(dataDir, "state", "audit-records.json"), fallback: [] }),
  configVersionStore: createJsonStateStore({ path: join(dataDir, "state", "config-versions.json"), fallback: [] }),
  updateService,
  fetchImpl: globalThis.fetch,
});

function responseFromHTML(html, headers = {}) {
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...headers,
    },
  });
}

async function handleNodeRequest(nodeRequest, nodeResponse) {
  try {
    const url = new URL(nodeRequest.url || "/", `http://${nodeRequest.headers.host || "localhost"}`);

    if (nodeRequest.method === "GET" && (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))) {
      const assetResponse = await adminAssetHandler(new Request(url, { method: nodeRequest.method, headers: nodeRequest.headers }));
      if (assetResponse) {
        await writeWebResponse(nodeResponse, assetResponse);
        return;
      }
    }

    if (nodeRequest.method === "GET" && url.pathname === "/admin") {
      await writeWebResponse(nodeResponse, responseFromHTML(renderAdminPage(), {
        "x-image-studio-admin-ui": "native-fallback",
      }));
      return;
    }

    const request = new Request(url, {
      method: nodeRequest.method,
      headers: nodeRequest.headers,
      body: ["GET", "HEAD"].includes(nodeRequest.method || "") ? undefined : nodeRequest,
      duplex: "half",
    });
    await writeWebResponse(nodeResponse, await app.handle(request));
  } catch (error) {
    console.error(error);
    await writeWebResponse(nodeResponse, new Response(JSON.stringify({
      error: { message: "Internal server error" },
    }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    }));
  }
}

createServer(handleNodeRequest).listen(port, host, () => {
  console.log(`Image Studio self-hosted API listening on http://${host}:${port}`);
  console.log(`Admin page: http://${host}:${port}/admin`);
  console.log(`Config path: ${configPath}`);
});
