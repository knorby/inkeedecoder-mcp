import * as z from "zod/v4";

/**
 * Output schemas mirroring the shapes returned by
 * `@knorby/inkeedecoder-client`.
 *
 * Field names stay in the client's camelCase so `structuredContent` is a
 * faithful view of the library's result with no translation layer to drift out
 * of sync. Tool *inputs* use snake_case, per this repo's convention.
 *
 * The schemas are closed (the zod default): a field the client adds in a later
 * version is dropped from the output rather than silently widening the
 * advertised contract. Add it here when it is worth exposing.
 */

/** INKEEDecoder's editorial ratings. */
export const OUR_TAKES = ["superstar", "goodie", "icky"] as const;

/** A cross-reference to another entity (product, ingredient, brand, function). */
export const refSchema = z.object({
  name: z.string().describe("Display name as shown on the site."),
  slug: z
    .string()
    .describe("Stable key; pass it back as the `id` of a lookup tool."),
  path: z.string().describe("Site-relative path."),
  url: z.string().describe("Absolute URL on the site."),
});

/** An ingredient reference, with the rating and percentage a product page shows. */
export const ingredientRefSchema = refSchema.extend({
  ourTake: z
    .enum(OUR_TAKES)
    .optional()
    .describe("INKEEDecoder's editorial rating, when the page shows one."),
  percent: z
    .string()
    .optional()
    .describe(
      "Declared percentage when the page states one, without the percent sign.",
    ),
});

/** A brand cross-reference. */
export const brandRefSchema = refSchema;

/** An ingredient-function cross-reference (for example "emollient"). */
export const functionRefSchema = refSchema;

/** One page of a paginated list. */
export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item).describe("Results on this page."),
    page: z.number().int().describe("1-based page number of this page."),
    hasMore: z.boolean().describe("Whether another page is available."),
    nextPageUrl: z
      .string()
      .optional()
      .describe("URL of the next page, present when hasMore is true."),
  });
}

/** Ingredients grouped under one function on a product page. */
export const ingredientsByFunctionSchema = z.object({
  function: functionRefSchema.describe("The function these ingredients serve."),
  ingredients: z
    .array(ingredientRefSchema)
    .describe("Ingredients serving this function."),
});

/** A row of the "skim through" irritancy/comedogenicity table. */
export const skimRowSchema = z.object({
  ingredient: ingredientRefSchema,
  functions: z.array(functionRefSchema),
  irritancy: z.string().optional(),
  comedogenicity: z.string().optional(),
  ourTake: z.enum(OUR_TAKES).optional(),
});

/** Per-ingredient data from a product page's hover tooltips. */
export const productTooltipSchema = z.object({
  slug: z.string(),
  functions: z.array(functionRefSchema),
  irritancy: z.string().optional(),
  comedogenicity: z.string().optional(),
  blurb: z.string().optional(),
});

/** A per-ingredient writeup from the "Ingredients explained" section. */
export const ingredientLongEntrySchema = z.object({
  ingredient: ingredientRefSchema,
  alsoCalled: z.string().optional(),
  functions: z.array(functionRefSchema),
  ourTake: z.enum(OUR_TAKES).optional(),
  description: z.string().optional(),
});

/** A product image; `webp`/`jpeg` hold the 1x/2x/3x srcset URLs when asked for. */
export const productImageSchema = z.object({
  original: z.string(),
  webp: z.array(z.string()).optional(),
  jpeg: z.array(z.string()).optional(),
});

/** A product page. Identity fields are always present; the rest follow the flags. */
export const productSchema = z.object({
  slug: z.string(),
  name: z.string(),
  path: z.string(),
  url: z.string(),
  brand: brandRefSchema.optional(),
  description: z.string().optional(),
  ingredients: z
    .array(ingredientRefSchema)
    .optional()
    .describe("Deduped ingredient list in INCI order."),
  images: productImageSchema.optional(),
  hashtags: z
    .array(z.object({ tag: z.string(), label: z.string() }))
    .optional(),
  fullName: z.string().optional(),
  functions: z
    .object({
      key: z.array(ingredientsByFunctionSchema),
      other: z.array(ingredientsByFunctionSchema),
    })
    .optional(),
  skimTable: z.array(skimRowSchema).optional(),
  dates: z
    .object({
      uploadedBy: z.string().optional(),
      uploadedAt: z.string().optional(),
      updatedAt: z.string().optional(),
    })
    .optional(),
  tooltips: z.array(productTooltipSchema).optional(),
  longDescriptions: z.array(ingredientLongEntrySchema).optional(),
});

/** An ingredient page. `ourTake` is null when the page carries no rating. */
export const ingredientSchema = z.object({
  slug: z.string(),
  name: z.string(),
  path: z.string(),
  url: z.string(),
  ourTake: z
    .enum(OUR_TAKES)
    .nullable()
    .describe("INKEEDecoder's editorial rating, or null if none is shown."),
  functions: z.array(functionRefSchema).optional(),
  alsoCalled: z.string().optional(),
  image: z.string().optional(),
  irritancy: z.string().optional(),
  comedogenicity: z.string().optional(),
  cosing: z
    .object({
      allFunctions: z.string().optional(),
      cas: z.string().optional(),
      ec: z.string().optional(),
      iupacName: z.string().optional(),
    })
    .optional(),
  details: z.string().optional(),
  proof: z.array(z.string()).optional(),
});

/** A product from an ingredient page's "known amount" carousel. */
export const knownAmountProductSchema = z.object({
  name: z.string(),
  slug: z.string(),
  path: z.string(),
  url: z.string(),
  percent: z.string().optional(),
  brand: z.string().optional(),
  image: z.string().optional(),
});
