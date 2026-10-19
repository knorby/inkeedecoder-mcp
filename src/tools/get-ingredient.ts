import type { Ingredient } from "@knorby/inkeedecoder-client";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getClient } from "../lib/client.js";
import { toUserMessage } from "../lib/errors.js";
import {
  applyCharacterLimit,
  boundStructured,
  truncationNote,
} from "../lib/format.js";
import { resolveEntityId } from "../lib/ids.js";
import { ingredientSchema } from "../lib/schemas.js";

/**
 * A full ingredient page — the heart of the site: what an ingredient does, how
 * it is rated, its irritancy and comedogenicity, and (on request) the
 * long-form writeup and reference list.
 */

const inputSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "Ingredient slug, site path (/ingredients/...), or ingredient URL on inkeedecoder.com or incidecoder.com. The slug is the last segment of the page URL. Get one from inkeedecoder_search or a product's ingredient list.",
    ),
  functions: z
    .boolean()
    .default(true)
    .describe(
      "Include what the ingredient does, as /ingredient-functions/ links. Default true.",
    ),
  safety: z
    .boolean()
    .default(true)
    .describe("Include irritancy and comedogenicity ratings. Default true."),
  also_called: z
    .boolean()
    .default(true)
    .describe('Include the "also-called" alias. Default true.'),
  image: z
    .boolean()
    .default(true)
    .describe("Include the ingredient's image URL. Default true."),
  cosing: z
    .boolean()
    .default(false)
    .describe(
      "Include CosIng data: CAS number, EC number, IUPAC name, and official functions. Default false.",
    ),
  details: z
    .boolean()
    .default(false)
    .describe(
      "Include the long-form writeup. Default false — it is several thousand characters per ingredient, so ask for it only when the answer needs the detail.",
    ),
  proof: z
    .boolean()
    .default(false)
    .describe(
      "Include the reference list cited by the writeup. Default false.",
    ),
});

const outputSchema = ingredientSchema;

/** Renders the summary a model reads; the full record is in structuredContent. */
function renderIngredient(ingredient: Ingredient): string {
  const lines: string[] = [
    `# ${ingredient.name}`,
    "",
    ingredient.url,
    "",
    `Rating: ${ingredient.ourTake ?? "not rated"}`,
  ];

  if (ingredient.alsoCalled) {
    lines.push(`Also called: ${ingredient.alsoCalled}`);
  }
  if (ingredient.irritancy || ingredient.comedogenicity) {
    lines.push(
      `Irritancy: ${ingredient.irritancy ?? "n/a"} — Comedogenicity: ${ingredient.comedogenicity ?? "n/a"}`,
    );
  }
  if (ingredient.functions && ingredient.functions.length > 0) {
    lines.push(
      `Functions: ${ingredient.functions.map((fn) => fn.name).join(", ")}`,
    );
  }
  if (ingredient.cosing) {
    const parts = [
      ingredient.cosing.cas ? `CAS ${ingredient.cosing.cas}` : undefined,
      ingredient.cosing.ec ? `EC ${ingredient.cosing.ec}` : undefined,
      ingredient.cosing.iupacName,
    ].filter(Boolean);
    if (parts.length > 0) lines.push(`CosIng: ${parts.join(" — ")}`);
  }
  if (ingredient.details) {
    lines.push("", "## Details", "", ingredient.details);
  }
  if (ingredient.proof && ingredient.proof.length > 0) {
    lines.push(
      "",
      `## References (${ingredient.proof.length})`,
      "",
      ingredient.proof.map((entry) => `- ${entry}`).join("\n"),
    );
  }

  return lines.join("\n");
}

/** Registers the `inkeedecoder_get_ingredient` tool. */
export function registerGetIngredientTool(server: McpServer): void {
  server.registerTool(
    "inkeedecoder_get_ingredient",
    {
      title: "Get an ingredient",
      description:
        "Fetch a cosmetic ingredient page from INKEEDecoder (formerly INCIDecoder): what it does, INKEEDecoder's rating, irritancy and comedogenicity, and optional CosIng identifiers, long-form writeup, and references. Accepts a slug, an /ingredients/ path, or an inkeedecoder.com or incidecoder.com URL. The long writeup is off by default. Read-only.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (
      { id, functions, safety, also_called, image, cosing, details, proof },
      ctx,
    ) => {
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
        const ingredient = await client.client.getIngredient(resolved.path, {
          functions,
          safety,
          alsoCalled: also_called,
          image,
          cosing,
          details,
          proof,
          signal: ctx.mcpReq.signal,
        });

        const bounded = boundStructured(ingredient);

        return {
          content: [
            {
              type: "text",
              text:
                applyCharacterLimit(renderIngredient(ingredient)) +
                (bounded.truncated ? truncationNote() : ""),
            },
          ],
          structuredContent: bounded.value,
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: toUserMessage(error, "Ingredient lookup") },
          ],
          isError: true,
        };
      }
    },
  );
}
