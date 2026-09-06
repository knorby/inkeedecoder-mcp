import * as z from "zod/v4";
import {
  DEFAULT_BASE_URL,
  DEFAULT_MAX_PAGES,
  DEFAULT_REQUEST_INTERVAL_MS,
} from "./constants.js";

/**
 * Environment configuration, parsed lazily with Zod.
 *
 * Two rules shape this module:
 *
 * 1. **Never throw at startup.** A misconfigured server should still boot and
 *    answer `tools/list`, so a host can show the operator what is wrong.
 *    Configuration is therefore read when a tool runs, and problems come back
 *    as an actionable result rather than a crash.
 * 2. **Validate, do not trust.** `process.env` is `string | undefined`; Zod
 *    coerces and constrains it once, here.
 *
 * INKEEDecoder is a public site with no API key, so every variable is
 * optional: the defaults scrape inkeedecoder.com politely. The knobs exist for
 * mirrors, self-hosted archives, and tuning politeness.
 */

const EnvSchema = z.object({
  /**
   * Base URL of the site to read, without a trailing slash. Point this at a
   * mirror or a locally archived copy; ids and paths are appended to it.
   */
  INKEEDECODER_BASE_URL: z.url().default(DEFAULT_BASE_URL),
  /**
   * Minimum delay in milliseconds between requests made while auto-paging.
   * Be considerate: the site is a volunteer-run database.
   */
  INKEEDECODER_REQUEST_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(0)
    .default(DEFAULT_REQUEST_INTERVAL_MS),
  /**
   * Safety cap on how many pages a single auto-paginated request may walk.
   */
  INKEEDECODER_MAX_PAGES: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_MAX_PAGES),
});

export type Config = z.infer<typeof EnvSchema>;

export type ConfigResult =
  | { ok: true; config: Config }
  | { ok: false; error: string };

let cached: ConfigResult | undefined;

/**
 * Reads and caches configuration from `process.env`.
 *
 * @returns The parsed config, or an error message describing what is wrong.
 */
export function readConfig(): ConfigResult {
  if (cached) return cached;

  const parsed = EnvSchema.safeParse(process.env);
  cached = parsed.success
    ? { ok: true, config: parsed.data }
    : {
        ok: false,
        error: `Invalid environment configuration: ${z.prettifyError(parsed.error)}`,
      };
  return cached;
}

/**
 * Clears the cached configuration. Tests call this after mutating
 * `process.env`.
 */
export function resetConfig(): void {
  cached = undefined;
}
