# Publishing: npm, Claude Desktop, and the MCP Registry

How this repository ships: the npm package, the `.mcpb` bundle, and the
[Official MCP Registry](https://registry.modelcontextprotocol.io) listing are
all published automatically by the release workflow.

## Version consistency

`package.json` is the single source of truth. `server.json`, `manifest.json`,
and their relationship to it are pinned by `tests/metadata.test.ts` — a
release that bumps one file and not the others fails the suite at PR time.

## Official MCP Registry

The registry hosts **metadata only**; the npm package is the artifact. The
release job publishes `server.json` right after npm: it downloads
`mcp-publisher`, authenticates with `login github-oidc` (the job's
`id-token: write` — no secret, no PAT), and runs `mcp-publisher publish`.
Because auth is GitHub-OIDC, the server name must stay under
`io.github.knorby/`, which `mcpName` in `package.json` pins.

Manual fallback (local): `brew install mcp-publisher`, then
`mcp-publisher login github && mcp-publisher publish` from the repo root.

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
