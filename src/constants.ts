/**
 * Shared constants.
 *
 * Keep `SERVER_VERSION` in sync with `package.json`.
 */

/** Server name advertised to hosts during initialization. */
export const SERVER_NAME = "@knorby/inkeedecoder-mcp";

/** Server version advertised to hosts during initialization. */
export const SERVER_VERSION = "0.0.0";

/**
 * Maximum characters a tool response may contain before it is truncated.
 * Long ingredient lists and long-form writeups can be enormous, so tools
 * summarize in text and report truncation rather than flooding the context.
 */
export const CHARACTER_LIMIT = 25_000;

/** Default INKEEDecoder base URL, without a trailing slash. */
export const DEFAULT_BASE_URL = "https://inkeedecoder.com";

/** Default politeness delay in milliseconds between auto-paged requests. */
export const DEFAULT_REQUEST_INTERVAL_MS = 1_000;

/** Default cap on pages fetched in a single auto-paginated request. */
export const DEFAULT_MAX_PAGES = 25;

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
