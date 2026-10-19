import { readFileSync } from "node:fs";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { resetConfig } from "../src/config.js";
import { SERVER_NAME, SERVER_VERSION } from "../src/constants.js";
import { resetClient } from "../src/lib/client.js";
import { createTestClient, type TestHarness, textOf } from "./helpers.js";

/**
 * Integration tests: a real Client calls a real McpServer in-process, and the
 * tools drive the real `@knorby/inkeedecoder-client` against captured HTML.
 *
 * Assert on `structuredContent` for the happy path. Failures — schema
 * rejections, unusable ids, HTTP errors — come back as an ordinary result with
 * `isError: true`, never as a thrown error.
 *
 * The fixtures are real pages captured from inkeedecoder.com (see
 * tests/fixtures/README.md), so the parsers exercise the markup the site
 * actually serves rather than a hand-written approximation.
 *
 * The suite runs against a mirror with pacing off: the shared request
 * schedule must never slow the tests down, and the politeness floor only
 * applies to inkeedecoder.com itself. The environment is restored afterwards
 * so spawned children (the stdio test) still see the defaults.
 */

const TEST_BASE_URL = "https://mirror.example.test";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

const savedEnv = {
  INKEEDECODER_BASE_URL: process.env.INKEEDECODER_BASE_URL,
  INKEEDECODER_REQUEST_INTERVAL_MS:
    process.env.INKEEDECODER_REQUEST_INTERVAL_MS,
  INKEEDECODER_TIMEOUT_MS: process.env.INKEEDECODER_TIMEOUT_MS,
};

beforeEach(() => {
  process.env.INKEEDECODER_BASE_URL = TEST_BASE_URL;
  process.env.INKEEDECODER_REQUEST_INTERVAL_MS = "0";
  delete process.env.INKEEDECODER_TIMEOUT_MS;
  resetConfig();
  resetClient();
});

afterAll(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetConfig();
  resetClient();
});

interface Ref {
  name: string;
  slug: string;
  path: string;
  url: string;
}

interface Page<T> {
  items: T[];
  page: number;
  hasMore: boolean;
  nextPageUrl?: string;
}

/** Narrows `structuredContent` to the shape a tool documents. */
function structured<T>(result: {
  structuredContent?: Record<string, unknown> | undefined;
}): T {
  return result.structuredContent as unknown as T;
}

/** Maps a requested URL to the captured page that stands for it. */
function fixtureFor(url: URL): string | undefined {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const query = url.searchParams.get("query")?.toLowerCase() ?? "";

  switch (path) {
    case "/search": {
      const tab = url.searchParams.get("activetab");
      const ppage = url.searchParams.get("ppage");
      if (tab === "products" && ppage) {
        return "search-squalane-products-page2.html";
      }
      if (query === "the ordinary") return "search-the-ordinary.html";
      if (query.startsWith("squalane")) return "search-squalane.html";
      return undefined;
    }
    case "/search/product":
      return "search-products-advanced.html";
    case "/products/the-ordinary-retinol-1-in-squalane":
      return "product-the-ordinary-retinol-1-in-squalane.html";
    case "/ingredients/squalane":
      return "ingredient-squalane.html";
    case "/ingredients/tocopherol":
      return "ingredient-tocopherol.html";
    case "/brands/the-ordinary":
      return "brand-the-ordinary.html";
    case "/ingredient-functions/emollient":
      return "ingredient-function-emollient.html";
    default:
      return undefined;
  }
}

/**
 * Serves the captured pages in place of the site, and records every URL the
 * server asked for — which is how the URL-handling assertions work.
 */
function stubSite(): { calls: string[] } {
  const calls: string[] = [];

  const fetchMock = vi.fn(async (input: unknown) => {
    const url = new URL(String(input));
    calls.push(url.toString());

    const file = fixtureFor(url);
    if (!file) {
      return new Response("not found", {
        status: 404,
        statusText: "Not Found",
      });
    }
    const html = readFileSync(
      new URL(`./fixtures/${file}`, import.meta.url),
      "utf8",
    );
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  });

  vi.stubGlobal("fetch", fetchMock);
  return { calls };
}

