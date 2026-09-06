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
import { resolveEntityId } from "../lib/ids.js";
import {
  knownAmountProductSchema,
  paginatedSchema,
  refSchema,
} from "../lib/schemas.js";

/**
 * The reverse of a product page: given an ingredient, which products contain
 * it. Answers "what else has squalane in it".
 */

const inputSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "Ingredient slug, site path (/ingredients/...), or ingredient URL on inkeedecoder.com or incidecoder.com.",
    ),
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe(
      "1-based page number. Each response states whether another page is available.",
    ),
  include_known_amount: z
    .boolean()
    .default(false)
    .describe(
      'Include the "products with a known amount" carousel (products that declare the percentage). Only present on page 1. Default false.',
    ),
});

const outputSchema = z.object({
  products: paginatedSchema(refSchema).describe(
    "Products that list this ingredient.",
  ),
  knownAmountProducts: z
    .array(knownAmountProductSchema)
    .optional()
    .describe(
      "Products that declare the ingredient's percentage, when `include_known_amount` was set on page 1.",
    ),
});

/** Registers the `inkeedecoder_get_ingredient_products` tool. */
export function registerGetIngredientProductsTool(server: McpServer): void {
  server.registerTool(
    "inkeedecoder_get_ingredient_products",
    {
      title: "Get products containing an ingredient",
      description:
        "List the cosmetic products on INKEEDecoder (formerly INCIDecoder) that contain a given ingredient — the reverse of a product page. Optionally include the products that declare the ingredient's percentage. Returns one page at a time. Read-only.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, page, include_known_amount }) => {
      const resolved = resolveEntityId(id, "ingredients");
      if (!resolved.ok) {
        return {
          content: [{ type: "text", text: resolved.error }],
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
        const result = await client.client.getIngredientProducts(
          resolved.path,
          {
            page,
            includeKnownAmount: include_known_amount,
          },
        );

        const lines = [
          markdownBullets(
            `Products containing ${resolved.slug} (page ${result.products.page})`,
            refLines(result.products.items),
          ) + morePagesNote(result.products.hasMore, result.products.page + 1),
        ];

        if (result.knownAmountProducts?.length) {
          lines.push(
            "",
            `## Known amounts (${result.knownAmountProducts.length})`,
            "",
            result.knownAmountProducts
              .map(
                (product) =>
                  `- ${product.name}${product.percent ? ` — ${product.percent}%` : ""}${product.brand ? ` (${product.brand})` : ""}`,
              )
              .join("\n"),
          );
        }

        return {
          content: [
            { type: "text", text: applyCharacterLimit(lines.join("\n")) },
          ],
          structuredContent: {
            products: result.products,
            ...(result.knownAmountProducts
              ? { knownAmountProducts: result.knownAmountProducts }
              : {}),
          },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: toUserMessage(error, "Ingredient products lookup"),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
