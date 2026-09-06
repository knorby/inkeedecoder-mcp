/**
 * Turns an unknown thrown value into text a model can act on.
 *
 * Tool handlers return this in `content` with `isError: true` instead of
 * throwing — a thrown error becomes an opaque protocol error, while a returned
 * error tells the model what to do next.
 *
 * `@knorby/inkeedecoder-client` throws plain `Error`s whose messages embed the
 * HTTP status (`Request to <url> failed: 404 Not Found`), so status handling
 * starts by reading it back out of the message.
 */

/** Matches the client's `Request to <url> failed: <status> <statusText>`. */
const STATUS_IN_MESSAGE = /failed:\s*(\d{3})/;

/** Network-level failures: nothing reached the site at all. */
const NETWORK_FAILURE =
  /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|fetch failed|network|getaddrinfo/i;

export function toUserMessage(error: unknown, context: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const status = raw.match(STATUS_IN_MESSAGE)?.[1];

  if (status === "404") {
    return `Error: ${context} — not found (HTTP 404). The slug may be stale: use the last segment of the page URL, and try inkeedecoder_search to find the current one.`;
  }
  if (status === "403") {
    return `Error: ${context} — access denied (HTTP 403). INKEEDecoder is refusing the request; slow down and retry later.`;
  }
  if (status === "429") {
    return `Error: ${context} — rate limited (HTTP 429). Wait before retrying; raise INKEEDECODER_REQUEST_INTERVAL_MS to slow the server down.`;
  }
  if (status?.startsWith("5")) {
    return `Error: ${context} — INKEEDecoder returned HTTP ${status}. The site may be down; retry shortly.`;
  }
  if (status) {
    return `Error: ${context} — HTTP ${status}. ${raw}`;
  }

  if (NETWORK_FAILURE.test(raw)) {
    return `Error: ${context} — could not reach INKEEDecoder (${raw}). Check connectivity and INKEEDECODER_BASE_URL.`;
  }
  if (/abort|timed out|timeout/i.test(raw)) {
    return `Error: ${context} — the request timed out. Retry once; if it persists, the site may be blocking the request volume.`;
  }

  return `Error: ${context} failed unexpectedly: ${raw}`;
}
