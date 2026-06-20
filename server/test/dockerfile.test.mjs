import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Dockerfile builds and copies the Art Design Pro admin frontend", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");

  assert.match(dockerfile, /FROM node:22-alpine AS admin-builder/);
  assert.match(dockerfile, /WORKDIR \/app\/admin/);
  assert.match(dockerfile, /RUN npm run build/);
  assert.match(dockerfile, /COPY --from=admin-builder \/app\/admin\/dist \.\/admin\/dist/);
});
