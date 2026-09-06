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
import { paginatedSchema, refSchema } from "../lib/schemas.js";

/**
 * An ingredient-function page (for example "emollient", "antioxidant"): what
 * the function means, and every ingredient the site files under it.
 */

const inputSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(500)
    .describe(
      'Ingredient-function slug (for example "emollient", "antioxidant"), site path (/ingredient-functions/...), or URL on inkeedecoder.com or incidecoder.com.',
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
  slug: z.string().describe("Ingredient-function slug."),
  name: z.string().describe('Display name, for example "Emollient".'),
  path: z.string().describe("Site-relative path."),
  url: z.string().describe("Absolute URL on the site."),
  description: z
    .string()
    .optional()
    .describe("What the function means, when the page has an explanation."),
  ingredients: paginatedSchema(refSchema).describe(
    "This page of ingredients serving this function.",
  ),
});

/** Registers the `inkeedecoder_get_ingredient_function` tool. */
export function registerGetIngredientFunctionTool(server: McpServer): void {
  server.registerTool(
    "inkeedecoder_get_ingredient_function",
    {
      title: "Get an ingredient function",
      description:
        'Fetch an ingredient-function page from INKEEDecoder (formerly INCIDecoder) — what the function means and which ingredients serve it (for example "emollient"). Accepts a slug, an /ingredient-functions/ path, or an inkeedecoder.com or incidecoder.com URL. Returns one page of ingredients at a time. Read-only.',
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, page }) => {
      const resolved = resolveEntityId(id, "ingredient-functions");
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
        const fn = await client.client.getIngredientFunction(resolved.path, {
          page,
        });

        const text = [
          `# ${fn.name}`,
          "",
          fn.url,
          ...(fn.description ? ["", fn.description] : []),
          "",
          markdownBullets(
            `Ingredients (page ${fn.ingredients.page})`,
            refLines(fn.ingredients.items),
          ) + morePagesNote(fn.ingredients.hasMore, fn.ingredients.page + 1),
        ].join("\n");

        return {
          content: [{ type: "text", text: applyCharacterLimit(text) }],
          structuredContent: fn,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: toUserMessage(error, "Ingredient function lookup"),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
