import * as z from "zod/v4";
import { DEFAULT_TIMEOUT_MS } from "./constants.js";

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
 * TODO(template): replace `EXAMPLE_*` with the variables your API needs.
 */

const EnvSchema = z.object({
  /** API key for the wrapped service. Required by tools that call the API. */
  EXAMPLE_API_KEY: z.string().min(1).optional(),
  /** Base URL of the wrapped API, without a trailing slash. */
  EXAMPLE_API_BASE_URL: z.url().default("https://api.example.com/v1"),
  /** Per-request timeout in milliseconds. */
  EXAMPLE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_TIMEOUT_MS),
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
