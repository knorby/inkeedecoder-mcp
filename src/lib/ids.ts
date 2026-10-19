import { ALLOWED_HOSTS } from "../constants.js";

/**
 * Resolution of the `id` argument every lookup tool takes.
 *
 * The client library already accepts a slug, a site path, or an absolute URL,
 * but it checks neither *which site* a URL points at nor *what kind of page*
 * it is. Both gaps matter for an MCP server:
 *
 * - An incidecoder.com link (the site's former name) must resolve against
 *   inkeedecoder.com. We take only the path and let the client fetch it from
 *   the configured base URL, so the old domain is never contacted — and a
 *   stale link from a chat transcript still works.
 * - A model that guesses wrong and passes an ingredient URL to the product
 *   tool would otherwise fetch an ingredient page and parse it as a product,
 *   producing plausible nonsense. Checking the type prefix turns that into a
 *   message naming the right tool.
 *
 * Resolution is strict about the shape of a path: exactly `/<type>/<slug>`.
 * Dot segments (`.` or `..`, raw or percent-encoded) and extra path segments
 * are rejected, because URL normalization at fetch time would otherwise
 * collapse them — `/products/../ingredients/squalane` would silently become
 * an ingredient page fetched by the product tool.
 */

/** Entity types as they appear in inkeedecoder.com URL paths. */
export type EntityType =
  | "products"
  | "ingredients"
  | "brands"
  | "ingredient-functions";

/** Tool that reads each entity type — used to point callers at the right one. */
const TOOL_FOR_TYPE: Record<EntityType, string> = {
  products: "inkeedecoder_get_product",
  ingredients: "inkeedecoder_get_ingredient",
  brands: "inkeedecoder_get_brand",
  "ingredient-functions": "inkeedecoder_get_ingredient_function",
};

/** Singular noun for each type, for readable errors. */
const SINGULAR: Record<EntityType, string> = {
  products: "product",
  ingredients: "ingredient",
  brands: "brand",
  "ingredient-functions": "ingredient function",
};

/** A representative slug for each type, used in "expected X" messages. */
const EXAMPLE: Record<EntityType, string> = {
  products: "the-ordinary-retinol-1-in-squalane",
  ingredients: "squalane",
  brands: "the-ordinary",
  "ingredient-functions": "emollient",
};

export type ResolvedId =
  | { ok: true; path: string; slug: string }
  | { ok: false; error: string };

const ALLOWED = new Set<string>(ALLOWED_HOSTS);

/** Drops the query string and fragment, which never identify the entity. */
function stripQueryAndHash(input: string): string {
  return input.split("?")[0]?.split("#")[0] ?? "";
}

/** "ingredient" -> "an ingredient", for readable error messages. */
function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

/**
 * Rejects the segments URL normalization could collapse: dot segments in raw
 * or percent-encoded form (`%2e`, `%2E`), and anything that decodes to a path
 * separator. A segment whose percent-encoding is malformed is left alone —
 * the URL parser treats it as a literal, so it cannot traverse.
 */
function isUnsafeSegment(segment: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return false; // malformed encoding: literal, not a traversal vector
  }
  return (
    decoded === "." ||
    decoded === ".." ||
    decoded.includes("/") ||
    decoded.includes("\\")
  );
}

/**
 * Resolves a caller-supplied id into the site path to fetch.
 *
 * Accepts a bare slug (`"squalane"`), a site path (`"/ingredients/squalane"`),
 * or an absolute URL on {@link ALLOWED_HOSTS} (either the current
 * inkeedecoder.com or the older incidecoder.com). A bare slug is qualified
 * with the expected entity type.
 *
 * @param raw The id as supplied by the model or user.
 * @param expected The entity type the calling tool reads.
 */
export function resolveEntityId(raw: string, expected: EntityType): ResolvedId {
  const what = SINGULAR[expected];
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      ok: false,
      error: `Error: expected a ${what} slug, path, or URL, but got an empty value. Example: "${EXAMPLE[expected]}".`,
    };
  }

  let candidate = trimmed;
  // Protocol-relative links ("//inkeedecoder.com/...") come from scraped HTML.
  if (candidate.startsWith("//")) {
    candidate = `https:${candidate}`;
  }

  if (/^https?:\/\//i.test(candidate)) {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      return {
        ok: false,
        error: `Error: "${trimmed}" is not a valid URL. Pass the ${what} slug instead, for example "${EXAMPLE[expected]}".`,
      };
    }

    const host = url.hostname.toLowerCase();
    if (!ALLOWED.has(host)) {
      return {
        ok: false,
        error: `Error: "${trimmed}" is not an INKEEDecoder link (host "${host}"). This server only reads ${ALLOWED_HOSTS.join(", ")}. Pass the ${what} slug instead — the last segment of the path, for example "${EXAMPLE[expected]}".`,
      };
    }

    candidate = stripQueryAndHash(url.pathname);
  } else {
    candidate = stripQueryAndHash(candidate);
  }

  const segments = candidate.split("/").filter(Boolean);

  if (segments.length === 0) {
    return {
      ok: false,
      error: `Error: "${trimmed}" does not identify a ${what}. Expected a slug like "${EXAMPLE[expected]}" or a path like "/${expected}/${EXAMPLE[expected]}".`,
    };
  }

  for (const segment of segments) {
    if (isUnsafeSegment(segment)) {
      return {
        ok: false,
        error: `Error: "${trimmed}" is not a usable ${what} id — it contains a dot segment or an encoded path separator. Pass the slug directly, for example "${EXAMPLE[expected]}".`,
      };
    }
  }

  // Bare slug: qualify it so the client fetches the right kind of page.
  if (segments.length === 1) {
    const slug = segments[0] ?? "";
    return { ok: true, slug, path: `/${expected}/${slug}` };
  }

  const [type, ...rest] = segments;
  if (type !== expected) {
    const suggestion = TOOL_FOR_TYPE[type as EntityType];
    return {
      ok: false,
      error: suggestion
        ? `Error: "${trimmed}" is ${withArticle(SINGULAR[type as EntityType] ?? type)} page, but this tool reads ${expected}. Call ${suggestion} instead.`
        : `Error: "${trimmed}" is not a recognizable ${what} link. Expected a path under "/${expected}/", for example "/${expected}/${EXAMPLE[expected]}".`,
    };
  }

  if (rest.length !== 1) {
    return {
      ok: false,
      error: `Error: "${trimmed}" has unexpected extra path segments. Expected exactly "/${expected}/<slug>", for example "/${expected}/${EXAMPLE[expected]}".`,
    };
  }

  const slug = rest[0] ?? "";
  return { ok: true, slug, path: `/${expected}/${slug}` };
}
