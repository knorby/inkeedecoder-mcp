import { readFileSync } from "node:fs";

const client = await import("@knorby/inkeedecoder-client");

const read = (f) =>
  readFileSync(new URL(`../tests/fixtures/${f}`, import.meta.url), "utf8");

const base = "https://inkeedecoder.com";
const brief = (items) => items.slice(0, 6).map((i) => `${i.name}|${i.path}`);

const search = client.parseSearchPage(read("search-squalane.html"), base);
console.log("SEARCH squalane: query=", JSON.stringify(search.query));
console.log("  products:", search.products.items.length, "hasMore=", !!search.products.nextPageUrl, brief(search.products.items));
console.log("  ingredients:", search.ingredients.items.length, "hasMore=", !!search.ingredients.nextPageUrl, brief(search.ingredients.items));

const searchTo = client.parseSearchPage(read("search-the-ordinary.html"), base);
console.log("SEARCH the ordinary: query=", JSON.stringify(searchTo.query), "products:", searchTo.products.items.length, brief(searchTo.products.items));

const page2 = client.parseSearchPage(read("search-squalane-products-page2.html"), base);
console.log("SEARCH page2: products:", page2.products.items.length, brief(page2.products.items));

const adv = client.parseSearchProductsPage(read("search-products-advanced.html"), base);
console.log("ADVANCED: items:", adv.items.length, "hasMore=", !!adv.nextPageUrl, brief(adv.items));

const product = client.parseProductPage(read("product-the-ordinary-retinol-1-in-squalane.html"), base);
console.log("PRODUCT:", JSON.stringify({ slug: product.slug, name: product.name, path: product.path }));
console.log("  brand:", JSON.stringify(product.brand));
console.log("  ingredients:", product.ingredients?.length, brief(product.ingredients ?? []));
console.log("  first ingredient:", JSON.stringify(product.ingredients?.[0]));
console.log("  hashtags:", JSON.stringify(product.hashtags?.slice(0, 4)));
console.log("  desc head:", JSON.stringify(product.description?.slice(0, 120)));
console.log("  fullName:", JSON.stringify(product.fullName));
console.log("  skim rows:", product.skimTable?.length, "tooltips:", product.tooltips?.length, "long:", product.longDescriptions?.length, "fn groups:", product.functions ? product.functions.key.length + product.functions.other.length : 0);

const ing = client.parseIngredientPage(read("ingredient-squalane.html"), base);
console.log("INGREDIENT squalane:", JSON.stringify({ slug: ing.slug, name: ing.name, ourTake: ing.ourTake, irritancy: ing.irritancy, comedogenicity: ing.comedogenicity }));
console.log("  functions:", ing.functions?.map((f) => f.name));
console.log("  alsoCalled:", JSON.stringify(ing.alsoCalled));
console.log("  details len:", ing.details?.length, "proof:", ing.proof?.length);
console.log("  cosing:", JSON.stringify(ing.cosing));

const toc = client.parseIngredientPage(read("ingredient-tocopherol.html"), base);
console.log("INGREDIENT tocopherol:", JSON.stringify({ slug: toc.slug, name: toc.name, ourTake: toc.ourTake }));

const ingProds = client.parseIngredientProductsPage(read("ingredient-squalane.html"), base);
console.log("INGREDIENT PRODUCTS: count:", ingProds.products.items.length, "hasMore=", !!ingProds.products.nextPageUrl, brief(ingProds.products.items));
console.log("  knownAmount:", ingProds.knownAmountProducts?.length, JSON.stringify(ingProds.knownAmountProducts?.[0]));

const brand = client.parseBrandPage(read("brand-the-ordinary.html"), base);
console.log("BRAND:", JSON.stringify({ name: brand.name }), "products:", brand.products.items.length, "hasMore=", !!brand.products.nextPageUrl, brief(brand.products.items));

const fnPage = client.parseIngredientFunctionPage(read("ingredient-function-emollient.html"), base);
console.log("FUNCTION:", JSON.stringify({ name: fnPage.name }), "ingredients:", fnPage.ingredients.items.length, "hasMore=", !!fnPage.ingredients.nextPageUrl, brief(fnPage.ingredients.items));
console.log("  desc head:", JSON.stringify(fnPage.description?.slice(0, 120)));
