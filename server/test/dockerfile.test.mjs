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

test("self-hosted deployment exposes version metadata to the admin console", async () => {
  const compose = await readFile(new URL("../../docker-compose.self-hosted.yml", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../../.github/workflows/deploy-self-hosted.yml", import.meta.url), "utf8");

  assert.match(compose, /IMAGE_STUDIO_COMMIT: \$\{IMAGE_STUDIO_COMMIT:-\}/);
  assert.match(compose, /IMAGE_STUDIO_API_TAG: \$\{IMAGE_STUDIO_API_TAG:-latest\}/);
  assert.match(workflow, /IMAGE_STUDIO_COMMIT=\$\{short_sha\}/);
});
