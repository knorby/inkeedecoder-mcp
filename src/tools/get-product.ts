import type { Product } from "@knorby/inkeedecoder-client";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getClient } from "../lib/client.js";
import { toUserMessage } from "../lib/errors.js";
import { applyCharacterLimit } from "../lib/format.js";
import { resolveEntityId } from "../lib/ids.js";
import { productSchema } from "../lib/schemas.js";

/**
 * A full product page.
 *
 * The output is opt-in by section: the defaults (brand, description,
 * ingredients, image, hashtags) answer "what is in this and who makes it",
 * while the expensive sections — grouped-by-function ingredients, the skim
 * table, tooltips, and the long per-ingredient writeups — stay off until asked
 * for. A single product's long writeups can be tens of thousands of
 * characters, which is the difference between a useful answer and a flooded
 * context window.
 */

const inputSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "Product slug, site path (/products/...), or product URL on inkeedecoder.com or incidecoder.com. The slug is the last segment of the page URL. Get one from inkeedecoder_search.",
    ),
  brand: z
    .boolean()
    .default(true)
    .describe("Include the brand name and its /brands/ link. Default true."),
  description: z
    .boolean()
    .default(true)
    .describe("Include the product description. Default true."),
  ingredients: z
    .boolean()
    .default(true)
    .describe(
      "Include the deduplicated ingredient list in INCI order. Default true.",
    ),
  images: z
    .enum(["none", "original", "all"])
    .default("original")
    .describe(
      "`none` omits images; `original` (default) includes the main image; `all` adds the webp/jpeg srcset URLs.",
    ),
  hashtags: z
    .boolean()
    .default(true)
    .describe(
      "Include the product's hashtags (#alcohol-free and similar). Default true.",
    ),
  full_name: z
    .boolean()
    .default(false)
    .describe(
      'Include the canonical "Brand Product" full name. Default false.',
    ),
  functions: z
    .boolean()
    .default(false)
    .describe(
      "Include ingredients grouped by what they do (key and other groups). Default false.",
    ),
  skim_table: z
    .boolean()
    .default(false)
    .describe(
      "Include the per-ingredient irritancy/comedogenicity table. Default false — it is large.",
    ),
  dates: z
    .boolean()
    .default(false)
    .describe(
      "Include who uploaded the product and when it was last updated. Default false.",
    ),
  tooltips: z
    .boolean()
    .default(false)
    .describe(
      "Include per-ingredient tooltip data (functions, irritancy, comedogenicity, blurb). Default false.",
    ),
  long_descriptions: z
    .boolean()
    .default(false)
    .describe(
      'Include the long per-ingredient writeups from "Ingredients explained". Default false — this is by far the largest section.',
    ),
});

const outputSchema = productSchema;

/** Renders the summary a model reads; the full record is in structuredContent. */
function renderProduct(product: Product): string {
  const lines: string[] = [
    `# ${product.fullName ?? product.name}`,
    "",
    product.url,
  ];

  if (product.brand) {
    lines.push("", `Brand: ${product.brand.name} — ${product.brand.path}`);
  }

  if (product.description) {
    lines.push("", "## Description", "", product.description);
  }

  if (product.ingredients && product.ingredients.length > 0) {
    lines.push("", `## Ingredients (${product.ingredients.length})`, "");
    for (const ingredient of product.ingredients) {
      const notes = [
        ingredient.ourTake,
        ingredient.percent ? `${ingredient.percent}%` : undefined,
      ].filter(Boolean);
      lines.push(
        `- ${ingredient.name} — ${ingredient.path}${notes.length > 0 ? ` (${notes.join(", ")})` : ""}`,
      );
    }
  }

  if (product.hashtags && product.hashtags.length > 0) {
    lines.push(
      "",
      "## Hashtags",
      "",
      product.hashtags.map((tag) => `- ${tag.tag} (${tag.label})`).join("\n"),
    );
  }

  const extras: string[] = [];
  if (product.images) extras.push("image");
  if (product.functions) {
    const groups =
      product.functions.key.length + product.functions.other.length;
    extras.push(`functions (${groups} groups)`);
  }
  if (product.skimTable)
    extras.push(`skim table (${product.skimTable.length} rows)`);
  if (product.dates) extras.push("dates");
  if (product.tooltips) extras.push(`tooltips (${product.tooltips.length})`);
  if (product.longDescriptions) {
    extras.push(`long descriptions (${product.longDescriptions.length})`);
  }
  if (extras.length > 0) {
    lines.push(
      "",
      `Also retrieved: ${extras.join(", ")} — see structuredContent for the data.`,
    );
  }

  return lines.join("\n");
}

/** Registers the `inkeedecoder_get_product` tool. */
export function registerGetProductTool(server: McpServer): void {
  server.registerTool(
    "inkeedecoder_get_product",
    {
      title: "Get a product",
      description:
        "Fetch a cosmetic product page from INKEEDecoder (formerly INCIDecoder): brand, description, and full ingredient list, plus optional sections you opt into (grouped-by-function ingredients, irritancy/comedogenicity table, tooltips, long ingredient writeups). Accepts a slug, a /products/ path, or an inkeedecoder.com or incidecoder.com URL. Returns one page of data — verbose sections are off by default. Read-only.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({
      id,
      brand,
      description,
      ingredients,
      images,
      hashtags,
      full_name,
      functions,
      skim_table,
      dates,
      tooltips,
      long_descriptions,
    }) => {
      const resolved = resolveEntityId(id, "products");
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
        const product = await client.client.getProduct(resolved.path, {
          brand,
          description,
          ingredients,
          images,
          hashtags,
          fullName: full_name,
          functions,
          skimTable: skim_table,
          dates,
          tooltips,
          longDescriptions: long_descriptions,
        });

        return {
          content: [
            { type: "text", text: applyCharacterLimit(renderProduct(product)) },
          ],
          structuredContent: product,
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: toUserMessage(error, "Product lookup") },
          ],
          isError: true,
        };
      }
    },
  );
}
