import { McpServer } from "@modelcontextprotocol/server";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { registerSummarizePrompt } from "./prompts/summarize.js";
import { registerInfoResource } from "./resources/info.js";
import { registerSearchItemsTool } from "./tools/example-api.js";
import { registerPingTool } from "./tools/ping.js";

/**
 * Builds the MCP server and registers every primitive.
 *
 * This factory is deliberately transport-agnostic and side-effect free: the
 * stdio entrypoint (`src/index.ts`) calls it through `serveStdio`, and tests
 * call it through `createMcpHandler` to drive the server in-process. Adding an
 * HTTP transport later means adding an entrypoint, not touching this file.
 *
 * Per-connection state (an API client holding credentials, for example) belongs
 * in here too — `serveStdio` calls the factory once per connection.
 */
export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  registerPingTool(server);
  registerSearchItemsTool(server);
  registerInfoResource(server);
  registerSummarizePrompt(server);

  return server;
}
