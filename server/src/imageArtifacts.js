const MAX_RESULT_IMAGES = 8;

const B64_KEYS = new Set([
  "b64_json",
  "b64Json",
  "image_b64",
  "imageB64",
  "image_base64",
  "imageBase64",
  "base64",
  "partial_image_b64",
  "partialImageB64",
]);

const URL_KEYS = new Set([
  "url",
  "image_url",
  "imageUrl",
]);

function normalizePathSegment(value) {
  return String(value || "").replace(/\s+/g, "_").slice(0, 120);
}

function normalizeSource(source, key = "") {
  return [source, key].filter(Boolean).map(normalizePathSegment).join(".") || "response";
}

function isImageURL(value) {
  const text = String(value || "").trim();
  return /^https?:\/\/\S+/i.test(text) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(text);
}

function splitDataURL(value) {
  const match = String(value || "").trim().match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=_-]+)$/i);
  if (!match) return null;
  return {
    mimeType: match[1].toLowerCase(),
    b64Json: match[2],
  };
}

function inferMimeTypeFromBase64(value, fallback = "image/png") {
  const text = String(value || "").trim();
  if (text.startsWith("/9j/")) return "image/jpeg";
  if (text.startsWith("iVBOR")) return "image/png";
  if (text.startsWith("UklGR")) return "image/webp";
  if (text.startsWith("R0lGOD")) return "image/gif";
  return fallback;
}

function inferMimeTypeFromURL(value, fallback = "image/png") {
  const path = String(value || "").split(/[?#]/)[0].toLowerCase();
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".png")) return "image/png";
  return fallback;
}

function imageByteSizeFromBase64(value) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text) return 0;
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(text.length * 3 / 4) - padding);
}

function outputFormatMimeType(value) {
  const format = String(value || "").trim().toLowerCase();
  if (format === "jpeg" || format === "jpg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  if (format === "gif") return "image/gif";
  if (format === "png") return "image/png";
  return "";
}

function addArtifact(artifacts, seen, artifact, limit) {
  if (artifacts.length >= limit) return;
  const key = artifact.kind === "url" ? artifact.url : artifact.b64Json;
  if (!key || seen.has(key)) return;
  seen.add(key);
  artifacts.push({
    index: artifacts.length,
    ...artifact,
  });
}

function addBase64Artifact(artifacts, seen, value, options) {
  const dataURL = splitDataURL(value);
  const b64Json = dataURL?.b64Json || String(value || "").trim();
  if (!b64Json) return;
  const mimeType = dataURL?.mimeType || inferMimeTypeFromBase64(b64Json, options.mimeType || "image/png");
  addArtifact(artifacts, seen, {
    kind: "b64_json",
    mimeType,
    b64Json,
    byteSize: imageByteSizeFromBase64(b64Json),
    source: options.source,
    partial: !!options.partial,
  }, options.limit);
}

function addURLArtifact(artifacts, seen, value, options) {
  const text = String(value || "").trim();
  if (!isImageURL(text)) return;
  const dataURL = splitDataURL(text);
  if (dataURL) {
    addBase64Artifact(artifacts, seen, text, options);
    return;
  }
  addArtifact(artifacts, seen, {
    kind: "url",
    mimeType: inferMimeTypeFromURL(text, options.mimeType || "image/png"),
    url: text,
    source: options.source,
    partial: !!options.partial,
  }, options.limit);
}

function walkImageArtifacts(value, artifacts, seen, context) {
  if (artifacts.length >= context.limit || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkImageArtifacts(item, artifacts, seen, {
        ...context,
        source: `${context.source}[${index}]`,
      });
    });
    return;
  }
  if (typeof value !== "object") return;

  const type = String(value.type || value.event || "");
  const mimeType = String(value.mime_type || value.mimeType || outputFormatMimeType(value.output_format) || context.mimeType || "");
  const partial = context.partial || /partial/i.test(type);

  for (const [key, child] of Object.entries(value)) {
    const source = normalizeSource(context.source, key);
    if (B64_KEYS.has(key)) {
      addBase64Artifact(artifacts, seen, child, {
        limit: context.limit,
        source,
        mimeType,
        partial: partial || /partial/i.test(key),
      });
      continue;
    }
    if (key === "result" && /image/i.test(type) && typeof child === "string") {
      addBase64Artifact(artifacts, seen, child, {
        limit: context.limit,
        source,
        mimeType,
        partial,
      });
      continue;
    }
    if (URL_KEYS.has(key)) {
      addURLArtifact(artifacts, seen, child, {
        limit: context.limit,
        source,
        mimeType,
        partial,
      });
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (artifacts.length >= context.limit) break;
    walkImageArtifacts(child, artifacts, seen, {
      ...context,
      source: normalizeSource(context.source, key),
      mimeType,
      partial,
    });
  }
}

export function extractImageArtifactsFromJSON(value, { source = "response", limit = MAX_RESULT_IMAGES } = {}) {
  const artifacts = [];
  const seen = new Set();
  walkImageArtifacts(value, artifacts, seen, { source, limit, partial: false, mimeType: "" });
  return artifacts;
}

export function extractImageArtifactsFromJSONText(text, options = {}) {
  const raw = String(text || "").trim();
  if (!raw || !/^[{[]/.test(raw)) return [];
  try {
    return extractImageArtifactsFromJSON(JSON.parse(raw), options);
  } catch {
    return [];
  }
}

export function mergeImageArtifacts(target, additions, limit = MAX_RESULT_IMAGES) {
  const next = Array.isArray(target) ? target : [];
  const seen = new Set(next.map((item) => item?.url || item?.b64Json).filter(Boolean));
  for (const item of Array.isArray(additions) ? additions : []) {
    addArtifact(next, seen, {
      kind: item.kind,
      mimeType: item.mimeType || "image/png",
      url: item.url,
      b64Json: item.b64Json,
      byteSize: Number(item.byteSize) || undefined,
      source: item.source || "response",
      partial: !!item.partial,
    }, limit);
  }
  return next;
}

export function extractImageArtifactsFromSSEText(text, state, { source = "stream", limit = MAX_RESULT_IMAGES } = {}) {
  if (!state || typeof state !== "object") return [];
  state.imageArtifactSSEBuffer = `${state.imageArtifactSSEBuffer || ""}${String(text || "")}`;
  const frames = state.imageArtifactSSEBuffer.split(/\r?\n\r?\n/);
  state.imageArtifactSSEBuffer = frames.pop() || "";
  const artifacts = [];
  for (const frame of frames) {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();
    if (!data || data === "[DONE]") continue;
    try {
      mergeImageArtifacts(artifacts, extractImageArtifactsFromJSON(JSON.parse(data), { source, limit }), limit);
    } catch {
      // Keep stream diagnostics resilient: malformed SSE data should not break image delivery.
    }
  }
  return artifacts;
}
