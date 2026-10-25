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

  function capture(): { lines: string[]; stdout: string[] } {
    const lines: string[] = [];
    const stdout: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdout.push(String(chunk));
      return true;
    });
    return { lines, stdout };
  }

  it("writes info lines to stderr with no prefix", () => {
    const { lines, stdout } = capture();
    logInfo("server started");
    expect(lines).toEqual(["server started\n"]);
    expect(stdout).toEqual([]);
  });

  it("writes warnings with the warn prefix", () => {
    const { lines, stdout } = capture();
    logWarn("slow down");
    expect(lines).toEqual(["warn: slow down\n"]);
    expect(stdout).toEqual([]);
  });

  it("writes errors with the error prefix and the stack of a cause", () => {
    const { lines, stdout } = capture();
    const cause = new Error("boom");
    logError("transport failed", cause);
    expect(lines[0]).toContain("error: transport failed");
    expect(lines[0]).toContain(cause.stack ?? "boom");
    expect(stdout).toEqual([]);
  });

  it("falls back to the message when a cause has no stack", () => {
    const { lines, stdout } = capture();
    const cause = new Error("no stack here");
    delete cause.stack;
    logError("transport failed", cause);
    expect(lines[0]).toContain("error: transport failed no stack here");
    expect(stdout).toEqual([]);
  });

  it("ignores non-Error causes", () => {
    const { lines, stdout } = capture();
    logError("transport failed", "a string cause");
    expect(lines).toEqual(["error: transport failed\n"]);
    expect(stdout).toEqual([]);
  });

  it("writes an error line with no cause", () => {
    const { lines, stdout } = capture();
    logError("transport failed");
    expect(lines).toEqual(["error: transport failed\n"]);
    expect(stdout).toEqual([]);
  });
});
