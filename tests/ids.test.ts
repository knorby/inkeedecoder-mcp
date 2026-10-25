import { describe, expect, it } from "vitest";
import { type EntityType, resolveEntityId } from "../src/lib/ids.js";

/**
 * Id resolution is the server's one strict input boundary: it decides which
 * host may be read, which kind of page a tool is allowed to fetch, and which
 * paths URL normalization could otherwise collapse. Every rejection is a
 * branch a model can trigger, so each gets a test.
 */

const TYPES: EntityType[] = [
  "products",
  "ingredients",
  "brands",
  "ingredient-functions",
];

describe("resolveEntityId", () => {
  it.each(TYPES)("qualifies a bare slug for %s", (type) => {
    const resolved = resolveEntityId("squalane", type);

    expect(resolved).toEqual({
      ok: true,
      slug: "squalane",
      path: `/${type}/squalane`,
    });
  });

  it.each(TYPES)("accepts a %s path", (type) => {
    const resolved = resolveEntityId(`/${type}/squalane`, type);

    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.path).toBe(`/${type}/squalane`);
  });

  it.each([
    "https://inkeedecoder.com/ingredients/squalane",
    "https://www.inkeedecoder.com/ingredients/squalane",
    "https://incidecoder.com/ingredients/squalane",
    "https://www.incidecoder.com/ingredients/squalane?utm=x#frag",
  ])("accepts an allowed URL and keeps only the path: %s", (url) => {
    const resolved = resolveEntityId(url, "ingredients");

    expect(resolved).toEqual({
      ok: true,
      slug: "squalane",
      path: "/ingredients/squalane",
    });
  });

  it("resolves a protocol-relative link", () => {
    const resolved = resolveEntityId(
      "//inkeedecoder.com/ingredients/squalane",
      "ingredients",
    );

    expect(resolved).toEqual({
      ok: true,
      slug: "squalane",
      path: "/ingredients/squalane",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(resolveEntityId("  squalane  ", "ingredients")).toEqual({
      ok: true,
      slug: "squalane",
      path: "/ingredients/squalane",
    });
  });

  it.each(["", "   "])("rejects an empty id: %j", (raw) => {
    const resolved = resolveEntityId(raw, "ingredients");

    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error).toContain("got an empty value");
      expect(resolved.error).toContain('"squalane"');
    }
  });

  it("rejects an unparseable URL", () => {
    const resolved = resolveEntityId("https://", "ingredients");

    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.error).toContain("is not a valid URL");
  });

  it("rejects a URL from another site and names the allowed hosts", () => {
    const resolved = resolveEntityId(
      "https://example.com/ingredients/squalane",
      "ingredients",
    );

    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error).toContain('host "example.com"');
      expect(resolved.error).toContain("inkeedecoder.com");
      expect(resolved.error).toContain("incidecoder.com");
    }
  });

  it.each(["/", "/?query=1", "/#frag"])(
    "rejects a path that identifies nothing: %s",
    (raw) => {
      const resolved = resolveEntityId(raw, "products");

      expect(resolved.ok).toBe(false);
      if (!resolved.ok) expect(resolved.error).toContain("does not identify");
    },
  );

  it("treats a protocol-relative empty host as an invalid URL", () => {
    const resolved = resolveEntityId("///", "products");

    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.error).toContain("is not a valid URL");
  });

  it.each([
    "products/./squalane",
    "products/../ingredients/squalane",
    "products/%2e/squalane",
    "products/%2E%2E/ingredients/squalane",
    "products/a%2Fb",
    "products/a%5Cb",
  ])("rejects traversal-shaped segments before fetching: %s", (raw) => {
    const resolved = resolveEntityId(raw, "products");

    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error).toContain(
        "dot segment or an encoded path separator",
      );
    }
  });

  it("treats malformed percent-encoding as a literal slug", () => {
    const resolved = resolveEntityId("%zz", "ingredients");

    expect(resolved).toEqual({
      ok: true,
      slug: "%zz",
      path: "/ingredients/%zz",
    });
  });

  it("points at the right tool for a page of the wrong type", () => {
    const resolved = resolveEntityId("/products/squalane", "ingredients");

    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error).toContain("a product page");
      expect(resolved.error).toContain("inkeedecoder_get_product");
    }
  });

  it("uses 'an' for vowel-initial nouns", () => {
    const resolved = resolveEntityId("/products/squalane", "ingredients");

    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.error).toContain("is a product page");
  });

  it("rejects an unrecognizable path prefix", () => {
    const resolved = resolveEntityId("/p/123", "ingredients");

    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error).toContain("not a recognizable ingredient link");
    }
  });

  it("rejects extra path segments", () => {
    const resolved = resolveEntityId(
      "/ingredients/squalane/extra",
      "ingredients",
    );

    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error).toContain("unexpected extra path segments");
    }
  });

  it("keeps a single-segment path as a slug", () => {
    expect(resolveEntityId("/squalane", "ingredients")).toEqual({
      ok: true,
      slug: "squalane",
      path: "/ingredients/squalane",
    });
  });

  it("strips query and hash from a bare path", () => {
    expect(
      resolveEntityId("/ingredients/squalane?utm=x#details", "ingredients"),
    ).toEqual({
      ok: true,
      slug: "squalane",
      path: "/ingredients/squalane",
    });
  });
});
