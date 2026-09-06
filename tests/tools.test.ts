import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfig } from "../src/config.js";
import {
  createTestClient,
  jsonResponse,
  type TestHarness,
  textOf,
} from "./helpers.js";

/**
 * Integration tests: a real Client calls a real McpServer in-process.
 *
 * Assert on `structuredContent` for the happy path. Failures — schema
 * rejections, missing credentials, API errors — come back as an ordinary
 * result with `isError: true`, never as a thrown error.
 */
describe("server", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
    process.env.EXAMPLE_API_KEY = "test-key";
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await harness?.close();
  });

  it("advertises the example tools, resource, and prompt", async () => {
    harness = await createTestClient();

    const tools = await harness.client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "example_ping",
      "example_search_items",
    ]);

    const resources = await harness.client.listResources();
    expect(resources.resources.map((resource) => resource.uri)).toContain(
      "server://info",
    );

    const prompts = await harness.client.listPrompts();
    expect(prompts.prompts.map((prompt) => prompt.name)).toContain(
      "example_summarize",
    );
  });

  it("marks read-only tools with annotations", async () => {
    harness = await createTestClient();
    const { tools } = await harness.client.listTools();
    const ping = tools.find((tool) => tool.name === "example_ping");

    expect(ping?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
  });
});

describe("example_ping", () => {
  let harness: TestHarness;

  afterEach(async () => {
    vi.unstubAllGlobals();
    await harness?.close();
  });

  it("returns pong and echoes a message", async () => {
    harness = await createTestClient();
    const result = await harness.client.callTool({
      name: "example_ping",
      arguments: { message: "hi" },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      ok: true,
      reply: "pong: hi",
    });
    expect(textOf(result)).toBe("pong: hi");
  });

  it("returns a bare pong without arguments", async () => {
    harness = await createTestClient();
    const result = await harness.client.callTool({
      name: "example_ping",
      arguments: {},
    });

    expect(result.structuredContent).toMatchObject({ reply: "pong" });
  });
});

describe("example_search_items", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
    process.env.EXAMPLE_API_KEY = "test-key";
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await harness?.close();
  });

  const stubApi = (body: unknown, init?: ResponseInit) => {
    const fetchMock = vi.fn(async () => jsonResponse(body, init));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("returns markdown by default with the total and item titles", async () => {
    stubApi({
      total: 3,
      items: [
        { id: "1", title: "First item", url: "https://example.com/1" },
        { id: "2", title: "Second item" },
      ],
    });
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "example_search_items",
      arguments: { query: "item" },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      total: 3,
      count: 2,
      offset: 0,
      hasMore: true,
      nextOffset: 2,
    });
    expect(textOf(result)).toContain("First item");
    expect(textOf(result)).toContain("Second item");
  });

  it("returns JSON when response_format is json", async () => {
    stubApi({ total: 1, items: [{ id: "1", title: "Only item" }] });
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "example_search_items",
      arguments: { query: "item", response_format: "json" },
    });

    expect(JSON.parse(textOf(result))).toMatchObject({
      total: 1,
      hasMore: false,
    });
    expect(result.structuredContent).not.toHaveProperty("nextOffset");
  });

  it("sends the query, paging, and auth to the API", async () => {
    const fetchMock = stubApi({ total: 0, items: [] });
    harness = await createTestClient();

    await harness.client.callTool({
      name: "example_search_items",
      arguments: { query: "item", limit: 5, offset: 10 },
    });

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/v1/items");
    expect(url.searchParams.get("q")).toBe("item");
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("offset")).toBe("10");
  });

  it("reports missing credentials instead of crashing", async () => {
    delete process.env.EXAMPLE_API_KEY;
    resetConfig();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "example_search_items",
      arguments: { query: "item" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("EXAMPLE_API_KEY");
  });

  it("maps API errors to actionable messages", async () => {
    stubApi({ message: "unauthorized" }, { status: 401 });
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "example_search_items",
      arguments: { query: "item" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("API key was rejected");
  });

  it("rejects arguments that fail the input schema", async () => {
    stubApi({ total: 0, items: [] });
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "example_search_items",
      arguments: { query: "a" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Invalid arguments");
  });
});
