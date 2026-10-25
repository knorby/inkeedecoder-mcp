import { afterEach, describe, expect, it, vi } from "vitest";
import { logError, logInfo, logWarn } from "../src/lib/log.js";

/**
 * stdout carries the JSON-RPC stream in this server, so every log line must go
 * to stderr. These tests pin the stream and the prefixes hosts and operators
 * grep for.
 */

describe("stderr logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function capture(): string[] {
    const lines: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    return lines;
  }

  it("writes info lines to stderr with no prefix", () => {
    const lines = capture();
    logInfo("server started");
    expect(lines).toEqual(["server started\n"]);
  });

  it("writes warnings with the warn prefix", () => {
    const lines = capture();
    logWarn("slow down");
    expect(lines).toEqual(["warn: slow down\n"]);
  });

  it("writes errors with the error prefix and the stack of a cause", () => {
    const lines = capture();
    const cause = new Error("boom");
    logError("transport failed", cause);
    expect(lines[0]).toContain("error: transport failed");
    expect(lines[0]).toContain(cause.stack ?? "boom");
  });

  it("falls back to the message when a cause has no stack", () => {
    const lines = capture();
    const cause = new Error("no stack here");
    delete cause.stack;
    logError("transport failed", cause);
    expect(lines[0]).toContain("error: transport failed no stack here");
  });

  it("ignores non-Error causes", () => {
    const lines = capture();
    logError("transport failed", "a string cause");
    expect(lines).toEqual(["error: transport failed\n"]);
  });

  it("writes an error line with no cause", () => {
    const lines = capture();
    logError("transport failed");
    expect(lines).toEqual(["error: transport failed\n"]);
  });
});
