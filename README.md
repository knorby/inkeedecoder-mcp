# repo-template-typescript-mcp

A TypeScript starter for **local MCP (Model Context Protocol) servers** that
wrap an API or SDK library. Built on the MCP TypeScript SDK v2 (2026-07-28
spec), served over stdio, runnable with `npx`, and published to npm via
Changesets + OIDC trusted publishing.

<!-- TODO: Replace the project name above and the description with your own. -->

## What's included

- **`@modelcontextprotocol/server` v2** — `McpServer` with `registerTool`,
  `registerResource`, `registerPrompt`, and Zod-validated inputs.
- **stdio transport** — `src/index.ts` is the `bin` entry a host spawns; the
  server factory in `src/server.ts` is transport-agnostic, so an HTTP
  entrypoint can be added later without touching business logic.
- **Example server** — one connectivity tool, one API-wrapper tool showing the
  full pattern (pagination, `response_format`, `structuredContent`, lazy
  credentials, character limits), one resource, and one prompt.
- **Testing** — Vitest 5 with in-process integration tests that drive a real
  `Client` against your server (no sockets, no mocks), a stdio spawn test for
  the built binary, and an [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
  CLI smoke test in CI.
- **Inspector config** — `inspector.config.json` so `npm run inspect` connects
  to your server with zero setup.
- **`tsup`** — ESM-only bundle build; `tsc` emits declarations.
- **`Biome`** — single-tool linter + formatter (replaces ESLint + Prettier).
- **`Changesets`** — versioning and changelog management (decoupled from
  merges).
- **`Husky` + `lint-staged`** — pre-commit hooks for Biome.
- **`commitlint`** — enforces [conventional commits](https://www.conventionalcommits.org/).
- **`pre-commit`** — file hygiene (whitespace, EOL, YAML/JSON validation),
  secret scanning (gitleaks + TruffleHog), shellcheck, and
  `no-commit-to-branch` protection.
- **GitHub Actions** — CI runs lint, typecheck, build, test, the Inspector
  smoke test, and `npm audit`, plus the pre-commit suite. A release workflow
  (staged at `workflow-templates/release.yml`, inactive until moved into
  `.github/workflows/`) publishes via trusted publishing (OIDC — no npm
  tokens).
- **Security defaults** — `.npmrc` blocks dependency `postinstall` scripts,
  `package.json` ships with provenance attestation enabled, `files` whitelists
  only `dist/` + docs + `LICENSE`.

## Running it

With a host, after publishing:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "<your-package-name>"],
      "env": {
        "EXAMPLE_API_KEY": "..."
      }
    }
  }
}
```

From a local checkout, point at the built entrypoint instead:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/absolute/path/to/repo/dist/index.js"],
      "env": {
        "EXAMPLE_API_KEY": "..."
      }
    }
  }
}
```

Config file locations vary by host: `claude_desktop_config.json`,
`.cursor/mcp.json`, `.vscode/mcp.json`, or `claude mcp add` on the CLI. Secrets
come from the `env` block — the server never reads a `.env` file.

## Using this template

Delete or replace the scaffolding marked with `TODO(template)` comments:

1. `package.json` — `name`, `description`, and the `bin` key (the command users
   type after `npx`).
2. `src/constants.ts` — `SERVER_NAME` and `SERVER_VERSION`.
3. `src/config.ts` — the `EXAMPLE_*` environment variables your API needs.
4. `src/lib/http.ts` — swap `fetch` for your vendor SDK (this is the seam a
   wrapped library plugs into).
5. `src/tools/` — replace `example_ping` and `example_search_items` with real
   tools; delete `src/resources/info.ts` and `src/prompts/summarize.ts` if you
   don't need them.
6. `src/server.ts` — update the `register*` calls to match your tools.
7. `tests/` — replace the example tests with tests for your tools
   (`tests/helpers.ts` is reusable as-is).
8. `inspector.config.json` — rename the `local`/`dev` entries and set their
   `env` values.
9. `package.json` metadata — set `repository`, `author`, `bugs`, and `homepage`
   (provenance attestation requires `repository`); reset `version` and clear
   `CHANGELOG.md`.
