import { CHARACTER_LIMIT } from "../constants.js";

/** Output formats tools offer: human-readable markdown or machine-readable JSON. */
export const RESPONSE_FORMATS = ["markdown", "json"] as const;

export type ResponseFormat = (typeof RESPONSE_FORMATS)[number];

/** Serializes a value as indented JSON. */
export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Truncates text that exceeds the character limit, appending a note telling
 * the model how to get the rest (narrow the query, or page with `offset`).
 */
export function applyCharacterLimit(
  text: string,
  limit: number = CHARACTER_LIMIT,
): string {
  if (text.length <= limit) return text;
  const notice = `\n\n[Response truncated at ${limit} characters. Narrow the query or page with 'offset' to see more.]`;
  return `${text.slice(0, Math.max(0, limit - notice.length))}${notice}`;
}

/** Renders a sectioned markdown list. */
export function markdownBullets(
  title: string,
  lines: readonly string[],
): string {
  if (lines.length === 0) return `${title}\n\n- (none)`;
  return [`${title}\n`, ...lines.map((line) => `- ${line}`)].join("\n");
}