/**
 * A fetch that never settles until its signal aborts, recording that the
 * abort reached it — the request-control tests owe their conclusions to it.
 */
function hangingFetch(state: { aborted: boolean }): typeof fetch {
  return ((_input: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        state.aborted = true;
        reject(new Error("aborted"));
      });
    })) as unknown as typeof fetch;
}

describe("server", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await harness?.close();
  });

  it("advertises the INKEEDecoder tools, resource, and prompt", async () => {
    harness = await createTestClient();

    const { tools } = await harness.client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "inkeedecoder_get_brand",
      "inkeedecoder_get_ingredient",
      "inkeedecoder_get_ingredient_function",
      "inkeedecoder_get_ingredient_products",
      "inkeedecoder_get_product",
      "inkeedecoder_ping",
      "inkeedecoder_search",
      "inkeedecoder_search_products",
    ]);

    const resources = await harness.client.listResources();
    expect(resources.resources.map((resource) => resource.uri)).toContain(
      "server://info",
    );

    const prompts = await harness.client.listPrompts();
    expect(prompts.prompts.map((prompt) => prompt.name)).toContain(
      "analyze_ingredients",
    );
  });

  it("marks every tool read-only and non-destructive", async () => {
    harness = await createTestClient();
    const { tools } = await harness.client.listTools();

    for (const tool of tools) {
      expect(tool.annotations, tool.name).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      });
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.description, tool.name).toBeTruthy();
    }
  });

  it("describes every input field", async () => {
    harness = await createTestClient();
    const { tools } = await harness.client.listTools();

    for (const tool of tools) {
      const properties = (
        tool.inputSchema as unknown as {
          properties?: Record<string, { description?: string }>;
        }
      ).properties;
      for (const [name, field] of Object.entries(properties ?? {})) {
        expect(field.description, `${tool.name}.${name}`).toBeTruthy();
      }
    }
  });

  it("advertises the package version", async () => {
    harness = await createTestClient();

    expect(SERVER_VERSION).toBe(pkg.version);
    expect(harness.client.getServerVersion()).toMatchObject({
      name: SERVER_NAME,
      version: pkg.version,
    });
  });

  it("reports its configuration from the info resource", async () => {
    harness = await createTestClient();

    const result = await harness.client.readResource({ uri: "server://info" });
    const text = (result.contents[0] as { text?: string } | undefined)?.text;
    const info = JSON.parse(String(text)) as {
      name: string;
      version: string;
      baseUrl: string | null;
      requestIntervalMs: number | null;
      timeoutMs: number | null;
      configError: string | null;
    };

    expect(info).toMatchObject({
      name: SERVER_NAME,
      version: pkg.version,
      baseUrl: TEST_BASE_URL,
      requestIntervalMs: 0,
      timeoutMs: 30_000,
      configError: null,
    });
  });

  it("generates a search-first prompt for a product name", async () => {
    harness = await createTestClient();

    const result = await harness.client.getPrompt({
      name: "analyze_ingredients",
      arguments: { product: "The Ordinary Retinol 1% in Squalane" },
    });
    const content = result.messages[0]?.content as
      | { text?: string }
      | undefined;
    const text = String(content?.text ?? "");

    expect(text).toContain("inkeedecoder_search");
    expect(text).toContain("ask which one to analyze");
  });

  it("generates a direct-fetch prompt for a link", async () => {
    harness = await createTestClient();

    const result = await harness.client.getPrompt({
      name: "analyze_ingredients",
      arguments: {
        product:
          "https://incidecoder.com/products/the-ordinary-retinol-1-in-squalane",
        focus: "dry skin",
      },
    });
    const content = result.messages[0]?.content as
      | { text?: string }
      | undefined;
    const text = String(content?.text ?? "");

    expect(text).toContain("as-is");
    expect(text).toContain("dry skin");
    expect(text).not.toContain("list the candidates");
  });
});

