import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readPackageVersion, SERVER_VERSION } from "../src/constants.js";

/**
 * The advertised version comes from package.json at load time so a version
 * bump cannot leave hosts seeing a stale number. The fallbacks matter too: an
 * unreadable or malformed manifest must not stop the server from booting.
 */

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

describe("readPackageVersion", () => {
  it("reads the version from a package manifest", () => {
    expect(
      readPackageVersion(new URL("../package.json", import.meta.url)),
    ).toBe(pkg.version);
  });

  it("falls back when the manifest is unreadable", () => {
    expect(
      readPackageVersion(
        new URL("../no-such-file/package.json", import.meta.url),
      ),
    ).toBe("0.0.0");
  });

  it("falls back when the manifest is not JSON", () => {
    expect(
      readPackageVersion(
        new URL("../tests/fixtures/README.md", import.meta.url),
      ),
    ).toBe("0.0.0");
  });

  it("falls back when the manifest has no version", () => {
    expect(readPackageVersion(new URL("../biome.json", import.meta.url))).toBe(
      "0.0.0",
    );
  });

  it("advertises the package version as SERVER_VERSION", () => {
    expect(SERVER_VERSION).toBe(pkg.version);
  });
});
