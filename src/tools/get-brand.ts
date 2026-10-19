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
import { resolveEntityId } from "../lib/ids.js";
import { paginatedSchema, refSchema } from "../lib/schemas.js";

/** A brand page: the brand's identity plus its catalogue, one page at a time. */

const inputSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "Brand slug, site path (/brands/...), or brand URL on inkeedecoder.com or incidecoder.com. The slug is the last segment of the page URL.",
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
  slug: z.string().describe("Brand slug."),
  name: z.string().describe("Brand name."),
  path: z.string().describe("Site-relative path."),
  url: z.string().describe("Absolute URL on the site."),
  products: paginatedSchema(refSchema).describe(
    "This page of the brand's products.",
  ),
});

/** Registers the `inkeedecoder_get_brand` tool. */
export function registerGetBrandTool(server: McpServer): void {
  server.registerTool(
    "inkeedecoder_get_brand",
    {
      title: "Get a brand's products",
      description:
        "Fetch a brand page from INKEEDecoder (formerly INCIDecoder) and its catalogue of products, one page at a time. Accepts a slug, a /brands/ path, or an inkeedecoder.com or incidecoder.com URL. Read-only.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, page }, ctx) => {
      const resolved = resolveEntityId(id, "brands");
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
        const brand = await client.client.getBrand(resolved.path, {
          page,
          signal: ctx.mcpReq.signal,
        });

        const bounded = boundStructured(brand);

        const text =
          applyCharacterLimit(
            [
              `# ${brand.name}`,
              "",
              brand.url,
              "",
              markdownBullets(
                `Products (page ${brand.products.page})`,
                refLines(brand.products.items),
              ) +
                morePagesNote(brand.products.hasMore, brand.products.page + 1),
            ].join("\n"),
          ) + (bounded.truncated ? truncationNote() : "");

        return {
          content: [{ type: "text", text }],
          structuredContent: bounded.value,
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: toUserMessage(error, "Brand lookup") },
          ],
          isError: true,
        };
      }
    },
  );
}
