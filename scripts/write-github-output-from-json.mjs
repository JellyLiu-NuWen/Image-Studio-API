import { appendFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function writeGitHubOutputFromJson(inputPath, outputPath = process.env.GITHUB_OUTPUT) {
  if (!outputPath) {
    throw new Error("GITHUB_OUTPUT is not set");
  }
  const data = JSON.parse(await readFile(inputPath, "utf8"));
  const lines = Object.entries(data).map(([key, value]) => {
    const safeValue = String(value).replace(/\r?\n/g, " ");
    return `${key}=${safeValue}`;
  });
  await appendFile(outputPath, `${lines.join("\n")}\n`, "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const inputPath = process.argv[2] || "upstream-status.json";
  await writeGitHubOutputFromJson(inputPath);
}
