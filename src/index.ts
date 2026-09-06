#!/usr/bin/env node
/**
 * stdio entrypoint — the file `bin` points at.
 *
 * A host (Claude Code, VS Code, Cursor, …) spawns this program and speaks
 * JSON-RPC over stdin/stdout. `serveStdio` owns that transport and calls
 * `createServer` once per connection.
 */

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { logError, logInfo } from "./lib/log.js";
import { createServer } from "./server.js";

const handle = serveStdio(createServer, {
  onerror: (error) => logError("stdio transport error", error),
});

// stderr only: stdout carries the protocol.
logInfo(`${SERVER_NAME} ${SERVER_VERSION} running on stdio`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void handle.close().finally(() => process.exit(0));
  });
}
