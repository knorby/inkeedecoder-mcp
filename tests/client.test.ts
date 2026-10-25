import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfig } from "../src/config.js";
import { getClient, resetClient } from "../src/lib/client.js";

/**
 * The shared client is what makes the politeness interval real across tool
 * calls — one instance per configuration, rebuilt only when the settings
 * change. The failure path matters too: a client that cannot be created comes
 * back as an actionable error, not a throw.
 */

const savedEnv = {
  INKEEDECODER_BASE_URL: process.env.INKEEDECODER_BASE_URL,
  INKEEDECODER_REQUEST_INTERVAL_MS:
    process.env.INKEEDECODER_REQUEST_INTERVAL_MS,
  INKEEDECODER_TIMEOUT_MS: process.env.INKEEDECODER_TIMEOUT_MS,
};

beforeEach(() => {
  process.env.INKEEDECODER_BASE_URL = "https://mirror.example.test";
  process.env.INKEEDECODER_REQUEST_INTERVAL_MS = "0";
  delete process.env.INKEEDECODER_TIMEOUT_MS;
  resetConfig();
  resetClient();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("@knorby/inkeedecoder-client");
  vi.resetModules();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetConfig();
  resetClient();
});

describe("getClient", () => {
  it("returns one cached client for an unchanged configuration", () => {
    const first = getClient();
    const second = getClient();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.client).toBe(first.client);
  });

  it("builds a fresh client when the configuration changes", () => {
    const first = getClient();

    process.env.INKEEDECODER_BASE_URL = "https://other-mirror.example.test";
    resetConfig();

    const second = getClient();

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.client).not.toBe(first.client);
  });

  it("surfaces a configuration error without creating a client", () => {
    process.env.INKEEDECODER_BASE_URL = "not a url";
    resetConfig();

    const result = getClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid environment configuration");
    }
  });

  it("reports a client that cannot be created", async () => {
    vi.resetModules();
    vi.doMock("@knorby/inkeedecoder-client", () => ({
      createInkeedecoderClient: () => {
        throw new Error("client construction failed");
      },
    }));
    const clientModule = await import("../src/lib/client.js");

    const result = clientModule.getClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        "could not create the INKEEDecoder client",
      );
      expect(result.error).toContain("client construction failed");
    }
  });

  it("stringifies a non-Error thrown during client creation", async () => {
    vi.resetModules();
    vi.doMock("@knorby/inkeedecoder-client", () => ({
      createInkeedecoderClient: () => {
        throw "plain string";
      },
    }));
    const clientModule = await import("../src/lib/client.js");

    const result = clientModule.getClient();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("plain string");
  });
});