describe("inkeedecoder_ping", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await harness?.close();
  });

  it("echoes a message and reports the base URL", async () => {
    harness = await createTestClient();
    const result = await harness.client.callTool({
      name: "inkeedecoder_ping",
      arguments: { message: "hi" },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      ok: true,
      reply: "pong: hi",
      baseUrl: TEST_BASE_URL,
      server: { name: SERVER_NAME, version: pkg.version },
    });
    expect(textOf(result)).toBe("pong: hi");
  });

  it("honours a custom base URL", async () => {
    process.env.INKEEDECODER_BASE_URL = "https://mirror.example.com";
    resetConfig();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_ping",
      arguments: {},
    });

    expect(result.structuredContent).toMatchObject({
      reply: "pong",
      baseUrl: "https://mirror.example.com",
    });
    delete process.env.INKEEDECODER_BASE_URL;
  });
});

describe("inkeedecoder_search", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await harness?.close();
  });

  it("returns both tabs and says how to continue", async () => {
    stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_search",
      arguments: { query: "squalane" },
    });

    expect(result.isError).toBeFalsy();
    const out = structured<{
      query: string;
      products: Page<Ref>;
      ingredients: Page<Ref>;
    }>(result);

    expect(out.query).toBe("squalane");
    expect(out.products.items).toHaveLength(50);
    expect(out.products.hasMore).toBe(true);
    expect(out.ingredients.items).toEqual([
      expect.objectContaining({ name: "Squalane", slug: "squalane" }),
    ]);
    expect(out.ingredients.hasMore).toBe(false);

    expect(textOf(result)).toContain("Squalane");
    expect(textOf(result)).toContain("page: 2");
  });

  it("fetches only the requested tab, in one request", async () => {
    const { calls } = stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_search",
      arguments: { query: "squalane", tab: "products" },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("activetab=products");

    const out = structured<{
      tab: string;
      results: Page<Ref>;
      ingredients?: Page<Ref>;
    }>(result);
    expect(out.tab).toBe("products");
    expect(out.results.items).toHaveLength(50);
    expect(out).not.toHaveProperty("ingredients");
  });

  it("requests the page it was asked for", async () => {
    const { calls } = stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_search",
      arguments: { query: "squalane", tab: "products", page: 2 },
    });

    expect(calls[0]).toContain("ppage=2");
    const out = structured<{ results: Page<Ref> }>(result);
    expect(out.results.page).toBe(2);
    expect(out.results.items[0]?.name).toBe("Skinome Squalane Oil Cleanser");
  });

  it("rejects an empty query", async () => {
    stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_search",
      arguments: { query: "" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Invalid arguments");
  });
});

describe("inkeedecoder_search_products", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await harness?.close();
  });

  it("sends the ingredient filters to the advanced search", async () => {
    const { calls } = stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_search_products",
      arguments: {
        query: "the ordinary",
        include: ["Squalane"],
        exclude: ["Fragrance"],
      },
    });

    const url = calls[0] ?? "";
    expect(url).toContain("/search/product");
    expect(url).toContain("query=the+ordinary");
    expect(url).toContain("include=Squalane");
    expect(url).toContain("exclude=Fragrance");
    expect(url).not.toContain("include-mode");

    const out = structured<Page<Ref>>(result);
    expect(out.items).toHaveLength(21);
    expect(out.hasMore).toBe(false);
  });

  it("passes include_mode=any through", async () => {
    const { calls } = stubSite();
    harness = await createTestClient();

    await harness.client.callTool({
      name: "inkeedecoder_search_products",
      arguments: {
        query: "serum",
        include: ["Niacinamide", "Squalane"],
        include_mode: "any",
      },
    });

    expect(calls[0]).toContain("include-mode=any");
  });

  it("refuses an unfiltered catalogue walk", async () => {
    const { calls } = stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_search_products",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("at least one ingredient");
    expect(calls).toHaveLength(0);
  });
});

