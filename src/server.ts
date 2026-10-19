import { McpServer } from "@modelcontextprotocol/server";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { registerAnalyzeIngredientsPrompt } from "./prompts/analyze-ingredients.js";
import { registerInfoResource } from "./resources/info.js";
import { registerGetBrandTool } from "./tools/get-brand.js";
import { registerGetIngredientTool } from "./tools/get-ingredient.js";
import { registerGetIngredientFunctionTool } from "./tools/get-ingredient-function.js";
import { registerGetIngredientProductsTool } from "./tools/get-ingredient-products.js";
import { registerGetProductTool } from "./tools/get-product.js";
import { registerPingTool } from "./tools/ping.js";
import { registerSearchTool } from "./tools/search.js";
import { registerSearchProductsTool } from "./tools/search-products.js";

/**
 * Builds the MCP server and registers every primitive.
 *
 * This factory is deliberately transport-agnostic and side-effect free: the
 * stdio entrypoint (`src/index.ts`) calls it through `serveStdio`, and tests
 * call it through `createMcpHandler` to drive the server in-process. Adding an
 * HTTP transport later means adding an entrypoint, not touching this file.
 */

/**
 * How to use the server, handed to the host at initialization.
 *
 * Hosts surface this to the model, so it carries what a tool description
 * cannot: the search-then-fetch workflow, the fact that every id accepts a URL
 * from either the current or the former domain, and the etiquette that keeps
 * the server a good citizen of a community-run site.
 */
const INSTRUCTIONS = `INKEEDecoder (formerly INCIDecoder — see https://inkeedecoder.com/new-name) is a community-run database of cosmetic products and ingredients. This server reads it.

Workflow: search first, then fetch. Use inkeedecoder_search to find products and ingredients by name, or inkeedecoder_search_products to filter products by the ingredients they must or must not contain ("moisturizers with squalane and no fragrance"). Then call the matching inkeedecoder_get_* tool with the slug you found.

Every \`id\` argument accepts a slug ("squalane"), a site path ("/ingredients/squalane"), or a URL. Links from inkeedecoder.com and from the older incidecoder.com both work: the site was renamed, and old links are resolved through the current site.

Results come one page at a time — check \`hasMore\` and call again with \`page\` + 1. Verbose sections (long_descriptions, skim_table, tooltips, details, proof) are off by default; turn one on only when the answer needs it, because a single product's ingredient writeups can fill a context window on their own. Very large results are shortened to fit a response limit; when that happens, the text says which fields were cut.

Etiquette: the data is user-submitted, so it can be incomplete or out of date. Summarize rather than republishing the site's prose, and cite the page URL. This server is not affiliated with INKEEDecoder.`;

/** Builds the server and registers every tool, resource, and prompt. */
export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );

  registerPingTool(server);
  registerSearchTool(server);
  registerSearchProductsTool(server);
  registerGetProductTool(server);
  registerGetIngredientTool(server);
  registerGetIngredientProductsTool(server);
  registerGetBrandTool(server);
  registerGetIngredientFunctionTool(server);
  registerInfoResource(server);
  registerAnalyzeIngredientsPrompt(server);

  return server;
}
