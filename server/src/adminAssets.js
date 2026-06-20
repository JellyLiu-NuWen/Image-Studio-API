import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function contentTypeFor(path) {
  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES[extension] || "application/octet-stream";
}

function pathInside(base, candidate) {
  const normalizedBase = resolve(base);
  const normalizedCandidate = resolve(candidate);
  return normalizedCandidate === normalizedBase || normalizedCandidate.startsWith(`${normalizedBase}${sep}`);
}

async function fileResponse(path) {
  try {
    const fileStat = await stat(path);
    if (!fileStat.isFile()) return null;
    return new Response(await readFile(path), {
      status: 200,
      headers: {
        "content-type": contentTypeFor(path),
      },
    });
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function createAdminAssetHandler({ distDir }) {
  const root = resolve(distDir);
  return async function handleAdminAsset(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return null;
    if (url.pathname === "/admin") {
      return fileResponse(resolve(root, "index.html"));
    }
    if (!url.pathname.startsWith("/admin/")) return null;
    const relativePath = decodeURIComponent(url.pathname.slice("/admin/".length));
    const assetPath = resolve(root, relativePath);
    if (!pathInside(root, assetPath)) return null;
    return fileResponse(assetPath);
  };
}
