import {
  createInkeedecoderClient,
  type InkeedecoderClient,
} from "@knorby/inkeedecoder-client";
import { readConfig } from "../config.js";

/**
 * Builds an INKEEDecoder client from the current configuration.
 *
 * A client per call (rather than a module-level singleton) keeps configuration
 * changes visible — including in tests, which mutate `process.env` — and
 * costs nothing: the client is stateless apart from its options and holds no
 * sockets.
 */

export type ClientResult =
  | { ok: true; client: InkeedecoderClient }
  | { ok: false; error: string };

/** @returns A configured client, or an error message to return to the caller. */
export function getClient(): ClientResult {
  const config = readConfig();
  if (!config.ok) return { ok: false, error: config.error };

  try {
    return {
      ok: true,
      client: createInkeedecoderClient({
        baseUrl: config.config.INKEEDECODER_BASE_URL,
        requestIntervalMs: config.config.INKEEDECODER_REQUEST_INTERVAL_MS,
        maxPages: config.config.INKEEDECODER_MAX_PAGES,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: `Error: could not create the INKEEDecoder client: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
