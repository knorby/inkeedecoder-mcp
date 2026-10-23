import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Pins the distribution metadata (package.json, server.json, manifest.json)
 * to a single source of truth: package.json. The Official MCP Registry
 * rejects publishes whose name/version drift from the npm package, and the
 * MCPB manifest embeds the same values — so a release that bumps one file
 * and not the others fails here, at PR time, instead of at publish time.
 */

const REGISTRY_NAME = "io.github.knorby/inkeedecoder-mcp";
const REGISTRY_SCHEMA =
  "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
const MCPB_NAME = "inkeedecoder-mcp";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
  name: string;
  version: string;
  mcpName?: string;
};

const serverJson = JSON.parse(
  readFileSync(new URL("../server.json", import.meta.url), "utf8"),
) as {
  $schema: string;
  name: string;
  version: string;
  description: string;
  packages: Array<{
    registryType: string;
    identifier: string;
    version: string;
  }>;
};

const manifest = JSON.parse(
  readFileSync(new URL("../manifest.json", import.meta.url), "utf8"),
) as {
  manifest_version: string;
  name: string;
  version: string;
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

  it("server.json version matches package.json version", () => {
    expect(serverJson.version).toBe(pkg.version);
  });

  it("server.json references the pinned registry schema", () => {
    expect(serverJson.$schema).toBe(REGISTRY_SCHEMA);
  });

  it("server.json npm package entry matches package.json name and version", () => {
    expect(serverJson.packages).toHaveLength(1);
    const entry = serverJson.packages[0];
    expect(entry.registryType).toBe("npm");
    expect(entry.identifier).toBe(pkg.name);
    expect(entry.version).toBe(pkg.version);
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

  it("manifest version matches package.json version", () => {
    expect(manifest.version).toBe(pkg.version);
  });

  it("manifest entry point is the built server entrypoint", () => {
    expect(manifest.server.type).toBe("node");
    expect(manifest.server.entry_point).toBe("dist/index.js");
  });

  it("manifest mcp_config runs the entry point through node with ${__dirname}", () => {
    expect(manifest.server.mcp_config.command).toBe("node");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: MCPB substitution syntax, not a JS template
    expect(manifest.server.mcp_config.args).toContain(
      "${__dirname}/dist/index.js",
    );
  });
});
