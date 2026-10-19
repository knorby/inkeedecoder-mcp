import { CHARACTER_LIMIT } from "../constants.js";

/** Rendering helpers shared by the tools. */

/**
 * Truncates text that exceeds the character limit, appending a note telling
 * the model how to get the rest: narrow the request, or read the next page.
 *
 * Text is only half the response: `structuredContent` is bounded separately by
 * {@link boundStructured}, since a host hands both to the model.
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

/** The result of {@link boundStructured}: the bounded value and whether anything was cut. */
export interface BoundedResult<T> {
  value: T;
  truncated: boolean;
}

/**
 * Progressively tighter (string length, array items) caps tried until the
 * serialized value fits, largest first so the least data is lost.
 */
const BOUNDING_STEPS: ReadonlyArray<readonly [number, number]> = [
  [8_000, 200],
  [4_000, 100],
  [2_000, 50],
  [1_000, 25],
  [400, 8],
  [150, 3],
];

/**
 * Bounds a structured result to the character limit.
 *
 * The zod output schemas stay valid because bounding only shortens strings
 * (with a visible `…[truncated]` marker) and trims long arrays; it never
 * drops fields or changes types. Tools append {@link truncationNote} to the
 * text block when this reports `truncated`, so nothing is silently cut.
 */
export function boundStructured<T>(
  value: T,
  limit: number = CHARACTER_LIMIT,
): BoundedResult<T> {
  if (JSON.stringify(value).length <= limit) {
    return { value, truncated: false };
  }

  let candidate = value;
  for (const [maxStringChars, maxArrayItems] of BOUNDING_STEPS) {
    candidate = boundValue(value, maxStringChars, maxArrayItems);
    if (JSON.stringify(candidate).length <= limit) break;
  }
  return { value: candidate, truncated: true };
}

/** The note tools append to their text block when bounding engaged. */
export function truncationNote(limit: number = CHARACTER_LIMIT): string {
  return `\n\n[Some fields were shortened: the full result would exceed the ${limit.toLocaleString("en-US")}-character response limit. Narrow the request — fewer verbose sections — for the complete text of a section.]`;
}

/** Recursively clones a value, shortening strings and slicing arrays. */
function boundValue<T>(
  value: T,
  maxStringChars: number,
  maxArrayItems: number,
): T {
  if (typeof value === "string") {
    return (
      value.length > maxStringChars
        ? `${value.slice(0, maxStringChars)}…[truncated]`
        : value
    ) as T;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, maxArrayItems)
      .map((item) => boundValue(item, maxStringChars, maxArrayItems)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = boundValue(item, maxStringChars, maxArrayItems);
    }
    return out as T;
  }
  return value;
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
