import { createServer } from "node:http";
import { resolve } from "node:path";
import { createSelfHostedApp } from "./app.js";
import { createFileConfigStore, loadDotEnv } from "./config.js";
import { renderAdminPage } from "./adminPage.js";

await loadDotEnv(resolve(process.env.ENV_FILE || ".env"));

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 8787);
const configPath = resolve(process.env.CONFIG_PATH || "data/config.json");

const store = createFileConfigStore(configPath);
const app = createSelfHostedApp({
  store,
  adminToken: process.env.ADMIN_TOKEN || "",
  fetchImpl: globalThis.fetch,
});

function responseFromHTML(html) {
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

async function handleNodeRequest(nodeRequest, nodeResponse) {
  try {
    const url = new URL(nodeRequest.url || "/", `http://${nodeRequest.headers.host || "localhost"}`);

    if (nodeRequest.method === "GET" && url.pathname === "/admin") {
      await writeWebResponse(nodeResponse, responseFromHTML(renderAdminPage()));
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

async function writeWebResponse(nodeResponse, webResponse) {
  nodeResponse.statusCode = webResponse.status;
  for (const [key, value] of webResponse.headers) {
    nodeResponse.setHeader(key, value);
  }
  if (!webResponse.body) {
    nodeResponse.end();
    return;
  }
  const body = Buffer.from(await webResponse.arrayBuffer());
  nodeResponse.end(body);
}

createServer(handleNodeRequest).listen(port, host, () => {
  console.log(`Image Studio self-hosted API listening on http://${host}:${port}`);
  console.log(`Admin page: http://${host}:${port}/admin`);
  console.log(`Config path: ${configPath}`);
});
