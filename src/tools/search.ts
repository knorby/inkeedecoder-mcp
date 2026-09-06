import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getClient } from "../lib/client.js";
import { toUserMessage } from "../lib/errors.js";
import {
  applyCharacterLimit,
  markdownBullets,
  morePagesNote,
  refLines,
} from "../lib/format.js";
import { paginatedSchema, refSchema } from "../lib/schemas.js";

/**
 * Entry point for most lookups: find the slug that the `get_*` tools need.
 *
 * Every `id` argument in this server takes a slug, a site path, or a URL, so
 * the usual flow is search → pick a result → `inkeedecoder_get_product` (or
 * `get_ingredient`) with its slug.
 */

const TABS = ["products", "ingredients"] as const;

const inputSchema = z.object({
  query: z
    .string()
    .min(1, "Query must not be empty")
    .max(200, "Query must not exceed 200 characters")
    .describe(
      'Product name, brand, or ingredient name — for example "squalane", "niacinamide", or "The Ordinary Retinol 1% in Squalane".',
    ),
  tab: z
    .enum(TABS)
    .optional()
    .describe(
      "Return only this tab. Omit it to get page 1 of both products and ingredients in a single request; with `tab` set, any page costs exactly one request.",
    ),
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe(
      "1-based page number. Each response states whether another page is available.",
    ),
});

const outputSchema = z.object({
  query: z.string().describe("The query that was run."),
  tab: z.enum(TABS).optional().describe("Present when `tab` was requested."),
  results: paginatedSchema(refSchema)
    .optional()
    .describe("Matches from the requested tab. Present when `tab` was set."),
  products: paginatedSchema(refSchema)
    .optional()
    .describe("Product matches. Present when no `tab` was requested."),
  ingredients: paginatedSchema(refSchema)
    .optional()
    .describe("Ingredient matches. Present when no `tab` was requested."),
});

/** Registers the `inkeedecoder_search` tool. */
export function registerSearchTool(server: McpServer): void {
  server.registerTool(
    "inkeedecoder_search",
    {
      title: "Search products and ingredients",
      description:
        "Search INKEEDecoder (formerly INCIDecoder) for cosmetic products and ingredients by name. Returns names, slugs, and URLs — one page at a time. Pass a result's slug to inkeedecoder_get_product or inkeedecoder_get_ingredient for the full page. Read-only: it never modifies anything.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, tab, page }) => {
      const client = getClient();
      if (!client.ok) {
        return {
          content: [{ type: "text", text: client.error }],
          isError: true,
        };
      }

      try {
        // Single tab: one request, results under `results`.
        if (tab) {
          const result = await client.client.search(query, { tab, page });
          const output = {
            query: result.query,
            tab: result.tab,
            results: result.results,
          };
          const text =
            markdownBullets(
              `Search "${result.query}" — ${result.tab} (page ${result.results.page})`,
              refLines(result.results.items),
            ) + morePagesNote(result.results.hasMore, result.results.page + 1);

          return {
            content: [{ type: "text", text: applyCharacterLimit(text) }],
            structuredContent: output,
          };
        }

        // Both tabs, paginated independently.
        const result = await client.client.search(query, { page });
        const output = {
          query: result.query,
          products: result.products,
          ingredients: result.ingredients,
        };
        const text = [
          `Search "${result.query}" (page ${page})`,
          "",
          "## Products",
          ...(result.products.items.length > 0
            ? refLines(result.products.items).map((line) => `- ${line}`)
            : ["- (none)"]),
          morePagesNote(result.products.hasMore, result.products.page + 1),
          "",
          "## Ingredients",
          ...(result.ingredients.items.length > 0
            ? refLines(result.ingredients.items).map((line) => `- ${line}`)
            : ["- (none)"]),
          morePagesNote(
            result.ingredients.hasMore,
            result.ingredients.page + 1,
          ),
        ].join("\n");

        return {
          content: [{ type: "text", text: applyCharacterLimit(text) }],
          structuredContent: output,
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: toUserMessage(error, "Search") }],
          isError: true,
        };
      }
    },
  );
}