describe("link handling", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await harness?.close();
  });

  it("resolves an old incidecoder.com URL through the new site", async () => {
    const { calls } = stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_product",
      arguments: {
        id: "https://incidecoder.com/products/the-ordinary-retinol-1-in-squalane?utm_source=chat#reviews",
      },
    });

    expect(result.isError).toBeFalsy();
    // Only the path is used, and it is fetched from the configured base URL —
    // an old link never contacts the old domain.
    expect(calls[0]).toBe(
      `${TEST_BASE_URL}/products/the-ordinary-retinol-1-in-squalane`,
    );
  });

  it("accepts a current inkeedecoder.com URL and a bare slug", async () => {
    const { calls } = stubSite();
    harness = await createTestClient();

    await harness.client.callTool({
      name: "inkeedecoder_get_product",
      arguments: {
        id: "https://inkeedecoder.com/products/the-ordinary-retinol-1-in-squalane",
      },
    });
    await harness.client.callTool({
      name: "inkeedecoder_get_product",
      arguments: { id: "the-ordinary-retinol-1-in-squalane" },
    });

    expect(calls).toEqual([
      `${TEST_BASE_URL}/products/the-ordinary-retinol-1-in-squalane`,
      `${TEST_BASE_URL}/products/the-ordinary-retinol-1-in-squalane`,
    ]);
  });

  it("rejects dot-segment paths before anything is fetched", async () => {
    const { calls } = stubSite();
    harness = await createTestClient();

    for (const id of [
      "/products/../ingredients/squalane",
      "/products/%2e%2e/ingredients/squalane",
    ]) {
      const result = await harness.client.callTool({
        name: "inkeedecoder_get_product",
        arguments: { id },
      });

      expect(result.isError, id).toBe(true);
      expect(textOf(result)).toContain("dot segment");
    }
    // URL normalization would have collapsed these into an ingredient page;
    // nothing may be requested at all.
    expect(calls).toHaveLength(0);
  });

  it("rejects a path with extra segments", async () => {
    const { calls } = stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_product",
      arguments: { id: "/products/the-ordinary-retinol-1-in-squalane/extra" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("extra path segments");
    expect(calls).toHaveLength(0);
  });

  it("rejects a URL from another site", async () => {
    const { calls } = stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_product",
      arguments: { id: "https://example.com/products/some-product" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("not an INKEEDecoder link");
    expect(calls).toHaveLength(0);
  });

  it("points at the right tool when the link is the wrong kind of page", async () => {
    const { calls } = stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_product",
      arguments: { id: "https://inkeedecoder.com/ingredients/squalane" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("inkeedecoder_get_ingredient");
    expect(calls).toHaveLength(0);
  });

  it("reads the base URL from the environment", async () => {
    process.env.INKEEDECODER_BASE_URL = "https://mirror.example.com";
    resetConfig();
    const { calls } = stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_brand",
      arguments: { id: "the-ordinary" },
    });

    // The stub serves fixtures by path, so what this proves is where the
    // request was sent: ids are always resolved against the configured base.
    expect(result.isError).toBeFalsy();
    expect(calls[0]).toBe("https://mirror.example.com/brands/the-ordinary");
    delete process.env.INKEEDECODER_BASE_URL;
  });
});

