# Test fixtures

Captured HTML from [inkeedecoder.com](https://inkeedecoder.com/) used by the
offline test suite (`npm test`). These files let the parser tests run offline
and deterministically, and double as a tripwire when the site's markup changes.

## Attribution & copyright

The HTML in this directory is reproduced from inkeedecoder.com. All rights in the
source content — including product descriptions, ingredient writeups, brand
names, and page markup — belong to INKEEDecoder (`hello@inkeedecoder.com`). The
content is reproduced here **solely for non-distributed, development-time test
fixtures** and is **not** shipped in the published package (the `files` field
in `package.json` whitelists only `dist/`, `README.md`, `CHANGELOG.md`, and
`LICENSE`).

If you are INKEEDecoder's operator and would prefer these fixtures removed,
open an issue at <https://github.com/knorby/inkeedecoder-client/issues> and they
will be taken down.

## How they were captured

Via `node scripts/capture-fixtures.mjs`, which `GET`s each URL below with a
`User-Agent` of
`@knorby/inkeedecoder-client/0 (capture-fixtures; +https://github.com/knorby/inkeedecoder-client)`
and a 750 ms pause between requests (polite scraping). Re-run that script to
refresh the fixtures, then update expected assertions in the `*.test.ts` files
if the site's markup has changed.

- **Captured:** 2026-08-16
- **Base URL:** `https://inkeedecoder.com`

## Fixture manifest

| File | Source path | Bytes | Tests |
| --- | --- | --- | --- |
| `product-the-ordinary-retinol-1-in-squalane.html` | `/products/the-ordinary-retinol-1-in-squalane` | 59248 | `product.test.ts`, `client.test.ts` |
| `ingredient-squalane.html` | `/ingredients/squalane` | 49437 | `ingredient.test.ts`, `client.test.ts` |
| `ingredient-tocopherol.html` | `/ingredients/tocopherol` | 55212 | `ingredient.test.ts` (richer page: CosIng, proof, known-amount carousel, paginated product list) |
| `search-the-ordinary.html` | `/search?query=the+ordinary` | 28519 | `lists.test.ts`, `client.test.ts` (products-only results, `ppage=2` next link) |
| `search-squalane.html` | `/search?query=squalane` | 27606 | `lists.test.ts` (has ingredient-tab results) |
| `search-squalane-products-page2.html` | `/search?query=squalane&activetab=products&ppage=2` | 28480 | `lists.test.ts` (page-2 product hits) |
| `search-products-advanced.html` | `/search/product?query=the+ordinary&include=Squalane` | 20541 | `lists.test.ts`, `client.test.ts` (advanced include filter; no `.detailpage` wrapper) |
| `brand-the-ordinary.html` | `/brands/the-ordinary` | 22320 | `lists.test.ts`, `client.test.ts` (`offset=1` next link) |
| `ingredient-function-emollient.html` | `/ingredient-functions/emollient` | 22093 | `lists.test.ts`, `client.test.ts` (`offset=1` next link) |

Byte counts are the raw response bodies (UTF-8).
