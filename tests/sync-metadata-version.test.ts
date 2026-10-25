import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { syncMetadataVersion } from "../scripts/sync-metadata-version.js";

/**
 * The release workflow bumps package.json with `changeset version`, then runs
 * this helper so the registry and MCPB metadata carry the same version. The
 * metadata test pins equality; this pins the helper that restores it.
 */

function fixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "metadata-sync-"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "@knorby/x", version: "1.4.2" }, null, 2),
  );
  writeFileSync(
    join(dir, "server.json"),
    JSON.stringify(
      {
        $schema: "https://example.test/schema.json",
        name: "io.github.knorby/x",
        version: "1.4.1",
        packages: [
          { registryType: "npm", identifier: "@knorby/x", version: "1.4.1" },
        ],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        manifest_version: "0.3",
        name: "x",
        version: "1.4.1",
        server: { type: "node", entry_point: "dist/index.js" },
      },
      null,
      2,
    ),
  );
  return dir;
}

describe("syncMetadataVersion", () => {
  it("writes the package version into server.json and manifest.json", () => {
    const dir = fixtureDir();

    const result = syncMetadataVersion(dir);

    expect(result).toEqual({
      version: "1.4.2",
      files: ["server.json", "manifest.json"],
    });

    const server = JSON.parse(readFileSync(join(dir, "server.json"), "utf8"));
    expect(server.version).toBe("1.4.2");
    expect(server.packages[0].version).toBe("1.4.2");

    const manifest = JSON.parse(
      readFileSync(join(dir, "manifest.json"), "utf8"),
    );
    expect(manifest.version).toBe("1.4.2");
  });

  it("preserves every other field", () => {
    const dir = fixtureDir();

    syncMetadataVersion(dir);

    const server = JSON.parse(readFileSync(join(dir, "server.json"), "utf8"));
    expect(server.$schema).toBe("https://example.test/schema.json");
    expect(server.name).toBe("io.github.knorby/x");
    expect(server.packages[0].identifier).toBe("@knorby/x");

    const manifest = JSON.parse(
      readFileSync(join(dir, "manifest.json"), "utf8"),
    );
    expect(manifest.manifest_version).toBe("0.3");
    expect(manifest.server.entry_point).toBe("dist/index.js");
  });

  it("is idempotent", () => {
    const dir = fixtureDir();

    syncMetadataVersion(dir);
    const first = readFileSync(join(dir, "server.json"), "utf8");
    syncMetadataVersion(dir);

    expect(readFileSync(join(dir, "server.json"), "utf8")).toBe(first);
  });

  it("fails loudly when a metadata file is missing", () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, "manifest.json"), "");

    expect(() => syncMetadataVersion(dir)).toThrow();
  });
});
