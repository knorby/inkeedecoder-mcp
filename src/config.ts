import * as z from "zod/v4";
import {
  ALLOWED_HOSTS,
  DEFAULT_BASE_URL,
  DEFAULT_REQUEST_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
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
 * optional: the defaults read inkeedecoder.com politely. The base URL and
 * interval knobs exist for mirrors and self-hosted archives — where the
 * pacing floor below deliberately does not apply, because the polite pace
 * protects inkeedecoder.com itself, not someone's own copy.
 */

const SITE_HOSTS = new Set<string>(ALLOWED_HOSTS);

const EnvSchema = z
  .object({
    /**
     * Base URL of the site to read, without a trailing slash. Point this at a
     * mirror or a locally archived copy; ids and paths are appended to it.
     */
    INKEEDECODER_BASE_URL: z.url().default(DEFAULT_BASE_URL),
    /**
     * Minimum spacing in milliseconds between requests. Requests are spaced
     * per server, not per tool call, so rapid successive calls cannot hammer
     * the site. Values below the default are accepted only for mirrors; when
     * the base URL is inkeedecoder.com itself the default is a floor.
     */
    INKEEDECODER_REQUEST_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(0)
      .default(DEFAULT_REQUEST_INTERVAL_MS),
    /**
     * Abandon a request that takes longer than this, in milliseconds. `0`
     * disables the timeout.
     */
    INKEEDECODER_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(0)
      .default(DEFAULT_TIMEOUT_MS),
  })
  .superRefine((env, ctx) => {
    if (env.INKEEDECODER_REQUEST_INTERVAL_MS >= DEFAULT_REQUEST_INTERVAL_MS) {
      return;
    }
    let host: string;
    try {
      host = new URL(env.INKEEDECODER_BASE_URL).hostname.toLowerCase();
    } catch {
      return; // z.url() already rejects malformed URLs
    }
    if (!SITE_HOSTS.has(host)) {
      return; // a mirror may be paced differently
    }
    ctx.addIssue({
      code: "custom",
      path: ["INKEEDECODER_REQUEST_INTERVAL_MS"],
      message: `must be at least ${DEFAULT_REQUEST_INTERVAL_MS} ms when reading ${host} directly (the site's etiquette). Point INKEEDECODER_BASE_URL at a mirror, or raise the interval.`,
    });
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
