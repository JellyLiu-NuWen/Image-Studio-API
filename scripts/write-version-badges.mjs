import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

function git(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function fetchRef(remote, branch, ref) {
  git(["fetch", remote, `${branch}:${ref}`, "--prune"]);
}

function latestSemverTag(ref) {
  const tags = git(["tag", "--merged", ref, "--list", "v*", "--sort=-version:refname"])
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag));
  return tags[0] || "unknown";
}

function commit(ref) {
  return git(["rev-parse", "--short=12", ref]);
}

async function writeBadge(path, payload) {
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const outDir = "badges";
  const currentRef = process.env.CURRENT_REF || "main";
  const upstreamRemote = process.env.UPSTREAM_REMOTE || "upstream";
  const upstreamBranch = process.env.UPSTREAM_BRANCH || "main";
  const upstreamRef = "refs/image-studio-api-version/upstream-main";

  fetchRef(upstreamRemote, upstreamBranch, upstreamRef);
  await mkdir(outDir, { recursive: true });

  const currentVersion = latestSemverTag(currentRef);
  const upstreamVersion = latestSemverTag(upstreamRef);
  const currentSha = commit(currentRef);
  const upstreamSha = commit(upstreamRef);
  const aligned = currentVersion === upstreamVersion;

  await writeBadge(`${outDir}/current-version.json`, {
    schemaVersion: 1,
    label: "current",
    message: currentVersion,
    color: aligned ? "2ea44f" : "d29922",
    namedLogo: "github",
  });
  await writeBadge(`${outDir}/upstream-version.json`, {
    schemaVersion: 1,
    label: "upstream",
    message: upstreamVersion,
    color: "0969da",
    namedLogo: "github",
  });
  await writeBadge(`${outDir}/version-status.json`, {
    schemaVersion: 1,
    label: "version",
    message: aligned ? "aligned" : "needs sync",
    color: aligned ? "2ea44f" : "d29922",
  });
  await writeBadge(`${outDir}/version-details.json`, {
    currentVersion,
    upstreamVersion,
    currentSha,
    upstreamSha,
    aligned,
  });

  console.log(JSON.stringify({
    currentVersion,
    upstreamVersion,
    currentSha,
    upstreamSha,
    aligned,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
