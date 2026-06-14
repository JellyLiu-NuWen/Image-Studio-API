import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { writeGitHubOutputFromJson } from "./write-github-output-from-json.mjs";

test("writes JSON fields to a GitHub Actions output file without shell interpolation", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "image-studio-gh-output-"));
  try {
    const inputPath = path.join(dir, "status.json");
    const outputPath = path.join(dir, "github-output.txt");
    await writeFile(inputPath, JSON.stringify({
      hasUpdates: false,
      upstreamSubject: "Merge pull request\nfrom upstream",
      behindCount: 0,
    }), "utf8");

    await writeGitHubOutputFromJson(inputPath, outputPath);

    assert.equal(await readFile(outputPath, "utf8"), [
      "hasUpdates=false",
      "upstreamSubject=Merge pull request from upstream",
      "behindCount=0",
      "",
    ].join("\n"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
