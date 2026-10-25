import { describe, expect, it } from "vitest";
import { toUserMessage } from "../src/lib/errors.js";

/**
 * The error translator is the only place a model learns what went wrong and
 * what to do next, so every branch gets a test: a status that maps to a
 * specific recovery, the request-control failures, and the unknown case.
 */

describe("toUserMessage", () => {
  it("maps 404 to a stale-slug recovery", () => {
    const message = toUserMessage(
      new Error(
        "Request to https://inkeedecoder.com/products/x failed: 404 Not Found",
      ),
      "Product lookup",
    );

    expect(message).toContain("not found (HTTP 404)");
    expect(message).toContain("inkeedecoder_search");
  });

  it("maps 403 to a slow-down recovery", () => {
    const message = toUserMessage(
      new Error("Request to https://inkeedecoder.com/x failed: 403 Forbidden"),
      "Search",
    );

    expect(message).toContain("access denied (HTTP 403)");
    expect(message).toContain("slow down");
  });

  it("maps 429 to a rate-limit recovery", () => {
    const message = toUserMessage(
      new Error("Request to https://inkeedecoder.com/x failed: 429 Too Many"),
      "Search",
    );

    expect(message).toContain("rate limited (HTTP 429)");
    expect(message).toContain("INKEEDECODER_REQUEST_INTERVAL_MS");
  });

  it("maps 5xx to a site-down recovery", () => {
    const message = toUserMessage(
      new Error(
        "Request to https://inkeedecoder.com/x failed: 503 Unavailable",
      ),
      "Search",
    );

    expect(message).toContain("HTTP 503");
    expect(message).toContain("site may be down");
  });

  it("keeps the original message for other statuses", () => {
    const message = toUserMessage(
      new Error("Request to https://inkeedecoder.com/x failed: 418 Teapot"),
      "Search",
    );

    expect(message).toContain("HTTP 418");
    expect(message).toContain("418 Teapot");
  });

  it("maps an AbortError to cancellation", () => {
    const error = new Error("aborted");
    error.name = "AbortError";

    expect(toUserMessage(error, "Search")).toContain(
      "the request was cancelled",
    );
  });

  it("maps the client's timeout message to timeout guidance", () => {
    const message = toUserMessage(
      new Error(
        "Request to https://inkeedecoder.com/x timed out after 30000 ms",
      ),
      "Search",
    );

    expect(message).toContain("timed out");
    expect(message).toContain("INKEEDECODER_TIMEOUT_MS");
  });

  it("maps network failures to connectivity guidance", () => {
    for (const raw of [
      "getaddrinfo ENOTFOUND inkeedecoder.com",
      "connect ECONNREFUSED 127.0.0.1:443",
      "fetch failed",
    ]) {
      const message = toUserMessage(new Error(raw), "Search");
      expect(message).toContain("could not reach INKEEDecoder");
      expect(message).toContain("INKEEDECODER_BASE_URL");
    }
  });

  it("maps remaining abort/timeout wording to retry guidance", () => {
    const message = toUserMessage(new Error("socket timeout"), "Search");

    expect(message).toContain("the request timed out. Retry once");
  });

  it("falls back to the raw value for anything else", () => {
    expect(toUserMessage(new Error("weird failure"), "Search")).toContain(
      "failed unexpectedly: weird failure",
    );
    expect(toUserMessage("a string", "Search")).toContain(
      "failed unexpectedly: a string",
    );
    expect(toUserMessage(42, "Search")).toContain("failed unexpectedly: 42");
  });
});