10. `.github/CODEOWNERS` — your GitHub username; `LICENSE` — the copyright line.
11. Activate releases:
    `git mv workflow-templates/release.yml .github/workflows/release.yml`, then
    remove the now-empty `workflow-templates/` directory. See
    [Versioning and publishing](#versioning-and-publishing).
12. Optional: delete `docs/decisions/ADR-0001-*.md` (the template's own ADR) and
    this section.

## Prerequisites

- **Node.js 24+** (use [nvm](https://github.com/nvm-sh/nvm) or
  [fnm](https://github.com/Schniz/fnm); this repo includes an `.nvmrc`). The
  server runs on Node 22+; the Inspector needs 22.19+.
- **npm** (bundled with Node).
- **pre-commit** — `pipx install pre-commit` or `brew install pre-commit`.
- **gitleaks** — `brew install gitleaks` (secret scanner for pre-commit).
- **Go toolchain** — `brew install go` (required once for the TruffleHog hook
  build).

## Getting started

```bash
# 1. Clone the repo (or use it as a template on GitHub)
git clone <repo-url>
cd <repo-name>

# 2. Use the correct Node version
nvm use              # or: fnm use

# 3. Install dependencies
npm install

# 4. Set up Husky hooks (prepare script is blocked by .npmrc ignore-scripts)
npx husky

# 5. Install pre-commit hooks (file hygiene + secret scanning)
pre-commit install

# 6. Run all hooks against all files to verify
pre-commit run --all-files
```

The first `pre-commit run` installs all hook environments and builds
TruffleHog from source (a few minutes). Subsequent runs are cached and fast.

## Development

| Command | What it does |
| --- | --- |
| `npm run build` | Build the server (tsup bundle + `tsc` declarations) |
| `npm run dev` | Run the server from source with `tsx watch` (auto-restarts on change) |
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

The fastest loop is `npm run inspect` — it launches your server, lists its
tools, and lets you call them with arguments in a browser.

### Project structure

```
src/
  index.ts              # stdio entrypoint (`bin`) — serveStdio(createServer)
  server.ts             # createServer(): registers tools, resources, prompts
  config.ts             # lazy Zod-parsed environment config
  constants.ts          # server name/version, character limit, timeouts
  lib/
    http.ts             # fetch wrapper: timeouts, auth, typed API errors
    errors.ts           # error -> actionable tool message
    format.ts           # markdown/JSON formatting + truncation
    log.ts              # stderr-only logging
  tools/                # one file per tool domain
  resources/            # resource registrations
  prompts/              # prompt registrations
tests/
  helpers.ts            # in-process test client (createMcpHandler + Client)
  tools.test.ts         # integration tests through a real client
  stdio.test.ts         # spawns dist/index.js and calls tools over stdio
inspector.config.json   # MCP Inspector server config (read-only via --config)
dist/                   # build output (gitignored)
.changeset/             # changeset files (versioning)
.github/workflows/      # CI workflows
workflow-templates/     # staged workflows (inactive until moved into .github/workflows/)
docs/decisions/         # architecture decision records (ADRs)
```

## Writing tools

A tool is a name, a config, and an async handler:

```ts
server.registerTool(
  "myservice_search_items",
  {
    title: "Search items",
    description: "Search for items by title. Read-only. Returns a page of results.",
    inputSchema: z.object({
      query: z.string().min(2).describe("Search string matched against titles."),
      limit: z.number().int().min(1).max(100).default(20).describe("Max results (1-100)."),
    }),
    outputSchema: z.object({ total: z.number(), items: z.array(z.object({ id: z.string() })) }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ query, limit }) => {
    const output = await myApi.search(query, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output,
    };
  },
);
```

Conventions this template follows:

- **Naming** — `{service}_{action}` in snake_case (`github_create_issue`), so
  tools from several servers don't collide in one host.
- **`.describe()` every field** — the model reads these to decide what to pass.
- **Annotations** — set `readOnlyHint`, `destructiveHint`, `idempotentHint`,
  and `openWorldHint` on every tool.
- **`outputSchema` + `structuredContent`** — give clients typed, parseable
  results alongside the text block.
- **Errors are results, not throws** — return
  `content: [...], isError: true` with text that says what to do next. A thrown
  error becomes an opaque protocol error the model can't recover from.
- **Never validate credentials at startup** — read config when the tool runs, so
  a misconfigured server still answers `tools/list` and can explain itself.
- **Never write to stdout** — it carries the JSON-RPC stream. Use `logInfo` /
  `logWarn` / `logError` from `src/lib/log.ts` (all stderr).
- **Bound your responses** — paginate, and check `CHARACTER_LIMIT` before
  returning large payloads.

## Testing

Three layers, cheapest first:

1. **In-process integration tests** (`tests/tools.test.ts`). `createMcpHandler`
   exposes the server as a web-standard `fetch` handler, so a real `Client`
   drives it with no port and no protocol mocks:

   ```ts
   const harness = await createTestClient();
   const result = await harness.client.callTool({ name: "example_ping", arguments: {} });
   expect(result.structuredContent).toMatchObject({ ok: true });
   ```

   Assert on `structuredContent`; failures resolve as results with
   `isError: true`. Stub HTTP with `vi.stubGlobal("fetch", …)`.

2. **stdio spawn test** (`tests/stdio.test.ts`). Spawns the built binary via
   `StdioClientTransport` — the only way to catch a missing shebang or a stray
   `console.log`. It skips itself when `dist/` is absent, so a bare checkout can
   still run `npm test`.

3. **Inspector smoke test** (`npm run test:smoke`). Runs
   `mcp-inspector --cli --config inspector.config.json --server local --method tools/list`
   against `dist/`, in CI after the build.

For manual exploration, `npm run inspect` opens the Inspector web UI. The CLI
and TUI are also available: `npx @modelcontextprotocol/inspector --cli` and
`--tui`.

## Versioning and publishing

This repo uses [Changesets](https://github.com/changesets/changesets) for
versioning. Versioning is decoupled from merges — you can merge multiple PRs
and release them all at once.

### Adding a changeset

```bash
npx changeset
```

Select patch/minor/major, write a summary. Commit the generated
`.changeset/*.md` alongside your code.

### Releasing

The release workflow ships **staged** at `workflow-templates/release.yml` and
is inactive in this template (GitHub only runs workflows from
`.github/workflows/`). To enable it:

```bash
git mv workflow-templates/release.yml .github/workflows/release.yml
```

Once active, the flow is automated. The release workflow runs on every push to
`main`: with no pending changesets it is a no-op; with changesets, it opens a
"Version Packages" PR (`changeset version` bumps `package.json`, updates
`CHANGELOG.md`, and removes the consumed changesets). Merging that PR publishes
to npm, tags the release, and creates a GitHub Release. Publishing uses OIDC
trusted publishing — no npm tokens are stored as secrets, and `id-token: write`
is scoped to the publish job only.

For a manual release: `npx changeset version`, then `npm run release`.

#### One-time setup (trusted publishing)

1. Repo **Settings → Actions → General → Workflow permissions**: select
   **Read and write permissions**, and check **Allow GitHub Actions to
   create and approve pull requests**.
2. Repo **Settings → Environments**: create an environment named `release`.
3. On npmjs.com, add a trusted publisher for the package. Values must match
   exactly: this repository, workflow filename `release.yml`, environment
   `release`.
4. Enable npm 2FA: `npm profile enable-2fa auth-and-writes`.

#### First publish (manual)

npm requires a package to exist before it can link a trusted publisher, so the
very first publish is manual:

```bash
npm login
npm pkg delete publishConfig.provenance   # provenance needs CI + public repo
npm run release                           # build + changeset publish
npm pkg set publishConfig.provenance=true
git push origin main --follow-tags
gh release create vX.Y.Z --notes-from-tag
```

### Publishing security

- **Trusted publishing (OIDC)**: the release workflow publishes with an OIDC
  token minted by GitHub Actions — no npm tokens involved. This is compatible
  with 2FA (`npm profile enable-2fa auth-and-writes`).
- **Provenance**: publishes with provenance attestation (cryptographic link
  from package to commit + workflow). Requires a public repo and publishing
  from CI; the manual first publish temporarily disables it.
- **Scoped names**: use `@yourscope/package` to prevent dependency confusion;
  `publishConfig.access: "public"` is set because scoped packages default to
  restricted visibility.
- **`.npmrc`**: `ignore-scripts=true` blocks dependency `postinstall` scripts.
  This also blocks the `prepare` script, so run `npx husky` after
  `npm install` to set up hooks (or use
  `npm install --ignore-scripts=false`).

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## Customizing

- **Package name and command**: update `name` and the `bin` key in
  `package.json`.
- **Add an HTTP transport**: keep `createServer()` as-is and add an entrypoint
  using `@modelcontextprotocol/node`, `/express`, `/hono`, or `/fastify`.
- **Build targets**: adjust `tsup.config.ts` (entry points, target).
- **TypeScript config**: modify `tsconfig.json` (target, strictness). `module`
  and `moduleResolution` are `NodeNext`, so relative imports keep their `.js`
  extensions, and `"types": ["node"]` is required on TypeScript ≥ 6.
- **Biome rules**: edit `biome.json` (formatter style, linter rules).
- **Biome → ESLint + Prettier**: if you need a larger rule ecosystem, remove
  `@biomejs/biome` from devDependencies, install ESLint + Prettier +
  `eslint-config-prettier`, create `eslint.config.mjs` (flat config) and
  `.prettierrc`, and update the `lint-staged` config in `package.json`.
- **Branch protection**: `no-commit-to-branch` is a local guard only. Also
  enable GitHub branch protection rules on `main` (Settings → Branches).
- **CODEOWNERS**: update `.github/CODEOWNERS` with your GitHub username.

## Documentation

- [`AGENTS.md`](AGENTS.md) — instructions and steering for AI coding agents.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development workflow, commit
  conventions, publishing.
- [`docs/`](docs/) — design notes, architecture, and decision records.
- [MCP TypeScript SDK v2 docs](https://ts.sdk.modelcontextprotocol.io/v2/) —
  the authoritative reference for the server API.

## License

[Apache-2.0](LICENSE) © Kali Norby ([@knorby](https://github.com/knorby))

<!-- TODO: Add npm version / downloads / license badges once published. -->
