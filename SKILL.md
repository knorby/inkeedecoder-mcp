---
name: inkeedecoder
description: Query INKEEDecoder (formerly INCIDecoder) for cosmetic product ingredient lists, ingredient profiles with irritancy/comedogenicity ratings, and filtered product search. Use when the user asks what is in a cosmetic product, what an ingredient does, whether an ingredient is comedogenic or irritating, or to find products with or without specific ingredients.
---

# INKEEDecoder

Read [INKEEDecoder](https://inkeedecoder.com) — the community-run database of
cosmetic products and ingredients, formerly known as INCIDecoder — through the
`inkeedecoder_*` MCP tools. Every tool is read-only; every `id` accepts a slug
(`"squalane"`), a site path (`"/ingredients/squalane"`), or a URL from either
inkeedecoder.com or the older incidecoder.com.

## Workflow

1. **Search first, then fetch.** `inkeedecoder_search` finds products and
   ingredients by name; `inkeedecoder_search_products` filters products by
   ingredients they must (`include`) or must not (`exclude`) contain. Then call
   the matching `inkeedecoder_get_*` tool with the slug from the search.
2. **Page deliberately.** Results come one page at a time — check `hasMore`
   and call again with `page` + 1. Requests are spaced (~1 request/second
   against the live site), so each page costs real time; stop paging once you
   have what the answer needs.
3. **Verbose sections are opt-in.** `long_descriptions`, `skim_table`,
   `tooltips`, `details`, and `proof` are off by default because a single
   product's ingredient writeups can fill a context window. Turn one on only
   when the answer needs it.

## Recipes

### What's in this product?

`inkeedecoder_search` (tab `products`) → `inkeedecoder_get_product` with the
slug. The base response has the brand, description, and full ingredient list;
hashtags and skim table are opt-in.

### What does this ingredient do — and is it safe for me?

`inkeedecoder_search` (tab `ingredients`) → `inkeedecoder_get_ingredient`.
Irritancy and comedogenicity ratings are on the base response, along with
what the ingredient does. CosIng regulatory data, the long-form writeup, and
references are verbose opt-ins.

### Find products with X and without Y

`inkeedecoder_search_products` with `include` and/or `exclude` slug lists —
"moisturizers with squalane and no fragrance" is one call. Page with `hasMore`
to widen the pool, then fetch product details only for the shortlist worth
reading.

### Decode a pasted INCI list

For each ingredient name in the list: `inkeedecoder_search` (tab
`ingredients`) → `inkeedecoder_get_ingredient`. Each lookup is a request and
requests are spaced, so long lists take time — deliver findings progressively
rather than after the full walk, and summarize the standouts (actives,
known irritants, comedogenic entries) instead of reciting every line.

### Compare two products

`inkeedecoder_get_product` for both, then diff the ingredient lists. INCI
names match by string — a shared name means the same ingredient at possibly
different concentrations, which the database does not expose.

### Find alternatives to a product

`inkeedecoder_get_product` → pick its key ingredients (or resolve its
ingredient functions with `inkeedecoder_get_ingredient_function`) →
`inkeedecoder_search_products` with those as `include`.

### Resolve an old incidecoder.com link

Pass the URL directly as `id` to the matching `inkeedecoder_get_*` tool — no
search step needed. Old links are resolved through the renamed site.

## Etiquette

The data is user-submitted: it can be incomplete or out of date, and it is
not medical advice. Summarize in your own words rather than republishing the
site's prose, and cite the page URL (every response includes it). This server
is not affiliated with INKEEDecoder.
