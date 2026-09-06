import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Docker runtime contract", () => {
  it("starts the current compiled entrypoint, not the obsolete dist/src/index.js", () => {
    expect(existsSync("Dockerfile"), "Dockerfile must exist").toBe(true);
    const dockerfile = readFileSync("Dockerfile", "utf8");
    expect(dockerfile).toMatch(/CMD\s+\["node",\s*"dist\/driver.js"\]/);
    expect(dockerfile).not.toContain("dist/src/index.js");
    expect(dockerfile).toMatch(/USER node/);
    expect(dockerfile).toContain("npm ci --omit=dev");
    expect(dockerfile).toContain("COPY logos ./logos");
    expect(dockerfile).toContain("UC_CONFIG_HOME=/config");
  });
});
