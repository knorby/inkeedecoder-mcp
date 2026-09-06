import { CHARACTER_LIMIT } from "../constants.js";

/** Rendering helpers shared by the tools. */

/**
 * Truncates text that exceeds the character limit, appending a note telling
 * the model how to get the rest: narrow the request, or read the next page.
 */
export function applyCharacterLimit(
  text: string,
  limit: number = CHARACTER_LIMIT,
): string {
  if (text.length <= limit) return text;
  const notice =
    "\n\n[Response truncated. Turn off verbose flags (details, long_descriptions, skim_table, tooltips), narrow the query, or read a later page to see more.]";
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

/** Renders list items as "Name — /path" lines. */
export function refLines(
  items: readonly { name: string; path: string }[],
): string[] {
  return items.map((item) => `${item.name} — ${item.path}`);
}

/**
 * Tells the model how to continue a paginated result. Every list tool returns
 * one page at a time, so this hint is what turns a truncated answer into the
 * next request.
 */
export function morePagesNote(hasMore: boolean, nextPage: number): string {
  return hasMore
    ? `\n\nMore results available — call this tool again with page: ${nextPage}.`
    : "";
}
