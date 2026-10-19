import {
  createInkeedecoderClient,
  type InkeedecoderClient,
} from "@knorby/inkeedecoder-client";
import { readConfig } from "../config.js";

/**
 * The client every tool uses, cached per configuration.
 *
 * One client per configuration (rather than one per call) is what makes the
 * politeness interval real across tool calls: the library spaces requests per
 * client instance, so separate calls must share an instance or their requests
 * arrive back-to-back. The cache key is the configuration the client was
 * built from, so a settings change — as tests make — builds a fresh client
 * rather than serving a stale one.
 *
 * The client is stateless apart from its options and its request schedule;
 * it holds no sockets, so sharing it is safe.
 */

export type ClientResult =
  | { ok: true; client: InkeedecoderClient }
  | { ok: false; error: string };

let cached: { key: string; result: ClientResult } | undefined;

/** @returns A configured client, or an error message to return to the caller. */
export function getClient(): ClientResult {
  const config = readConfig();
  if (!config.ok) return { ok: false, error: config.error };

  const {
    INKEEDECODER_BASE_URL: baseUrl,
    INKEEDECODER_REQUEST_INTERVAL_MS: requestIntervalMs,
    INKEEDECODER_TIMEOUT_MS: timeoutMs,
  } = config.config;

  const key = `${baseUrl}|${requestIntervalMs}|${timeoutMs}`;
  if (cached?.key === key) return cached.result;

  let result: ClientResult;
  try {
    result = {
      ok: true,
      client: createInkeedecoderClient({
        baseUrl,
        requestIntervalMs,
        timeoutMs,
      }),
    };
  } catch (error) {
    result = {
      ok: false,
      error: `Error: could not create the INKEEDecoder client: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  cached = { key, result };
  return result;
}

/**
 * Drops the cached client. Tests call this alongside `resetConfig()` after
 * changing the environment, when they need a client with a fresh request
 * schedule.
 */
export function resetClient(): void {
  cached = undefined;
}
