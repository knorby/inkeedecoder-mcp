import { describe, expect, it } from "vitest";
import {
  applyCharacterLimit,
  boundStructured,
  markdownBullets,
  morePagesNote,
  refLines,
  truncationNote,
} from "../src/lib/format.js";

/**
 * The response-bounding helpers decide what a model sees when a page is large.
 * Both halves are pinned here: text truncation says so in the text, and
 * structured bounding keeps the value valid while reporting that it cut.
 */

describe("applyCharacterLimit", () => {
  it("leaves text at or under the limit alone", () => {
    expect(applyCharacterLimit("short", 10)).toBe("short");
    expect(applyCharacterLimit("1234567890", 10)).toBe("1234567890");
  });

  it("truncates over-limit text and appends the recovery notice", () => {
    const text = "x".repeat(1_000);

    const bounded = applyCharacterLimit(text, 300);

    expect(bounded.length).toBeLessThanOrEqual(300);
    expect(bounded).toContain("[Response truncated.");
    expect(bounded).toContain("verbose flags");
  });

  it("returns only the notice when the limit is smaller than the notice", () => {
    const bounded = applyCharacterLimit("x".repeat(100), 5);

    expect(bounded.startsWith("x")).toBe(false);
    expect(bounded).toContain("[Response truncated.");
  });
});

describe("boundStructured", () => {
  it("returns small values unchanged and untruncated", () => {
    const value = { name: "squalane", items: ["one"] };

    expect(boundStructured(value, 1_000)).toEqual({
      value,
      truncated: false,
    });
  });

  it("shortens long strings and trims long arrays when over the limit", () => {
    const value = {
      name: "x".repeat(500),
      items: Array.from({ length: 300 }, (_, i) => ({ name: `item-${i}` })),
    };

    const result = boundStructured(value, 2_000);

    expect(result.truncated).toBe(true);
    const bounded = result.value as typeof value;
    // Bounding tries the widest caps first, so short-enough strings survive
    // untouched and only the array is trimmed.
    expect(bounded.name).toBe(value.name);
    expect(bounded.items.length).toBeLessThan(300);
    expect(JSON.stringify(bounded).length).toBeLessThanOrEqual(2_000);
  });

  it("keeps tightening until even nested values fit", () => {
    const value = Array.from({ length: 500 }, (_, i) => ({
      name: `entry-${i}`.padEnd(400, "x"),
      nested: { text: "y".repeat(300) },
    }));

    const result = boundStructured(value, 2_000);

    expect(result.truncated).toBe(true);
    expect(JSON.stringify(result.value).length).toBeLessThanOrEqual(2_000);
    expect((result.value as unknown[]).length).toBeLessThan(500);
  });

  it("stops at the tightest caps when the limit cannot be met", () => {
    const value = Array.from({ length: 500 }, (_, i) => ({
      name: `entry-${i}`.padEnd(400, "x"),
      nested: { text: "y".repeat(300) },
    }));

    const result = boundStructured(value, 100);

    expect(result.truncated).toBe(true);
    expect((result.value as unknown[]).length).toBe(3);
  });

  it("passes through primitives and nulls inside a value", () => {
    const value = { count: 3, flag: true, missing: null, empty: undefined };

    const result = boundStructured(value, 1_000);

    expect(result.value).toEqual(value);
  });
});

describe("text helpers", () => {
  it("renders truncation and pagination notes", () => {
    expect(truncationNote(25_000)).toContain("25,000-character response limit");
    expect(morePagesNote(true, 3)).toContain("page: 3");
    expect(morePagesNote(false, 3)).toBe("");
  });

  it("renders bullet lists, including the empty state", () => {
    expect(markdownBullets("Title", [])).toBe("Title\n\n- (none)");
    expect(markdownBullets("Title", ["one", "two"])).toBe(
      "Title\n\n- one\n- two",
    );
  });

  it("renders references as name — path lines", () => {
    expect(
      refLines([
        { name: "Squalane", path: "/ingredients/squalane" },
        { name: "Tocopherol", path: "/ingredients/tocopherol" },
      ]),
    ).toEqual([
      "Squalane — /ingredients/squalane",
      "Tocopherol — /ingredients/tocopherol",
    ]);
  });
});
