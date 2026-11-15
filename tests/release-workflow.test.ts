import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Pins the release workflow's registry-publication contract. Registry
 * publication must survive a skipped or failed release job, verify the npm
 * artifact, and read back the stored registry record before succeeding.
 */
const workflow = readFileSync(
  new URL("../.github/workflows/release.yml", import.meta.url),
  "utf8",
);

const registryJobStart = workflow.indexOf("  mcp-registry:\n");
const registryJob =
  registryJobStart === -1 ? "" : workflow.slice(registryJobStart);
const releaseJob =
  registryJobStart === -1
    ? workflow.slice(workflow.indexOf("  release:\n"))
    : workflow.slice(workflow.indexOf("  release:\n"), registryJobStart);

describe("release workflow registry contract", () => {
  it("runs registry publication after any release outcome", () => {
    expect(workflow).toContain("  mcp-registry:\n    needs: [check, release]");
    expect(workflow).toContain(
      "if: always() && needs.check.result == 'success'",
    );
    expect(registryJob).not.toContain("needs.release.result == 'success'");
  });

  it("keeps registry publication least-privileged and environment-free", () => {
    expect(registryJob).toContain("contents: read");
    expect(registryJob).toContain("id-token: write");
    expect(registryJob).not.toMatch(/\n {4}environment:/);
    expect(registryJob).not.toContain(
      "id-token: write # OIDC trusted publishing + provenance",
    );
  });

  it("skips an existing version and fails unexpected registry statuses", () => {
    expect(registryJob).toContain(
      "steps.registry.outputs.published == 'false'",
    );
    expect(registryJob).toContain("published=true");
    expect(registryJob).toContain("published=false");
    expect(registryJob).toContain("200");
    expect(registryJob).toContain("404");
  });

  it("uses a pinned, verified publisher and verifies the published record", () => {
    expect(registryJob).toContain("MCP_PUBLISHER_VERSION: v1.8.9");
    expect(registryJob).not.toContain("releases/latest");
    expect(registryJob).toContain("cosign verify-blob");
    expect(registryJob.indexOf("./mcp-publisher validate")).toBeLessThan(
      registryJob.indexOf("./mcp-publisher login github-oidc"),
    );
    expect(
      registryJob.indexOf("./mcp-publisher login github-oidc"),
    ).toBeLessThan(registryJob.indexOf("./mcp-publisher publish"));
    expect(registryJob.indexOf("./mcp-publisher publish")).toBeLessThan(
      registryJob.indexOf("--output registry.json"),
    );
  });

  it("checks npm ownership and leaves registry steps out of the release job", () => {
    expect(registryJob).toContain("mcpName");
    expect(registryJob).toContain("npm.json");
    expect(releaseJob).not.toContain("./mcp-publisher");
  });
});
