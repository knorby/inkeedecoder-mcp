import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterEach, describe, expect, it } from "vitest";

/**
 * stdio coverage: spawn the built binary and talk to it the way a host does.
 *
 * This is the only way to test the real entrypoint (`bin` → `dist/index.js`),
 * and it catches what in-process tests cannot — a missing shebang, an import
 * that only resolves after bundling, or a stray `console.log` corrupting
 * stdout. It needs `npm run build` first, so it skips when `dist/` is absent.
 */
const distEntry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const distExists = existsSync(distEntry);

describe.skipIf(!distExists)("stdio entrypoint", () => {
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close();
    client = undefined;
  });

  it("serves tools over stdio", async () => {
    client = new Client(
      { name: "stdio-test", version: "1.0.0" },
      { versionNegotiation: { mode: "auto" } },
    );
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [distEntry],
        stderr: "pipe",
      }),
    );

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain("example_ping");

    const result = await client.callTool({
      name: "example_ping",
      arguments: {},
    });
    expect(result.structuredContent).toMatchObject({ ok: true });
  }, 30_000);
});
