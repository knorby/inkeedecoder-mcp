# @knorby/inkeedecoder-mcp

An MCP (Model Context Protocol) server for [INKEEDecoder](https://inkeedecoder.com)
— the community-run database of cosmetic products and ingredients, formerly
known as INCIDecoder.

It wraps [`@knorby/inkeedecoder-client`](https://www.npmjs.com/package/@knorby/inkeedecoder-client)
and exposes it to MCP hosts: search for products and ingredients, read a
product's ingredient list, look up what an ingredient does and how it is rated,
and follow the links between them. Runs locally over stdio, needs no API key,
and is installable with `npx`.

> **Not affiliated with INKEEDecoder.** This project reads publicly available
> pages the same way a browser does. Data is user-submitted and may be
> incomplete or out of date; it is not medical advice.

## Tools

| Tool | What it does |
| --- | --- |
| `inkeedecoder_search` | Search products and ingredients by name. Returns both tabs, or one tab with `tab` for a single request per page. |
| `inkeedecoder_search_products` | Advanced product search: filter by ingredients a product must contain (`include`) or must not contain (`exclude`). |
| `inkeedecoder_get_product` | A product page: brand, description, ingredient list, hashtags, plus optional sections you opt into. |
| `inkeedecoder_get_ingredient` | An ingredient page: what it does, INKEEDecoder's rating, irritancy/comedogenicity, and optional CosIng data, long-form writeup, and references. |
| `inkeedecoder_get_ingredient_products` | The reverse of a product page: which products contain a given ingredient. |
| `inkeedecoder_get_brand` | A brand and its catalogue. |
| `inkeedecoder_get_ingredient_function` | An ingredient function (for example `emollient`) and the ingredients filed under it. |
| `inkeedecoder_ping` | Connectivity and configuration check. Sends no request to the site. |

Every tool is read-only and idempotent. Every list is paginated: a response
tells you whether another page exists, and you ask for it with `page`. Results
are bounded — when one has to be shortened, the text says so.

Verbose sections (`long_descriptions`, `skim_table`, `tooltips`, `details`,
`proof`) are off by default because a single product's ingredient writeups can
fill a context window on their own.

## Installing

### With an MCP host

```json
{
  "mcpServers": {
    "inkeedecoder": {
      "command": "npx",
      "args": ["-y", "@knorby/inkeedecoder-mcp"]
    }
  }
}
```

From a local checkout, point at the built entrypoint instead:

```json
{
  "mcpServers": {
    "inkeedecoder": {
      "command": "node",
      "args": ["/absolute/path/to/inkeedecoder-mcp/dist/index.js"]
    }
  }
}
```

Config file locations vary by host: `claude_desktop_config.json`,
`.cursor/mcp.json`, `.vscode/mcp.json`, or `claude mcp add` on the CLI. There
is no API key to configure — the server reads public pages.

### One-click in Claude Desktop

Every release ships an [MCPB bundle](https://github.com/anthropics/mcpb) —
`inkeedecoder-mcp-<version>.mcpb` — attached to its
[GitHub Releases](https://github.com/knorby/inkeedecoder-mcp/releases) page.
Download it and open it with Claude Desktop (macOS or Windows) to install
with a single click.

### Directories and registries

- **Official MCP Registry** — listed as `io.github.knorby/inkeedecoder-mcp`
  ([registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io));
  metadata lives in `server.json`.
- **Smithery** — `smithery.yaml` at the repo root; submit or install from
  [smithery.ai](https://smithery.ai).
- **Glama** — indexed from this repository at
  [glama.ai/mcp/servers](https://glama.ai/mcp/servers); the `Dockerfile`
  covers container-based installs.

See `docs/publishing-registries.md` for how each channel is maintained.

### Configuration

Every variable is optional. The defaults read inkeedecoder.com politely.

| Variable | Default | Purpose |
| --- | --- | --- |
| `INKEEDECODER_BASE_URL` | `https://inkeedecoder.com` | Site to read. Point it at a mirror or a locally archived copy. |
| `INKEEDECODER_REQUEST_INTERVAL_MS` | `1000` | Minimum spacing between requests, across tool calls. Values below the default apply only to mirrors — reads of inkeedecoder.com itself keep at least the default. |
| `INKEEDECODER_TIMEOUT_MS` | `30000` | Abandon a request that takes longer than this. `0` disables the timeout. |

Pass them through the host's `env` block. The server never reads a `.env` file.

## Links and identifiers

Every `id` argument accepts any of three shapes:

- a **slug** — `squalane`, `the-ordinary-retinol-1-in-squalane` (the last
  segment of the page URL)
- a **site path** — `/ingredients/squalane`
- a **URL** — `https://inkeedecoder.com/ingredients/squalane`

URLs from **incidecoder.com** work too. INCIDecoder renamed itself to
INKEEDecoder after a trademark dispute with PCPC, the body that owns the INCI
nomenclature (see [inkeedecoder.com/new-name](https://inkeedecoder.com/new-name));
it is the same site and the same database, and the old URLs redirect. This
server accepts both hosts, keeps only the path, and fetches it from the
configured base URL — so a stale link pasted from an old chat transcript still
resolves, and the old domain is never contacted.

Links from any other host are rejected with an explanation, and passing an
ingredient link to the product tool (or the reverse) returns an error naming
the tool you wanted rather than mis-parsing the page.

## Etiquette

The site is a volunteer-run database that permits the paths this server reads
(see its `robots.txt`) and asks that automated traffic stay light.

- Requests are spaced by `INKEEDECODER_REQUEST_INTERVAL_MS` — across separate
  tool calls, not just within one — and reads of inkeedecoder.com keep at least
  the default interval. Requests time out (`INKEEDECODER_TIMEOUT_MS`, 30 s by
  default) rather than piling up.
- Summarize rather than republishing the site's prose, and cite page URLs.
- Expect gaps: entries are user-submitted.

## Prerequisites

- **Node.js 24+** (use [nvm](https://github.com/nvm-sh/nvm) or
  [fnm](https://github.com/Schniz/fnm); this repo includes an `.nvmrc`). The
  server itself runs on Node 22+; the Inspector needs 22.19+.
- **npm** (bundled with Node).
- **pre-commit** — `pipx install pre-commit` or `brew install pre-commit`.
- **gitleaks** — `brew install gitleaks` (secret scanner for pre-commit).
- **Go toolchain** — `brew install go` (required once for the TruffleHog hook
  build).

## Getting started

```bash
git clone https://github.com/knorby/inkeedecoder-mcp.git
cd inkeedecoder-mcp
nvm use              # or: fnm use
npm install
npx husky            # set up hooks (prepare is blocked by .npmrc ignore-scripts)
pre-commit install   # file hygiene + secret scanning
pre-commit run --all-files
```

The first `pre-commit run` installs hook environments and builds TruffleHog
from source (a few minutes). Later runs are cached and fast.

## Development

| Command | What it does |
| --- | --- |
| `npm run build` | Build the server (tsup bundle + `tsc` declarations) |
| `npm run dev` | Run the server from source with `tsx watch` |
| `npm run inspect` | Open the MCP Inspector web UI against the built server |
| `npm run inspect:cli` | Call `tools/list` through the Inspector CLI |
| `npm run test:smoke` | Inspector CLI smoke test against `dist/` (used by CI) |
| `npm run lint` | Lint + formatting check with Biome (read-only) |
| `npm run format` | Format with Biome (writes changes) |
| `npm run check` | Lint + format in one pass (writes changes) |
| `npm run typecheck` | Type-check `src/` + `tests/` with `tsc` (no emit) |
| `npm test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage reporting |

`npm run inspect` is the fastest loop — it launches the server, lists its
tools, and lets you call them with arguments in a browser.

### Project structure

```
src/
  index.ts              # stdio entrypoint (`bin`) — serveStdio(createServer)
  server.ts             # createServer(): registers tools, resources, prompts
  config.ts             # lazy Zod-parsed environment config
  constants.ts          # defaults, accepted link hosts, version from package.json
  lib/
    client.ts           # builds and caches the inkeedecoder-client from config
    ids.ts              # slug/path/URL -> site path (host + type validation)
    schemas.ts          # output schemas mirroring the client's types
    errors.ts           # error -> actionable tool message
    format.ts           # markdown rendering + response bounding
    log.ts              # stderr-only logging
  tools/                # one file per tool
  resources/            # resource registrations
  prompts/              # prompt registrations
tests/
  helpers.ts            # in-process test client (createMcpHandler + Client)
  fixtures/             # real pages captured from the site (test inputs)
  tools.test.ts         # integration tests through a real client
  config.test.ts        # environment contract (defaults, floor)
  stdio.test.ts         # spawns dist/index.js and calls tools over stdio
inspector.config.json   # MCP Inspector server config
dist/                   # build output (gitignored)
.changeset/             # changeset files (versioning)
.github/workflows/      # CI + release workflows
docs/decisions/         # architecture decision records (ADRs)
```

## Writing tools

A tool is a name, a config, and an async handler:

```ts
server.registerTool(
  "inkeedecoder_get_brand",
  {
    title: "Get a brand's products",
    description: "Fetch a brand page and its catalogue, one page at a time. Read-only.",
    inputSchema: z.object({
      id: z.string().min(1).describe("Brand slug, /brands/ path, or URL."),
      page: z.number().int().min(1).default(1).describe("1-based page number."),
    }),
    outputSchema: z.object({ name: z.string(), products: paginatedSchema(refSchema) }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ id, page }, ctx) => {
    const resolved = resolveEntityId(id, "brands");
    if (!resolved.ok) {
      return { content: [{ type: "text", text: resolved.error }], isError: true };
    }
    const client = getClient();
    if (!client.ok) {
      return { content: [{ type: "text", text: client.error }], isError: true };
    }
    try {
      const brand = await client.client.getBrand(resolved.path, {
        page,
        signal: ctx.mcpReq.signal, // cancellation from the host
      });
      const bounded = boundStructured(brand);
      return {
        content: [{ type: "text", text: applyCharacterLimit(render(brand)) }],
        structuredContent: bounded.value,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: toUserMessage(error, "Brand lookup") }],
        isError: true,
      };
    }
  },
);
```

Conventions this repo follows:

- **Naming** — `inkeedecoder_{action}` in snake_case, so tools from several
  servers don't collide in one host.
- **`.describe()` every field** — the model reads these to decide what to pass.
  A test asserts this for every registered tool.
- **Inputs snake_case; outputs camelCase** — output field names match
  `@knorby/inkeedecoder-client` exactly, so `structuredContent` is a faithful
  view of the library's result with no translation layer to drift.
- **Annotations** — set `readOnlyHint`, `destructiveHint`, `idempotentHint`,
  and `openWorldHint` on every tool.
- **`outputSchema` + `structuredContent`** — typed, parseable results alongside
  the text block.
- **Errors are results, not throws** — return `content: [...], isError: true`
  with text that says what to do next. A thrown error becomes an opaque
  protocol error the model can't recover from.
- **Never write to stdout** — it carries the JSON-RPC stream. Use `logInfo` /
  `logWarn` / `logError` from `src/lib/log.ts` (all stderr).
- **Bound your responses** — paginate, and run both halves of a result through
  `applyCharacterLimit` (text) and `boundStructured` (structured content); the
  text tells the model when fields were shortened.
- **Honor cancellation** — pass `ctx.mcpReq.signal` into the client so a host
  cancelling a call stops the in-flight request.

## Testing

Four layers, cheapest first:

1. **In-process integration tests** (`tests/tools.test.ts`). `createMcpHandler`
   exposes the server as a web-standard `fetch` handler, so a real `Client`
   drives it with no port and no protocol mocks. `fetch` is stubbed with
   **real pages captured from the site** (`tests/fixtures/`), so the client's
   parsers run against the markup the site actually serves:

   ```ts
   const harness = await createTestClient();
   const result = await harness.client.callTool({
     name: "inkeedecoder_get_ingredient",
     arguments: { id: "squalane" },
   });
   expect(result.structuredContent).toMatchObject({ ourTake: "goodie" });
   ```

   Assert on `structuredContent`; failures resolve as results with
   `isError: true`. The same file covers link handling, response bounding,
   request spacing, timeouts, and cancellation.

2. **Configuration tests** (`tests/config.test.ts`). The environment contract:
   defaults, coercion, and the politeness floor for inkeedecoder.com.

3. **stdio spawn test** (`tests/stdio.test.ts`). Spawns the built binary via
   `StdioClientTransport` — the only way to catch a missing shebang or a stray
   `console.log`. It skips itself when `dist/` is absent, so a bare checkout
   can still run `npm test`.

4. **Inspector smoke test** (`npm run test:smoke`). Runs
   `mcp-inspector --cli --config inspector.config.json --server local --method tools/list`
   against `dist/`, in CI after the build.

## Releases

Published to npm as `@knorby/inkeedecoder-mcp` from GitHub Actions, with
[Changesets](https://github.com/changesets/changesets) and OIDC trusted
publishing — no npm tokens involved. Add a changeset (`npx changeset`) with any
change that affects published output; the release workflow opens a "Version
Packages" PR, and merging it publishes. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the release setup, including the manual
first publish.

## Documentation

- [`AGENTS.md`](AGENTS.md) — instructions and steering for AI coding agents.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development workflow, commit
  conventions, publishing.
- [`docs/`](docs/) — design notes, architecture, and decision records.
- [MCP TypeScript SDK v2 docs](https://ts.sdk.modelcontextprotocol.io/v2/) —
  the authoritative reference for the server API.

## License

[Apache-2.0](LICENSE) © Kali Norby ([@knorby](https://github.com/knorby))
