import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { SERVER_NAME, SERVER_VERSION } from "../constants.js";

/**
 * Connectivity check that needs no credentials and no network.
 *
 * TODO(template): delete this tool once you add your own.
 */

const inputSchema = z.object({
  message: z
    .string()
    .max(500)
    .optional()
    .describe("Optional message to echo back. Omit for a bare 'pong'."),
});

const outputSchema = z.object({
  ok: z.boolean().describe("Always true — the server answered."),
  reply: z.string().describe("The echo response."),
  server: z.object({
    name: z.string(),
    version: z.string(),
  }),
});

/** Registers the `example_ping` tool. */
export function registerPingTool(server: McpServer): void {
  server.registerTool(
    "example_ping",
    {
      title: "Ping the server",
      description:
        "Check that the server is running and reachable. Returns 'pong', echoing back an optional message along with the server name and version. Use this to verify connectivity before calling tools that need credentials.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ message }) => {
      const output = {
        ok: true,
        reply: message ? `pong: ${message}` : "pong",
        server: { name: SERVER_NAME, version: SERVER_VERSION },
      };
      return {
        content: [{ type: "text", text: output.reply }],
        structuredContent: output,
      };
    },
  );
}
