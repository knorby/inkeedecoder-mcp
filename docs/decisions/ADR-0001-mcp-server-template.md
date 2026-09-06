# ADR-0001: MCP server template — SDK v2, stdio, ESM-only

- **Status:** Accepted
- **Date:** 2026-09-05

## Context

This repo started as a generic TypeScript library template (dual ESM/CJS
output, no runtime concern). It is being repurposed as a starter for local MCP
servers that wrap existing API/SDK libraries and are launched by a host
(Claude Code, VS Code, Cursor) or run with `npx`.

Three decisions shape the result:

1. The MCP TypeScript SDK published **v2** (2026-07-28 spec), splitting the
   monolithic `@modelcontextprotocol/sdk` into `@modelcontextprotocol/server`,
   `/client`, and `/core`. v1 (`@modelcontextprotocol/sdk` ≤ 1.30) is frozen.
2. These servers are **local and single-user**: the host spawns the process and
   owns its lifetime. There is no multi-tenant HTTP endpoint to secure.
3. The artifact is consumed as a **`bin`**, not as an imported library — the
   one programmatic export is the server factory, used by tests and by servers
   that compose others.

## Decision

- **SDK v2 only**, on `@modelcontextprotocol/server` + `zod` (v4). No v1
  compatibility shims.
- **stdio transport, shipped alone.** `src/index.ts` is the only entrypoint;
  `createServer()` in `src/server.ts` stays transport-agnostic so an HTTP
  entrypoint (`@modelcontextprotocol/node`, `/express`, `/hono`) can be added
  later without touching business logic.
- **ESM-only build.** Drop CJS output and the `.d.cts` copy step.
- **In-process integration tests** (`createMcpHandler` + a real `Client`) as the
  primary test layer, one stdio spawn test for the built binary, and an
  Inspector CLI `tools/list` smoke test in CI.

## Consequences

- Node-only. Any React Native / browser portability the base template offered is
  gone; MCP servers here are Node processes.
- `package.json` `exports` has a single entry (`.` → `dist/server.js`, the
  factory) plus `bin`. Consumers that need CJS cannot `require()` it.
- TypeScript resolves with `NodeNext`, so relative imports carry `.js`
  extensions and `tsconfig.json` sets `"types": ["node"]` (TypeScript ≥ 6 no
  longer auto-includes `@types/*`, and the SDK's declarations reference
  `Buffer`).
- Testing speed: no sockets, no ports, no protocol mocks — but the in-process
  harness covers the HTTP-era handler, so the stdio path is covered separately
  by spawning `dist/index.js`.
- The Inspector is a devDependency and a CI participant, so Node ≥ 22.19 is
  required for development even though the server itself runs on Node 22+.
