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

function fetchHead(remote, branch) {
  git(["fetch", remote, branch, "--prune"]);
  return git(["rev-parse", "FETCH_HEAD"]);
}

function main() {
  const upstreamRemote = process.env.UPSTREAM_REMOTE || "upstream";
  const upstreamBranch = process.env.UPSTREAM_BRANCH || "main";
  const mirrorBranch = process.env.UPSTREAM_MIRROR_BRANCH || "upstream-main";
  const upstreamLabel = `${upstreamRemote}/${upstreamBranch}`;
  const mirrorLabel = `origin/${mirrorBranch}`;

  const upstreamHead = fetchHead(upstreamRemote, upstreamBranch);
  const mirrorHead = fetchHead("origin", mirrorBranch);
  const mergeBase = git(["merge-base", upstreamHead, mirrorHead]);
  const behindCount = Number(git(["rev-list", "--count", `${mirrorHead}..${upstreamHead}`]));
  const aheadCount = Number(git(["rev-list", "--count", `${upstreamHead}..${mirrorHead}`]));
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
    upstreamSubject: commitSubject(upstreamHead),
    mirrorSubject: commitSubject(mirrorHead),
  };

  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
