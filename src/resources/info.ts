import type { McpServer } from "@modelcontextprotocol/server";
import { readConfig } from "../config.js";
import { ALLOWED_HOSTS, SERVER_NAME, SERVER_VERSION } from "../constants.js";

/**
 * Static resource: what this server is and how it is configured.
 *
 * A host can read it by URI with no arguments, which makes it the right place
 * for the facts an operator wants to confirm without calling a tool: which
 * site is being read and which link hosts are accepted.
 */

/** Registers the `server://info` resource. */
export function registerInfoResource(server: McpServer): void {
  server.registerResource(
    "server-info",
    "server://info",
    {
      title: "Server information",
      description:
        "Name, version, transport, base URL, and accepted link hosts for this INKEEDecoder MCP server.",
      mimeType: "application/json",
    },
    async (uri) => {
      // Read lazily, and report a broken configuration rather than hiding it:
      // a host reading this resource is exactly who needs to see the error.
      const config = readConfig();

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                name: SERVER_NAME,
                version: SERVER_VERSION,
                transport: "stdio",
                source: "https://inkeedecoder.com",
                about:
                  "INKEEDecoder (formerly INCIDecoder) is a community-run database of cosmetic products and ingredients. This server is not affiliated with it.",
                baseUrl: config.ok ? config.config.INKEEDECODER_BASE_URL : null,
                requestIntervalMs: config.ok
                  ? config.config.INKEEDECODER_REQUEST_INTERVAL_MS
                  : null,
                timeoutMs: config.ok
                  ? config.config.INKEEDECODER_TIMEOUT_MS
                  : null,
                acceptedLinkHosts: ALLOWED_HOSTS,
                configError: config.ok ? null : config.error,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
