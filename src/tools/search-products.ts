import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getClient } from "../lib/client.js";
import { toUserMessage } from "../lib/errors.js";
import {
  applyCharacterLimit,
  boundStructured,
  markdownBullets,
  morePagesNote,
  refLines,
  truncationNote,
} from "../lib/format.js";
import { paginatedSchema, refSchema } from "../lib/schemas.js";

/**
 * The site's advanced product search: filter by ingredients a product must (or
 * must not) contain. This is how you answer "show me moisturizers with
 * squalane but no fragrance" — a question the plain search cannot express.
 */

const INCLUDE_MODES = ["all", "any"] as const;

const inputSchema = z.object({
  query: z
    .string()
    .max(200, "Query must not exceed 200 characters")
    .default("")
    .describe(
      "Free-text part of the search: a product or brand name. Leave empty to filter purely by ingredients — but then pass `include` or `exclude`.",
    ),
  include: z
    .array(z.string().min(1).max(200))
    .optional()
    .describe(
      'Ingredients the product must contain, using the site\'s display names — for example ["Squalane", "Tocopherol"]. Take these from an ingredient page\'s name, not from an INCI list.',
    ),
  exclude: z
    .array(z.string().min(1).max(200))
    .optional()
    .describe(
      'Ingredients the product must not contain, using the site\'s display names — for example ["Fragrance", "Alcohol Denat."].',
    ),
  include_mode: z
    .enum(INCLUDE_MODES)
    .default("all")
    .describe(
      "`all` (default) requires every `include` ingredient; `any` requires at least one.",
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

const outputSchema = paginatedSchema(refSchema);

/** Registers the `inkeedecoder_search_products` tool. */
export function registerSearchProductsTool(server: McpServer): void {
  server.registerTool(
    "inkeedecoder_search_products",
    {
      title: "Search products by ingredient",
      description:
        'Search INKEEDecoder for cosmetic products using the advanced filter: match a name and/or require and forbid specific ingredients. Use it for questions like "moisturizers with squalane and no fragrance". Returns one page of products — each response says whether another page is available. Read-only.',
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, include, exclude, include_mode, page }, ctx) => {
      if (query.trim() === "" && !include?.length && !exclude?.length) {
        return {
          content: [
            {
              type: "text",
              text: "Error: pass a query, or at least one ingredient in `include` or `exclude` — an unfiltered search would return the entire catalogue one page at a time.",
            },
          ],
          isError: true,
        };
      }

      const client = getClient();
      if (!client.ok) {
        return {
          content: [{ type: "text", text: client.error }],
          isError: true,
        };
      }

      try {
        const result = await client.client.searchProducts(
          {
            query,
            ...(include ? { include } : {}),
            ...(exclude ? { exclude } : {}),
            includeMode: include_mode,
          },
          { page, signal: ctx.mcpReq.signal },
        );

        const bounded = boundStructured(result);
        const text =
          applyCharacterLimit(
            markdownBullets(
              `Products matching "${query}" (page ${result.page})`,
              refLines(result.items),
            ) + morePagesNote(result.hasMore, result.page + 1),
          ) + (bounded.truncated ? truncationNote() : "");

        return {
          content: [{ type: "text", text }],
          structuredContent: bounded.value,
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: toUserMessage(error, "Product search") },
          ],
          isError: true,
        };
      }
    },
  );
}
