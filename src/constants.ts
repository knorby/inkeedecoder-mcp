import { readFileSync } from "node:fs";

/**
 * Shared constants.
 *
 * `SERVER_VERSION` is read from `package.json` at load time. This module sits
 * one directory below the package root in both layouts it runs in — `src/`
 * during development and `dist/` once bundled — so the read keeps working
 * everywhere. Deriving it means a `changeset version` bump cannot leave the
 * version a host sees stale; the fallback keeps the server usable if the file
 * is unreadable.
 */

/** Server name advertised to hosts during initialization. */
export const SERVER_NAME = "@knorby/inkeedecoder-mcp";

/** Server version advertised to hosts, derived from `package.json`. */
export const SERVER_VERSION = readPackageVersion();

/**
 * Maximum characters a tool response may contain before it is bounded — the
 * text block by truncation, and `structuredContent` by `boundStructured`.
 */
export const CHARACTER_LIMIT = 25_000;

/** Default INKEEDecoder base URL, without a trailing slash. */
export const DEFAULT_BASE_URL = "https://inkeedecoder.com";

/** Default spacing in milliseconds between requests. */
export const DEFAULT_REQUEST_INTERVAL_MS = 1_000;

/** Default per-request timeout in milliseconds. `0` disables the timeout. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Hosts accepted in tool `id` arguments.
 *
 * INCIDecoder renamed itself to INKEEDecoder after a trademark dispute with
 * PCPC, the body that owns the INCI nomenclature (see
 * https://inkeedecoder.com/new-name). It is the same site and the same
 * database — old incidecoder.com URLs redirect to inkeedecoder.com — so both
 * hosts are accepted here. Only the *path* of an allowed URL is used: requests
 * always go to the configured base URL, so an old link never causes a request
 * to the old domain.
 */
export const ALLOWED_HOSTS = [
  "inkeedecoder.com",
  "www.inkeedecoder.com",
  "incidecoder.com",
  "www.incidecoder.com",
] as const;

/** Reads `version` from the package manifest next to this module's root. */
function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: unknown };
    return typeof pkg.version === "string" && pkg.version.length > 0
      ? pkg.version
      : "0.0.0";
  } catch {
    return "0.0.0";
  }
}
