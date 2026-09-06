/**
 * stderr-only logging.
 *
 * In a stdio server, stdout IS the JSON-RPC channel: a single `console.log`
 * corrupts the stream and breaks the host connection. Always log here.
 */

/** Writes an informational line to stderr. */
export function logInfo(message: string): void {
  process.stderr.write(`${message}\n`);
}

/** Writes a warning to stderr. */
export function logWarn(message: string): void {
  process.stderr.write(`warn: ${message}\n`);
}

/** Writes an error (with stack when available) to stderr. */
export function logError(message: string, cause?: unknown): void {
  const detail =
    cause instanceof Error ? ` ${cause.stack ?? cause.message}` : "";
  process.stderr.write(`error: ${message}${detail}\n`);
}