describe("inkeedecoder_get_product", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await harness?.close();
  });

  it("returns the product with its brand and ingredient list", async () => {
    stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_product",
      arguments: { id: "the-ordinary-retinol-1-in-squalane" },
    });

    expect(result.isError).toBeFalsy();
    const out = structured<{
      name: string;
      brand?: Ref;
      ingredients?: (Ref & { ourTake?: string })[];
      longDescriptions?: unknown[];
      skimTable?: unknown[];
    }>(result);

    expect(out.name).toBe("Retinol 1% In Squalane");
    expect(out.brand?.name).toBe("The Ordinary");
    expect(out.ingredients).toHaveLength(8);
    expect(out.ingredients?.[0]).toMatchObject({
      name: "Squalane",
      slug: "squalane",
      ourTake: "goodie",
    });

    expect(textOf(result)).toContain("# Retinol 1% In Squalane");
    expect(textOf(result)).toContain("Squalane — /ingredients/squalane");
  });

  it("leaves the expensive sections out until asked", async () => {
    stubSite();
    harness = await createTestClient();

    const lean = await harness.client.callTool({
      name: "inkeedecoder_get_product",
      arguments: { id: "the-ordinary-retinol-1-in-squalane" },
    });
    expect(structured<Record<string, unknown>>(lean)).not.toHaveProperty(
      "longDescriptions",
    );
    expect(structured<Record<string, unknown>>(lean)).not.toHaveProperty(
      "skimTable",
    );

    const verbose = await harness.client.callTool({
      name: "inkeedecoder_get_product",
      arguments: {
        id: "the-ordinary-retinol-1-in-squalane",
        long_descriptions: true,
        skim_table: true,
        full_name: true,
      },
    });

    const out = structured<{
      fullName?: string;
      longDescriptions?: unknown[];
      skimTable?: unknown[];
    }>(verbose);
    expect(out.fullName).toBe("The Ordinary Retinol 1% In Squalane");
    expect(out.longDescriptions).toHaveLength(8);
    expect(out.skimTable).toHaveLength(8);
    expect(textOf(verbose)).toContain("long descriptions (8)");
  });

  it("does not shorten a lean result", async () => {
    stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_product",
      arguments: { id: "the-ordinary-retinol-1-in-squalane" },
    });

    expect(textOf(result)).not.toContain("were shortened");
  });

  it("bounds an all-sections result and says fields were shortened", async () => {
    stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_product",
      arguments: {
        id: "the-ordinary-retinol-1-in-squalane",
        brand: true,
        description: true,
        ingredients: true,
        images: "all",
        hashtags: true,
        full_name: true,
        functions: true,
        skim_table: true,
        dates: true,
        tooltips: true,
        long_descriptions: true,
      },
    });

    expect(result.isError).toBeFalsy();
    // Both halves of the result respect the response limit: the structured
    // half is bounded by shortening fields, and the text half says so.
    const size = JSON.stringify(result.structuredContent).length;
    expect(size).toBeLessThanOrEqual(25_000);
    expect(textOf(result)).toContain("were shortened");
    expect(structured<{ name: string }>(result).name).toBe(
      "Retinol 1% In Squalane",
    );
  });

  it("maps a missing page to an actionable error", async () => {
    stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_product",
      arguments: { id: "no-such-product" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("not found");
    expect(textOf(result)).toContain("inkeedecoder_search");
  });
});

describe("inkeedecoder_get_ingredient", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await harness?.close();
  });

  it("returns the rating, functions, and safety data", async () => {
    stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_ingredient",
      arguments: { id: "squalane" },
    });

    expect(result.isError).toBeFalsy();
    const out = structured<{
      name: string;
      ourTake: string | null;
      irritancy?: string;
      comedogenicity?: string;
      functions?: Ref[];
      details?: string;
    }>(result);

    expect(out.name).toBe("Squalane");
    expect(out.ourTake).toBe("goodie");
    expect(out.irritancy).toBe("0");
    expect(out.comedogenicity).toBe("1");
    expect(out.functions?.map((fn) => fn.name)).toContain("emollient");
    expect(out.details).toBeUndefined();

    expect(textOf(result)).toContain("Rating: goodie");
  });

  it("adds the long writeup, CosIng data, and references on request", async () => {
    stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_ingredient",
      arguments: {
        id: "https://incidecoder.com/ingredients/squalane",
        details: true,
        cosing: true,
        proof: true,
      },
    });

    const out = structured<{
      details?: string;
      proof?: string[];
      cosing?: { cas?: string };
    }>(result);

    expect(out.details?.length).toBeGreaterThan(500);
    expect(out.proof).toHaveLength(1);
    expect(out.cosing?.cas).toBe("111-01-3");
    expect(textOf(result)).toContain("CAS 111-01-3");
  });
});

