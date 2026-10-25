/**
 * Copies `package.json`'s version into the metadata files that repeat it:
 * `server.json` (Official MCP Registry) and `manifest.json` (MCPB).
 *
 * The release workflow runs `changeset version` (which only bumps
 * `package.json`) and then this script, so the release commit leaves all
 * three files consistent. `tests/metadata.test.ts` refuses to let them drift.
 *
 * Usage: `npx tsx scripts/sync-metadata-version.ts [root]`
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const METADATA_FILES = ["server.json", "manifest.json"] as const;

export interface SyncResult {
  version: string;
  files: readonly string[];
}

interface VersionedJson {
  version?: unknown;
  packages?: Array<{ version?: unknown }>;
}

/** Rewrites the metadata files under `root`; returns the version applied. */
export function syncMetadataVersion(root: string = process.cwd()): SyncResult {
  const dir = resolve(root);

  const pkg = JSON.parse(
    readFileSync(join(dir, "package.json"), "utf8"),
  ) as VersionedJson;
  const version = pkg.version;
  if (typeof version !== "string" || version.length === 0) {
    throw new Error(`No version in ${join(dir, "package.json")}`);
  }

  const serverPath = join(dir, "server.json");
  const server = JSON.parse(readFileSync(serverPath, "utf8")) as VersionedJson;
  server.version = version;
  for (const entry of server.packages ?? []) entry.version = version;
  writeFileSync(serverPath, `${JSON.stringify(server, null, 2)}\n`);

  const manifestPath = join(dir, "manifest.json");
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as VersionedJson;
  manifest.version = version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return { version, files: METADATA_FILES };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = syncMetadataVersion(process.argv[2]);
  process.stderr.write(
    `Synced ${result.files.join(", ")} to ${result.version}\n`,
  );
}
