import type { McpServer } from "@modelcontextprotocol/server";
import { SERVER_NAME, SERVER_VERSION } from "../constants.js";

/**
 * Example static resource: server identity and capabilities.
 *
 * Resources suit data a host can read by URI without arguments — config,
 * status, or cached documents. Use a `ResourceTemplate` (URI with `{param}`)
 * for parameterized reads.
 *
 * TODO(template): replace or delete alongside the example tools.
 */

/** Registers the `server://info` resource. */
export function registerInfoResource(server: McpServer): void {
  server.registerResource(
    "server-info",
    "server://info",
    {
      title: "Server information",
      description: "Name, version, and capabilities of this MCP server.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            { name: SERVER_NAME, version: SERVER_VERSION, transport: "stdio" },
            null,
            2,
          ),
        },
      ],
    }),
  );
}
