import assert from "node:assert/strict";
import test from "node:test";
import { collectUtf8Output } from "./collect-utf8-output.mjs";

test("collectUtf8Output preserves multibyte characters split across chunks", () => {
  const encoded = Buffer.from("A和B", "utf8");
  const chunks = [
    encoded.slice(0, 2),
    encoded.slice(2, 4),
    encoded.slice(4),
  ];

  assert.equal(collectUtf8Output(chunks), "A和B");
});
