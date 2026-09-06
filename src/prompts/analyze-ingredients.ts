import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

/**
 * A reusable, user-invocable prompt: "analyze this product's ingredients".
 *
 * Prompts are user-driven (slash commands, palette entries) rather than
 * model-driven, which makes this the natural place to encode the workflow a
 * new user would otherwise have to guess: search for the product, read its
 * ingredient list, look up the ingredients that matter, and report back with
 * citations.
 */

/** Registers the `analyze_ingredients` prompt. */
export function registerAnalyzeIngredientsPrompt(server: McpServer): void {
  server.registerPrompt(
    "analyze_ingredients",
    {
      title: "Analyze a product's ingredients",
      description:
        "Look up a cosmetic product on INKEEDecoder and explain its ingredient list: what the headline ingredients do, what the ratings say, and anything worth flagging.",
      argsSchema: z.object({
        product: z
          .string()
          .min(1)
          .describe(
            'Product name, slug, or product URL on inkeedecoder.com or incidecoder.com — for example "The Ordinary Retinol 1% in Squalane".',
          ),
        focus: z
          .string()
          .optional()
          .describe(
            'Optional concern to weigh the analysis toward, for example "dry skin", "fragrance sensitivity", or "acne".',
          ),
      }),
    },
    ({ product, focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze the ingredients of this cosmetic product using the INKEEDecoder tools: ${product}${focus ? `\n\nPay particular attention to: ${focus}.` : ""}

Work through it like this:

1. Call inkeedecoder_search with the product name to find the exact product. If several match, pick the one whose name matches most closely and say which you chose.
2. Call inkeedecoder_get_product with that product's slug. Read the ingredient list from the result. Do not request long_descriptions, skim_table, or tooltips yet — the plain ingredient list is enough to decide what matters.
3. Call inkeedecoder_get_ingredient for the ingredients that actually drive the product: the actives named on the product page and anything you cannot characterize confidently from its name alone. Skip solvents, preservatives, and texture agents unless they are relevant to the question${focus ? " or to the stated concern" : ""}.
4. Report back:
   - What the product is and who makes it, with the page URL.
   - The headline ingredients and what each does, in plain language.
   - Anything INKEEDecoder flags: ratings, irritancy, comedogenicity${focus ? ", and anything bearing on the stated concern" : ""}.
   - A short verdict on who the product suits and who should avoid it.

Rules: summarize the site's writeups in your own words rather than quoting them at length, and cite the product and ingredient page URLs. If a lookup fails or the product is not in the database, say so plainly instead of filling the gap from memory — ingredient data is user-submitted and may be incomplete.`,
          },
        },
      ],
    }),
  );
}
