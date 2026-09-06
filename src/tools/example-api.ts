import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { readConfig } from "../config.js";
import { toUserMessage } from "../lib/errors.js";
import {
  applyCharacterLimit,
  markdownBullets,
  RESPONSE_FORMATS,
  type ResponseFormat,
} from "../lib/format.js";
import { apiRequest } from "../lib/http.js";

/**
 * Example of wrapping an HTTP API as a tool.
 *
 * This is the pattern to copy per endpoint: a Zod input schema where every
 * field is `.describe()`d, lazy configuration checks that return actionable
 * errors, `outputSchema` + `structuredContent` for machine-readable results,
 * pagination, and a character-limit guard.
 *
 * TODO(template): replace with the endpoints of the API you are wrapping.
 */

interface SearchResponse {
  total?: number;
  items?: { id?: string; title?: string; url?: string }[];
}

const inputSchema = z.object({
  query: z
    .string()
    .min(2, "Query must be at least 2 characters")
    .max(200, "Query must not exceed 200 characters")
    .describe("Search string matched against item titles."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of results to return (1-100, default 20)."),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe(
      "Number of results to skip, for paging through large result sets.",
    ),
  response_format: z
    .enum(RESPONSE_FORMATS)
    .default("markdown")
    .describe(
      "Output format: 'markdown' for human-readable, 'json' for machine-readable.",
    ),
});

const outputSchema = z.object({
  total: z.number().int().describe("Total number of matches."),
  count: z.number().int().describe("Number of results in this response."),
  offset: z.number().int().describe("Offset these results start at."),
  items: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        url: z.string().optional(),
      }),
    )
    .describe("Matching items."),
  hasMore: z
    .boolean()
    .describe("Whether more results are available past this page."),
  nextOffset: z
    .number()
    .int()
    .optional()
    .describe(
      "Offset to pass for the next page, present only when hasMore is true.",
    ),
});

type SearchInput = z.infer<typeof inputSchema>;
type SearchOutput = z.infer<typeof outputSchema>;

/** Registers the `example_search_items` tool. */
export function registerSearchItemsTool(server: McpServer): void {
  server.registerTool(
    "example_search_items",
    {
      title: "Search items",
      description:
        "Search the Example API for items whose title matches a query. Read-only: it never creates or modifies data. Returns a page of results with the total match count, plus a nextOffset you can pass back to continue paging.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, limit, offset, response_format }: SearchInput) => {
      const config = readConfig();
      if (!config.ok) {
        return {
          content: [{ type: "text", text: config.error }],
          isError: true,
        };
      }
      if (!config.config.EXAMPLE_API_KEY) {
        return {
          content: [
            {
              type: "text",
              text: "Error: EXAMPLE_API_KEY is not set. Add it to the server's `env` block in your MCP client config, then call this tool again.",
            },
          ],
          isError: true,
        };
      }

      try {
        const data = await apiRequest<SearchResponse>({
          baseUrl: config.config.EXAMPLE_API_BASE_URL,
          apiKey: config.config.EXAMPLE_API_KEY,
          path: "/items",
          query: { q: query, limit, offset },
          timeoutMs: config.config.EXAMPLE_TIMEOUT_MS,
        });

        const items = (data.items ?? []).flatMap((item) =>
          item.id && item.title
            ? [
                {
                  id: item.id,
                  title: item.title,
                  ...(item.url ? { url: item.url } : {}),
                },
              ]
            : [],
        );
        const total = data.total ?? items.length;
        const hasMore = total > offset + items.length;
        const output: SearchOutput = {
          total,
          count: items.length,
          offset,
          items,
          hasMore,
          ...(hasMore ? { nextOffset: offset + items.length } : {}),
        };

        const text =
          response_format === ("json" satisfies ResponseFormat)
            ? JSON.stringify(output, null, 2)
            : markdownBullets(
                `Found ${total} item(s) for "${query}" (showing ${items.length})`,
                items.map((item) => `${item.title} — ${item.id}`),
              );

        return {
          content: [{ type: "text", text: applyCharacterLimit(text) }],
          structuredContent: output,
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: toUserMessage(error, "Search") }],
          isError: true,
        };
      }
    },
  );
}
