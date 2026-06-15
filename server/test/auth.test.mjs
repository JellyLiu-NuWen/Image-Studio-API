import test from "node:test";
import assert from "node:assert/strict";
import { getBearer, tokenFingerprint } from "../src/auth.js";

test("getBearer extracts bearer token case-insensitively", () => {
  const request = new Request("http://localhost/", {
    headers: { authorization: "Bearer client-token" },
  });
  assert.equal(getBearer(request), "client-token");
});

test("getBearer returns empty string for missing bearer token", () => {
  const request = new Request("http://localhost/");
  assert.equal(getBearer(request), "");
});

test("tokenFingerprint is stable and does not expose raw token", async () => {
  const first = await tokenFingerprint("client-token");
  const second = await tokenFingerprint("client-token");
  assert.equal(first, second);
  assert.match(first, /^tok_[a-f0-9]{16}$/);
  assert.equal(first.includes("client-token"), false);
});
