import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { createMcpHandler, type McpServer } from "@modelcontextprotocol/server";
import { createServer } from "../src/server.js";

/**
 * In-process test harness.
 *
 * `createMcpHandler` exposes the server as a web-standard `fetch` handler, so
 * a real `Client` can drive it with no socket and no port: the transport's
 * `fetch` option hands each request straight to the handler. This exercises the
 * same code path a host uses — including schema validation and tool
 * registration — instead of calling handlers directly.
 *
 * @see https://ts.sdk.modelcontextprotocol.io/v2/testing
 */
export interface TestHarness {
  client: Client;
  /** Closes the client first, then the handler (per the SDK's guidance). */
  close: () => Promise<void>;
}

/** Connects a client to the server (or a custom factory) in memory. */
export async function createTestClient(
  factory: () => McpServer = createServer,
): Promise<TestHarness> {
  const handler = createMcpHandler(factory);
  const transport = new StreamableHTTPClientTransport(
    new URL("http://test.local/mcp"),
    {
      fetch: (url, init) => handler.fetch(new Request(url, init)),
    },
  );
  const client = new Client(
    { name: "test-harness", version: "1.0.0" },
    { versionNegotiation: { mode: "auto" } },
  );
  await client.connect(transport);

  return {
    client,
    close: async () => {
      await client.close();
      await handler.close();
    },
  };
}

/** Builds a JSON `Response` for stubbing `fetch`. */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

/** Extracts the single text block from a tool result. */
export function textOf(result: { content: unknown }): string {
  const blocks = result.content as { type: string; text?: string }[];
  const text = blocks.find((block) => block.type === "text")?.text;
  if (text === undefined) throw new Error("tool result has no text block");
  return text;
}