describe("inkeedecoder_get_ingredient_products", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await harness?.close();
  });

  it("lists products containing the ingredient", async () => {
    stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_ingredient_products",
      arguments: { id: "squalane" },
    });

    expect(result.isError).toBeFalsy();
    const out = structured<{
      products: Page<Ref>;
      knownAmountProducts?: unknown[];
    }>(result);

    expect(out.products.items).toHaveLength(50);
    expect(out.products.hasMore).toBe(true);
    expect(out).not.toHaveProperty("knownAmountProducts");
    expect(textOf(result)).toContain("page: 2");
  });

  it("pages with uoffset and can include known amounts", async () => {
    const { calls } = stubSite();
    harness = await createTestClient();

    await harness.client.callTool({
      name: "inkeedecoder_get_ingredient_products",
      arguments: { id: "squalane", page: 2 },
    });
    expect(calls[0]).toContain("uoffset=1");

    const withAmounts = await harness.client.callTool({
      name: "inkeedecoder_get_ingredient_products",
      arguments: { id: "squalane", include_known_amount: true },
    });

    const out = structured<{
      knownAmountProducts?: {
        name: string;
        percent?: string;
        brand?: string;
      }[];
    }>(withAmounts);
    expect(out.knownAmountProducts).toHaveLength(2);
    expect(out.knownAmountProducts?.[0]).toMatchObject({
      name: "Flawless Neutralising Gel",
      percent: "5.0",
    });
    expect(textOf(withAmounts)).toContain("5.0%");
  });
});

describe("inkeedecoder_get_brand", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await harness?.close();
  });

  it("returns the brand and one page of its products", async () => {
    stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_brand",
      arguments: { id: "the-ordinary" },
    });

    expect(result.isError).toBeFalsy();
    const out = structured<{ name: string; products: Page<Ref> }>(result);

    expect(out.name).toBe("The Ordinary");
    expect(out.products.items).toHaveLength(50);
    expect(out.products.hasMore).toBe(true);
    expect(textOf(result)).toContain("# The Ordinary");
  });
});

describe("inkeedecoder_get_ingredient_function", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await harness?.close();
  });

  it("returns the function, its description, and its ingredients", async () => {
    stubSite();
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_ingredient_function",
      arguments: { id: "emollient" },
    });

    expect(result.isError).toBeFalsy();
    const out = structured<{
      name: string;
      description?: string;
      ingredients: Page<Ref>;
    }>(result);

    expect(out.name).toBe("emollient");
    expect(out.description).toContain("soft, smooth");
    expect(out.ingredients.items).toHaveLength(50);
    expect(out.ingredients.hasMore).toBe(true);
  });
});

describe("request control", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
    resetClient();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await harness?.close();
  });

  it("spaces successive requests by the configured interval", async () => {
    process.env.INKEEDECODER_REQUEST_INTERVAL_MS = "250";
    resetConfig();
    resetClient();
    const { calls } = stubSite();
    harness = await createTestClient();

    const started = Date.now();
    await harness.client.callTool({
      name: "inkeedecoder_search",
      arguments: { query: "squalane", tab: "products" },
    });
    await harness.client.callTool({
      name: "inkeedecoder_search",
      arguments: { query: "squalane", tab: "products" },
    });

    expect(calls).toHaveLength(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(200);
  });

  it("times out a hanging request with an actionable error", async () => {
    process.env.INKEEDECODER_TIMEOUT_MS = "50";
    resetConfig();
    resetClient();
    vi.stubGlobal("fetch", hangingFetch({ aborted: false }));
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_get_ingredient",
      arguments: { id: "squalane" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("timed out");
  });

  it("cancels in-flight work when the caller aborts", async () => {
    const state = { aborted: false };
    vi.stubGlobal("fetch", hangingFetch(state));
    harness = await createTestClient();
    const controller = new AbortController();

    const pending = harness.client.callTool(
      { name: "inkeedecoder_get_ingredient", arguments: { id: "squalane" } },
      { signal: controller.signal },
    );
    setTimeout(() => controller.abort(), 30);

    await expect(pending).rejects.toThrow(/abort/i);
    await vi.waitFor(() => {
      expect(state.aborted).toBe(true);
    });
  });
});

describe("error handling", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetConfig();
    resetClient();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await harness?.close();
  });

  it("maps rate limiting to an actionable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("slow down", {
            status: 429,
            statusText: "Too Many Requests",
          }),
      ),
    );
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_search",
      arguments: { query: "squalane" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("rate limited (HTTP 429)");
  });

  it("maps a network failure to an actionable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    harness = await createTestClient();

    const result = await harness.client.callTool({
      name: "inkeedecoder_search",
      arguments: { query: "squalane" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("could not reach");
  });
});
