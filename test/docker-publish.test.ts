import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Docker publishing policy", () => {
  it("keeps prereleases and manual builds away from latest, and rejects mismatched versions", () => {
    expect(existsSync("docker/image-tags.mjs"), "image tag validator must exist").toBe(true);
    const run = (event: string, ref: string, version = "0.9.3") =>
      execFileSync(process.execPath, ["docker/image-tags.mjs"], {
        encoding: "utf8",
        env: { ...process.env, GITHUB_REPOSITORY: "EddyMcNut/uc-intg-onkyo-avr", GITHUB_SHA: "abcdef1234567890", GITHUB_EVENT_NAME: event, GITHUB_REF: ref, IMAGE_VERSION: version }
      });
    expect(run("push", "refs/tags/v0.9.3")).toBe("ghcr.io/eddymcnut/uc-intg-onkyo-avr:0.9.3\nghcr.io/eddymcnut/uc-intg-onkyo-avr:latest\n");
    expect(run("push", "refs/tags/v0.9.3-rc.1", "0.9.3-rc.1")).not.toContain(":latest");
    expect(run("workflow_dispatch", "refs/heads/main")).toContain(":dev-abcdef123456");
    expect(() => run("push", "refs/tags/v0.9.4")).toThrow();
    expect(() => run("push", "refs/tags/v0.9.3+build")).toThrow();
    expect(() => run("pull_request", "refs/pull/1/merge")).toThrow();
    expect(() => run("push", "refs/heads/feature")).toThrow();
    const workflow = readFileSync(".github/workflows/docker.yml", "utf8");
    expect(workflow).toContain("packages: write");
    expect(workflow).toContain("inputs.publish");
    expect(workflow).not.toContain("pull_request_target");
  });
});
