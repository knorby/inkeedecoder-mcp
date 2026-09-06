/**
 * Shared constants.
 *
 * TODO(template): replace `SERVER_NAME` and `SERVER_VERSION` with your own
 * values, and keep the version in sync with `package.json`.
 */

/** Server name advertised to hosts during initialization. */
export const SERVER_NAME = "repo-template-typescript-mcp";

/** Server version advertised to hosts during initialization. */
export const SERVER_VERSION = "0.0.0";

/**
 * Maximum characters a tool response may contain before it is truncated.
 * Large payloads blow up the model's context, so every tool that can return
 * a list checks this and reports truncation instead of dumping everything.
 */
export const CHARACTER_LIMIT = 25_000;

/** Default timeout for outgoing API calls, in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;
