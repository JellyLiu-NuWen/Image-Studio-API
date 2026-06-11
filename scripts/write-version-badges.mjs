import { mkdir, readFile, writeFile } from "node:fs/promises";
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

function resolveUpstreamRef(remote, branch, fallbackRef) {
  try {
    git(["fetch", remote, branch, "--prune"]);
    return git(["rev-parse", "FETCH_HEAD"]);
  } catch (error) {
    if (!fallbackRef) throw error;
    console.warn(`${error.message}\nUsing fallback ref ${fallbackRef}`);
    return git(["rev-parse", fallbackRef]);
  }
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

async function writeReadmeVersionSection(details) {
  const readmePath = "README.md";
  const readme = await readFile(readmePath, "utf8");
  const statusText = details.aligned ? "已对齐" : "需要同步";
  const nextSection = `## 版本对齐

当前状态: **${statusText}**。

| 项目 | 版本 |
|---|---|
| 我的项目版本 | \`${details.currentVersion}\` |
| 作者仓库版本 | \`${details.upstreamVersion}\` |
| 对齐状态 | \`${statusText}\` |

版本号跟随作者仓库的最新语义化 tag。两边版本号${details.aligned ? "一致，说明当前 fork 已对齐作者版本" : "不一致，说明需要同步作者仓库更新"}。

GitHub Action 会每天检查作者仓库是否有新提交，并刷新 \`badges/*.json\` 和本节内容。如果作者仓库有更新，会创建或更新 \`upstream-sync\` issue 提醒同步。

手动检查:

\`\`\`bash
node scripts/check-upstream-updates.mjs
node scripts/write-version-badges.mjs
\`\`\`

`;
  const pattern = /## 版本对齐[\s\S]*?(?=\n## 你需要准备的信息)/;
  if (!pattern.test(readme)) {
    throw new Error("README.md is missing the version alignment section");
  }
  await writeFile(readmePath, readme.replace(pattern, nextSection), "utf8");
}

async function main() {
  const outDir = "badges";
  const currentRef = process.env.CURRENT_REF || "main";
  const upstreamRemote = process.env.UPSTREAM_REMOTE || "upstream";
  const upstreamBranch = process.env.UPSTREAM_BRANCH || "main";
  const upstreamFallbackRef = process.env.UPSTREAM_FALLBACK_REF || "upstream-main";

  const upstreamRef = resolveUpstreamRef(upstreamRemote, upstreamBranch, upstreamFallbackRef);
  await mkdir(outDir, { recursive: true });

  const currentVersion = latestSemverTag(currentRef);
  const upstreamVersion = latestSemverTag(upstreamRef);
  const currentSha = commit(currentRef);
  const upstreamSha = commit(upstreamRef);
  const aligned = currentVersion === upstreamVersion;

  await writeBadge(`${outDir}/current-version.json`, {
    schemaVersion: 1,
    label: "我的项目版本",
    message: currentVersion,
    color: aligned ? "2ea44f" : "d29922"
  });
  await writeBadge(`${outDir}/upstream-version.json`, {
    schemaVersion: 1,
    label: "作者版本",
    message: upstreamVersion,
    color: "0969da"
  });
  await writeBadge(`${outDir}/version-status.json`, {
    schemaVersion: 1,
    label: "版本对齐",
    message: aligned ? "已对齐" : "需要同步",
    color: aligned ? "2ea44f" : "d29922",
  });
  const details = {
    currentVersion,
    upstreamVersion,
    currentSha,
    upstreamSha,
    aligned,
  };
  await writeBadge(`${outDir}/version-details.json`, details);
  await writeReadmeVersionSection(details);

  console.log(JSON.stringify(details, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
