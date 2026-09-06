import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("requires release ancestry before granting the publishing job write permissions", () => {
  const workflow = readFileSync(".github/workflows/docker.yml", "utf8");
  expect(workflow).toContain("needs: [test, build, release-gate]");
  expect(workflow).toContain("bash docker/release-gate.sh");
});

it("accepts an ancestor tag but rejects a divergent commit and missing default ref", () => {
  const dir = mkdtempSync(join(tmpdir(), "onkyo-release-gate-"));
  const script = resolve("docker/release-gate.sh");
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  try {
    git("init", "-b", "main");
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "base");
    const base = git("rev-parse", "HEAD");
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "default tip");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    const run = (sha: string, branch = "main") => spawnSync("bash", [script], { cwd: dir, env: { ...process.env, GITHUB_SHA: sha, DEFAULT_BRANCH: branch } }).status;
    expect(run(base)).toBe(0);
    git("checkout", "--detach", base);
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "unmerged");
    expect(run(git("rev-parse", "HEAD"))).not.toBe(0);
    expect(run(base, "missing")).not.toBe(0);
    expect(run(base, "main;false")).not.toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
