import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Pins the identity fields of the distribution metadata (package.json,
 * server.json, manifest.json) to a single source of truth: package.json.
 * Version numbers are deliberately NOT pinned — `changeset version` only
 * bumps package.json, and the versions in server.json/manifest.json are
 * maintained by hand at registry-publish time (the publisher rejects drift).
 */

const REGISTRY_NAME = "io.github.knorby/inkeedecoder-mcp";
const REGISTRY_SCHEMA =
  "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
const MCPB_NAME = "inkeedecoder-mcp";
// MCPB's path-substitution token is "${__dirname}"; spelled out in parts so
// the linter does not mistake it for a JS template placeholder.
const DIRNAME_ARG = "${" + "__dirname}/dist/index.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
  name: string;
  mcpName?: string;
};

const serverJson = JSON.parse(
  readFileSync(new URL("../server.json", import.meta.url), "utf8"),
) as {
  $schema: string;
  name: string;
  description: string;
  packages: Array<{
    registryType: string;
    identifier: string;
  }>;
};

const manifest = JSON.parse(
  readFileSync(new URL("../manifest.json", import.meta.url), "utf8"),
) as {
  manifest_version: string;
  name: string;
  server: {
    type: string;
    entry_point: string;
    mcp_config: { command: string; args: string[] };
  };
};

describe("distribution metadata consistency", () => {
  it("package.json carries the registry ownership marker", () => {
    expect(pkg.mcpName).toBe(REGISTRY_NAME);
  });

  it("server.json name matches package.json mcpName", () => {
    expect(serverJson.name).toBe(pkg.mcpName);
  });

  it("server.json references the pinned registry schema", () => {
    expect(serverJson.$schema).toBe(REGISTRY_SCHEMA);
  });

  it("server.json npm package entry matches package.json name and version", () => {
    expect(serverJson.packages).toHaveLength(1);
    const entry = serverJson.packages[0];
    expect(entry.registryType).toBe("npm");
    expect(entry.identifier).toBe(pkg.name);
  });

  it("server.json description fits the registry's 100-character limit", () => {
    expect(serverJson.description.length).toBeLessThanOrEqual(100);
  });
});

describe("mcpb manifest consistency", () => {
  it("manifest conforms to the 0.3 spec", () => {
    expect(manifest.manifest_version).toBe("0.3");
  });

  it("manifest name is the machine-readable package basename", () => {
    expect(manifest.name).toBe(MCPB_NAME);
  });

  it("manifest entry point is the built server entrypoint", () => {
    expect(manifest.server.type).toBe("node");
    expect(manifest.server.entry_point).toBe("dist/index.js");
  });

  it("manifest mcp_config runs the entry point through node with the dirname token", () => {
    expect(manifest.server.mcp_config.command).toBe("node");
    expect(manifest.server.mcp_config.args).toContain(DIRNAME_ARG);
  });
});
