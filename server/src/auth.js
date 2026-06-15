import { createHash } from "node:crypto";

export function getBearer(request) {
  const raw = request.headers.get("authorization") || "";
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}

export async function tokenFingerprint(token) {
  const value = String(token || "").trim();
  if (!value) return "";
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `tok_${digest}`;
}

export function isBearerAuthorized(request, expectedToken) {
  const expected = String(expectedToken || "").trim();
  if (!expected) return false;
  return getBearer(request) === expected;
}
