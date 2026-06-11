import { spawnSync } from "node:child_process";

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function commitSubject(ref) {
  return git(["log", "-1", "--format=%s", ref]);
}

function main() {
  const upstreamRemote = process.env.UPSTREAM_REMOTE || "upstream";
  const upstreamBranch = process.env.UPSTREAM_BRANCH || "main";
  const mirrorBranch = process.env.UPSTREAM_MIRROR_BRANCH || "upstream-main";
  const mirrorRef = "refs/check-upstream/origin-upstream-main";
  const upstreamRef = "refs/check-upstream/upstream-main";
  const upstreamLabel = `${upstreamRemote}/${upstreamBranch}`;
  const mirrorLabel = `origin/${mirrorBranch}`;

  git(["fetch", upstreamRemote, `${upstreamBranch}:${upstreamRef}`, "--prune"]);
  git(["fetch", "origin", `${mirrorBranch}:${mirrorRef}`, "--prune"]);

  const upstreamHead = git(["rev-parse", upstreamRef]);
  const mirrorHead = git(["rev-parse", mirrorRef]);
  const mergeBase = git(["merge-base", upstreamRef, mirrorRef]);
  const behindCount = Number(git(["rev-list", "--count", `${mirrorRef}..${upstreamRef}`]));
  const aheadCount = Number(git(["rev-list", "--count", `${upstreamRef}..${mirrorRef}`]));
  const hasUpdates = behindCount > 0;

  const result = {
    hasUpdates,
    upstreamRef: upstreamLabel,
    mirrorRef: mirrorLabel,
    upstreamHead,
    mirrorHead,
    mergeBase,
    behindCount,
    aheadCount,
    upstreamSubject: commitSubject(upstreamRef),
    mirrorSubject: commitSubject(mirrorRef),
  };

  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
