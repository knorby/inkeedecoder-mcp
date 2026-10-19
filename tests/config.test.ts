import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { readConfig, resetConfig } from "../src/config.js";

/**
 * The environment contract: documented defaults, coercion, and the politeness
 * floor that keeps direct reads of inkeedecoder.com at or above the default
 * interval. The floor must not apply to mirrors, which is what lets the tool
 * tests run against a fixture base URL with pacing off.
 */

const savedEnv = {
  INKEEDECODER_BASE_URL: process.env.INKEEDECODER_BASE_URL,
  INKEEDECODER_REQUEST_INTERVAL_MS:
    process.env.INKEEDECODER_REQUEST_INTERVAL_MS,
  INKEEDECODER_TIMEOUT_MS: process.env.INKEEDECODER_TIMEOUT_MS,
};

beforeEach(() => {
  delete process.env.INKEEDECODER_BASE_URL;
  delete process.env.INKEEDECODER_REQUEST_INTERVAL_MS;
  delete process.env.INKEEDECODER_TIMEOUT_MS;
  resetConfig();
});

afterAll(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetConfig();
});

describe("readConfig", () => {
  it("applies the documented defaults", () => {
    const result = readConfig();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toMatchObject({
      INKEEDECODER_BASE_URL: "https://inkeedecoder.com",
      INKEEDECODER_REQUEST_INTERVAL_MS: 1_000,
      INKEEDECODER_TIMEOUT_MS: 30_000,
    });
  });

  it("coerces numeric strings", () => {
    process.env.INKEEDECODER_REQUEST_INTERVAL_MS = "1500";
    process.env.INKEEDECODER_TIMEOUT_MS = "0";
    resetConfig();

    const result = readConfig();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toMatchObject({
      INKEEDECODER_REQUEST_INTERVAL_MS: 1_500,
      INKEEDECODER_TIMEOUT_MS: 0,
    });
  });

  it("rejects pacing the site faster than the default interval", () => {
    process.env.INKEEDECODER_REQUEST_INTERVAL_MS = "0";

    const result = readConfig();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("at least 1000 ms");
  });

  it("applies the floor to the old domain as well", () => {
    process.env.INKEEDECODER_BASE_URL = "https://www.incidecoder.com";
    process.env.INKEEDECODER_REQUEST_INTERVAL_MS = "10";

    expect(readConfig().ok).toBe(false);
  });

  it("allows a mirror to be paced faster", () => {
    process.env.INKEEDECODER_BASE_URL = "https://mirror.example.test";
    process.env.INKEEDECODER_REQUEST_INTERVAL_MS = "0";

    expect(readConfig().ok).toBe(true);
  });

  it("rejects a malformed base URL", () => {
    process.env.INKEEDECODER_BASE_URL = "not a url";

    expect(readConfig().ok).toBe(false);
  });

  it("rejects a non-numeric interval", () => {
    process.env.INKEEDECODER_REQUEST_INTERVAL_MS = "soon";

    expect(readConfig().ok).toBe(false);
  });
});
