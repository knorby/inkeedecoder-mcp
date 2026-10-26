# Publishing: npm, Claude Desktop, and the MCP Registry

How this repository ships: the npm package and the `.mcpb` bundle are
automatic; the [Official MCP Registry](https://registry.modelcontextprotocol.io)
listing is a manual step (it is **not** part of the release workflow).

## Version consistency

`package.json` is the single source of truth. `server.json`, `manifest.json`,
and their relationship to it are pinned by `tests/metadata.test.ts` — a
release that bumps one file and not the others fails the suite at PR time.

## Official MCP Registry

The registry hosts **metadata only**; the npm package is the artifact. After
each npm release:

1. Install the publisher CLI (once): `brew install mcp-publisher`.
2. Authenticate with GitHub (once): `mcp-publisher login github` — device
   login flow. GitHub auth means the server name must stay under
   `io.github.knorby/`, which `mcpName` in `package.json` pins.
3. From the repo root: `mcp-publisher validate`, then `mcp-publisher publish`.

`server.json` carries the schema `2025-12-11`, the npm package reference, the
stdio transport, and the three optional `INKEEDECODER_*` environment
variables. The registry is in preview; verify field expectations against the
[quickstart](https://modelcontextprotocol.io/registry/quickstart) if
validation fails.

## Claude Desktop (MCPB)

`npm run pack:mcpb` builds `inkeedecoder-mcp-<version>.mcpb` from
`manifest.json` plus a production-only staging tree (devDependencies never
enter the bundle). The release workflow builds and attaches the bundle to the
GitHub Release; users double-click it to install into Claude Desktop (the
format was formerly DXT; see <https://github.com/anthropics/mcpb>).
