#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const [localPath, registryPath] = process.argv.slice(2);
if (!localPath || !registryPath) {
  console.error("usage: check-registry-record.mjs <server.json> <registry.json>");
  process.exit(1);
}

/**
 * The registry API omits `isRequired: false` and `isSecret: false`
 * environment-variable defaults. Remove those defaults from both sides before
 * comparison; non-default values remain and any other drift still differs.
 */
function normalizePackageForComparison(pkg) {
  const { environmentVariables, ...rest } = pkg;
  if (!environmentVariables) {
    return rest;
  }
  return {
    ...rest,
    environmentVariables: environmentVariables.map(
      ({ isRequired = false, isSecret = false, ...variable }) => ({
        ...variable,
        ...(isRequired ? { isRequired } : {}),
        ...(isSecret ? { isSecret } : {}),
      }),
    ),
  };
}

const local = JSON.parse(readFileSync(localPath, "utf8"));
const published = JSON.parse(readFileSync(registryPath, "utf8"));

assert.equal(published.server?.name, local.name, "published registry name differs");
assert.equal(
  published.server?.version,
  local.version,
  "published registry version differs",
);
assert.deepEqual(
  (published.server?.packages ?? []).map(normalizePackageForComparison),
  local.packages.map(normalizePackageForComparison),
  "published registry packages differs",
);
