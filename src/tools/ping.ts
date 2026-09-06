import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { readConfig } from "../config.js";
import { SERVER_NAME, SERVER_VERSION } from "../constants.js";

/**
 * Connectivity and configuration check. Makes no network request, so it works
 * offline and answers instantly — useful for confirming that a host has the
 * server wired up before trusting its lookup results.
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
    name: z.string().describe("Server name."),
    version: z.string().describe("Server version."),
  }),
  baseUrl: z
    .string()
    .describe("Base URL that the lookup tools will read from."),
});

/** Registers the `inkeedecoder_ping` tool. */
export function registerPingTool(server: McpServer): void {
  server.registerTool(
    "inkeedecoder_ping",
    {
      title: "Ping the INKEEDecoder server",
      description:
        "Check that the server is running and report which INKEEDecoder base URL it will read from. Sends no request to the site. Use it to verify configuration before calling lookup tools.",
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
      const config = readConfig();
      if (!config.ok) {
        return {
          content: [{ type: "text", text: config.error }],
          isError: true,
        };
      }

      const output = {
        ok: true,
        reply: message ? `pong: ${message}` : "pong",
        server: { name: SERVER_NAME, version: SERVER_VERSION },
        baseUrl: config.config.INKEEDECODER_BASE_URL,
      };

      return {
        content: [{ type: "text", text: output.reply }],
        structuredContent: output,
      };
    },
  );
}
