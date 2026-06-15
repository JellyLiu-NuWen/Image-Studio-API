import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

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

export function parseCookies(request) {
  const cookies = {};
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name) continue;
    cookies[name] = decodeURIComponent(valueParts.join("=") || "");
  }
  return cookies;
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function createSessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 7) {
  return [
    `image_studio_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}

export function clearSessionCookie() {
  return "image_studio_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

export async function hashPassword(password) {
  const value = String(password || "");
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(value, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyPassword(password, storedHash) {
  const value = String(password || "");
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expected] = parts;
  const actual = await scrypt(value, salt, 64);
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (actual.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actual, expectedBuffer);
}
