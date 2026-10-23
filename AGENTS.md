# AGENTS.md

Instructions and steering for AI coding agents working in this repository.

This is a **local MCP (Model Context Protocol) server** that exposes
[INKEEDecoder](https://inkeedecoder.com) — the cosmetic ingredient database
formerly known as INCIDecoder — to MCP hosts. It is a thin wrapper around the
[`@knorby/inkeedecoder-client`](https://www.npmjs.com/package/@knorby/inkeedecoder-client)
library, served over stdio, runnable with `npx`, and published to npm as
`@knorby/inkeedecoder-mcp` via Changesets + OIDC trusted publishing.

The client library is deliberately multipurpose and lives in its own repo
(`~/code/inkeedecoder-client`). **This repo does not parse HTML and does not
do HTTP** — the client owns both. What this repo adds is MCP-shaped:

- tool schemas, descriptions, and annotations
- identifier handling (slug / path / URL, including old incidecoder.com links)
- response bounding (page-by-page results, opt-in verbose sections)

Changes that belong in the parser or the HTTP layer belong in the client repo,
not here. Keep this file updated as conventions evolve.

---

## Setup

### System requirements

Before installing git hooks, ensure the following are available on the
system:

1. **Node.js 24 (LTS)** — use [nvm](https://github.com/nvm-sh/nvm) or
   [fnm](https://github.com/Schniz/fnm); this repo includes an `.nvmrc`.
2. **npm** — bundled with Node.
3. **pre-commit** — install via `pipx install pre-commit` or
   `brew install pre-commit`. Handles file hygiene + secret scanning.
4. **gitleaks** — install via `brew install gitleaks` or see
   <https://github.com/gitleaks/gitleaks>. The hook uses the
   system-installed binary (`gitleaks-system` hook ID) for lightweight
   regex-based secret scanning.
5. **Go toolchain** — required for the TruffleHog hook, which pre-commit
   builds from source in an isolated GOPATH on first run (slow; cached
   afterward). Install via `brew install go` or see <https://go.dev/dl/>.
6. **shellcheck** is **not** a system dependency — `shellcheck-py` ships its
   own bundled binary.

### Install dependencies and hooks

```bash
nvm use                  # or: fnm use
npm install              # installs deps (does NOT run prepare — see .npmrc)
npx husky                # set up Husky hooks (blocked by ignore-scripts)
pre-commit install       # wire pre-commit hooks into .git/hooks/
pre-commit run --all-files  # validate against the entire repo
```

`npm install` does **not** run the `prepare` script because `.npmrc` sets
`ignore-scripts=true` (supply-chain security — blocks dependency postinstall
scripts). Run `npx husky` separately to set up the Husky-managed hooks
(pre-commit → lint-staged, commit-msg → commitlint). `pre-commit install`
separately sets up the pre-commit-managed hooks (file hygiene + secret
scanning). Both are needed for full coverage.

### Adding and removing hooks

- **Prefer existing hooks.** Always check the pre-commit hooks index
  (<https://pre-commit.com/hooks.html>) and the featured repositories
  (<https://pre-commit.com/hooks.html#featured-hooks>) before writing a custom
  hook. Existing, maintained hooks are preferred over custom ones.
- **If no existing hook can satisfy a requirement**, flag this in your output
  and request input before adding a custom hook.
- **TypeScript linting/formatting** is handled by **Biome** via Husky +
  lint-staged (see `.husky/pre-commit`). Do not add a TS linter to
  `.pre-commit-config.yaml`; use Husky/lint-staged for that.
- **TruffleHog**: replaceable with another secret scanner if preferred. Both
  gitleaks and TruffleHog run in pre-commit. If CI-based secret scanning is
  also desired (e.g. to catch secrets when hooks are skipped), add a workflow
  in `.github/workflows/` and document it here.
- **Hook revisions** are pinned. Bump deliberately and review changelogs.
- Reference: <https://pre-commit.com/hooks.html>

---

## Development commands

| Command | What it does |
| --- | --- |
| `npm run build` | Build the server (tsup ESM bundle + `tsc --emitDeclarationOnly`) |
| `npm run dev` | Run the server from source with `tsx watch` |
| `npm run inspect` | Open the MCP Inspector web UI against the built server |
| `npm run inspect:cli` | Call `tools/list` through the Inspector CLI |
| `npm run test:smoke` | Inspector CLI smoke test against `dist/` (used by CI) |
| `npm run pack:mcpb` | Build the `.mcpb` bundle for Claude Desktop from a production-only staging tree |
| `npm run lint` | Lint + formatting check with Biome (read-only) |
| `npm run format` | Format with Biome (writes changes) |
| `npm run check` | Lint + format in one pass (writes changes) |
| `npm run typecheck` | Type-check `src/` + `tests/` with `tsc` (uses `tsconfig.test.json`, no emit) |
| `npm test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage reporting |
| `npx changeset` | Create a changeset (required for any change that affects published output) |

---

## Testing and CI

- Tests live in `tests/` and use **Vitest**. Add test files as
  `*.test.ts` alongside or under `tests/`.
- **Test through a real client.** `tests/helpers.ts` exposes
  `createTestClient()`, which serves the server in-process via
  `createMcpHandler` + `handler.fetch` and connects a real `Client` to it — no
  port, no socket, no protocol mocks. Prefer this over calling tool handlers
  directly; it exercises schema validation and registration the way a host
  does. Assert on `structuredContent`; failures resolve as results with
   `isError: true` rather than throwing. Stub HTTP with
   `vi.stubGlobal("fetch", …)`.
- **Test against real pages.** `tests/fixtures/` holds pages captured from
   inkeedecoder.com (Apache-2.0, same author — see
   `tests/fixtures/README.md`). `tests/tools.test.ts` routes stubbed requests
   to them by path, so the real client and its parsers run against the markup
   the site actually serves. Add a fixture rather than hand-writing HTML, and
   treat the captures as read-only: Biome and the pre-commit whitespace hooks
   exclude `tests/fixtures/`, and rewriting a capture makes it a worse test
   input.
- **Keep the suite fast: test against a mirror, not the site.** `tools.test.ts`
  sets `INKEEDECODER_BASE_URL` to a fixture mirror with
  `INKEEDECODER_REQUEST_INTERVAL_MS=0` for every test (the politeness floor
  only applies to inkeedecoder.com), and restores the environment afterwards
  so the stdio test's child process sees the defaults. A dedicated
  `request control` suite covers spacing (with a raised interval), timeouts,
  and cancellation; `tests/config.test.ts` covers the environment contract
  itself.
- **Cover stdio by spawning the process.** `tests/stdio.test.ts` runs the built
  binary through `StdioClientTransport` and skips itself when `dist/` is absent.
- **Inspect manually with** `npm run inspect` (web UI) or
  `npm run inspect:cli` (scriptable `tools/list`).
- **GitHub Actions** runs the full check suite on every push to `main` and on
  PRs against `main` (see `.github/workflows/tests.yml`):
  - `npm run lint` (Biome — lint + formatting; formatting is enforced in CI,
    so run `npm run check` before committing if hooks are skipped)
  - `npm run typecheck` (tsc, src + tests)
  - `npm run build` (tsup)
  - `npm test` (Vitest)
  - `npm run test:smoke` (MCP Inspector CLI `tools/list` against `dist/`)
  - `npm audit --audit-level=moderate` (vulnerability scan)
- The **pre-commit suite** (file hygiene + secret scanning) also runs in CI
  via `.github/workflows/pre-commit.yml` on every push to `main` and PRs
  against `main` (`pre-commit run --all-files --show-diff-on-failure` with
  `SKIP=no-commit-to-branch`, which would otherwise always fail on main pushes
  by design). The workflow installs a system gitleaks binary matching the rev
  in `.pre-commit-config.yaml`; the trufflehog golang hook uses the Go
  toolchain preinstalled on ubuntu-latest.
- Husky hooks (Biome + commitlint) remain local only.
- Optional security scanning additions (free for public repos): CodeQL
  (<https://github.com/github/codeql-action>), gitleaks-action
  (<https://github.com/gitleaks/gitleaks-action>), Semgrep
  (<https://github.com/returntocorp/semgrep-action>). Add workflows in
  `.github/workflows/` if desired and document them here.

---

## Versioning and publishing

This repo uses [Changesets](https://github.com/changesets/changesets) for
versioning. Versioning is **decoupled from merges** — you can merge multiple
PRs and release them all at once.

- **Before a PR that changes published output**: run `npx changeset`, select
  bump type (patch/minor/major), write a summary. Commit the generated
  `.changeset/*.md` file alongside the code change.
- **To release**: `npx changeset version` (bumps `package.json` +
  `CHANGELOG.md`), then `npm run release` (builds + publishes).
- **GitHub Actions release** (`.github/workflows/release.yml`): runs on every
  push to `main` (and via `workflow_dispatch`, e.g. to retry after a transient
  publish failure). With no pending changesets it is a no-op. With changesets,
  it opens a "Version Packages" PR (`changeset version` bumps the version
  string, updates `CHANGELOG.md`, and removes consumed changesets); merging
  that PR publishes to npm, tags, and creates a GitHub Release. Publishing
  uses OIDC trusted publishing — no npm token secrets are involved.
  Permissions follow the changesets v2 sub-action split (`select-mode` →
  `version` | `pack` → `publish`); `id-token: write` is scoped to the publish
  job only.
- **Always verify before publishing**: `npm run build && npm pack --dry-run`
  to confirm only `dist/`, `README.md`, `CHANGELOG.md`, `LICENSE`, and
  `SKILL.md` are included.

### Distribution metadata

Repo-root `server.json` (Official MCP Registry), `manifest.json` (MCPB for
Claude Desktop), `smithery.yaml` (Smithery), and the `Dockerfile` (Smithery
container / Glama) repeat name and version values from `package.json`.
`tests/metadata.test.ts` pins every relationship — a version bump that
misses one of them fails the suite. `package.json` also carries `mcpName`
(`io.github.knorby/inkeedecoder-mcp`), the registry's ownership marker.

After each npm release:

- the release workflow attaches the `.mcpb` bundle to the GitHub Release;
- publishing to the Official MCP Registry is manual: `mcp-publisher login
  github` once, then `mcp-publisher validate && mcp-publisher publish` from
  the repo root (see `docs/publishing-registries.md`);
- Smithery and Glama pick the repo up from their scanners — no publish step,
  but re-check their current docs before editing `smithery.yaml` or the
  `Dockerfile`.

### One-time release setup (repository owner)

Required **after** the manual first publish — the trusted publisher needs the
package to exist on npm first
([npm/cli#8544](https://github.com/npm/cli/issues/8544)).

1. Repo **Settings → Actions → General → Workflow permissions**: select **Read
   and write permissions**, and check **Allow GitHub Actions to create and
   approve pull requests**.
2. Repo **Settings → Environments**: create an environment named `release`.
3. On npmjs.com, add a **trusted publisher** for the package. Values must
   match the workflow exactly: this repository, workflow filename
   `release.yml`, environment `release`.
4. Enable npm 2FA: `npm profile enable-2fa auth-and-writes`.

### First publish (manual)

npm requires a package to exist before it can link a trusted publisher
([npm/cli#8544](https://github.com/npm/cli/issues/8544)), so the very first
publish is manual:

```bash
npm login
npm pkg delete publishConfig.provenance   # provenance needs CI + public repo
npm run build
npm pack --dry-run                        # confirm the file list first
npm run release                           # build + changeset publish
npm pkg set publishConfig.provenance=true
git push origin main --follow-tags
gh release create v0.1.0 --notes-from-tag
```

### Release failure quick reference

| Symptom | Likely cause / fix |
| --- | --- |
| `EOTP` errors | A token is being used on a 2FA-enabled account — trusted publishing (no token) avoids this |
| `ENEEDAUTH` / 401 on publish | npm < 11.5.1 (the workflow upgrades npm), or the trusted-publisher config on npmjs.com does not match exactly (repo, workflow filename, environment) |
| "not permitted to create pull requests" | Enable "Allow GitHub Actions to create and approve pull requests" in Actions settings |
| Provenance warning `provider: null` | Published locally instead of via CI — provenance only works from CI on a public repo |
| 404 "package not found" right after publishing | npm registry replication lag — retry in a minute |

### Publishing security

- **Trusted publishing (OIDC)** — the release workflow publishes with an OIDC
  token minted by GitHub Actions; there are no npm tokens involved (no
  `NPM_TOKEN` or `NODE_AUTH_TOKEN` secrets). The npm-side trusted-publisher
  config must match the workflow exactly. This is compatible with 2FA
  (`npm profile enable-2fa auth-and-writes`) because no token needs an OTP.
- **Provenance** — `publishConfig.provenance: true` in `package.json` enables
  npm provenance attestation (cryptographic link to commit + workflow).
  Provenance requires publishing from CI on a **public** repository; the
  manual first publish temporarily removes it (see "First publish").
- **Scoped names** — use `@knorby/package`-style scoped names to prevent
  dependency confusion attacks. Scoped packages default to restricted
  visibility, so `publishConfig.access: "public"` is set.
- **No secrets in published files** — the `files` field in `package.json`
  whitelists only `dist`, `README.md`, `CHANGELOG.md`, and `LICENSE`. Never
  add `src/`, `.env`, `tsconfig.json`, or other config to the `files` list.
- **`.npmrc`** — `ignore-scripts=true` blocks dependency `postinstall`
  scripts by default (supply-chain security). This also blocks this repo's
  own `prepare` script, so `npm install` will not auto-set-up Husky hooks —
  run `npx husky` after `npm install`, or use
  `npm install --ignore-scripts=false` to allow the prepare script.

---

## Guardrails and steering rules

These rules are mandatory. Follow them strictly.

### Git operations

- Do **not** perform git write operations — `commit`, `push`, `amend`, `tag`,
  create PRs — unless explicitly asked by the user.

### File removal

- `rm` is intentionally blocked in this environment. Do **not** attempt to
  bypass this restriction (no `find -delete`, `python -c "os.remove(...)"`,
  shell tricks, or alternative deletion methods).
- Use `git rm` for tracked files that need removal.
- If untracked files need removal, or if your action is required to remove
  something, **stop** and flag what needs to be removed and why in your output.

### MCP server rules

- **Never write to stdout.** In a stdio server stdout carries the JSON-RPC
  stream; one `console.log` corrupts it and breaks the host connection. Use
  `logInfo`, `logWarn`, and `logError` from `src/lib/log.ts` (all stderr).
- **Keep `createServer()` transport-agnostic.** Tool, resource, and prompt
  registration lives in `src/server.ts`; transports live in entrypoints. Adding
  HTTP means adding an entrypoint, not moving business logic.
- **Register with the modern API only** — `registerTool`, `registerResource`,
  `registerPrompt`. Never `server.tool()` or raw `setRequestHandler` calls.
- **Name tools `{service}_{action}`** in snake_case so tools from several
  servers don't collide in one host.
- **`.describe()` every input field**, and set `title`, `description`,
  `inputSchema`, `outputSchema`, and `annotations` on every tool.
- **Return errors as results** — `content` + `isError: true` with text saying
  what to do next. Never let an exception escape a tool handler.
- **Validate credentials lazily**, inside the tool, so a misconfigured server
  still answers `tools/list`.
- **Bound responses** — paginate large collections, and run both halves of a
  result through `applyCharacterLimit` (text) and `boundStructured`
  (structured content) before returning; the text tells the model when fields
  were shortened.
- **Never hardcode the advertised version** — `SERVER_VERSION` is read from
  `package.json` at load in `src/constants.ts`, so a version bump cannot leave
  hosts seeing a stale number.
- **Add a changeset for anything that changes published output.**

### INKEEDecoder-specific rules

- **The client owns HTTP and parsing.** No `fetch` calls and no HTML handling
  in this repo — if a tool needs data the client does not expose, the change
  belongs in `~/code/inkeedecoder-client`, not here.
- **Page-only pagination.** Tools expose `page` and never the client's
  `allPages`: one page per call, with `hasMore`/`page`/`nextPageUrl` in the
  output so the model can ask for the next one. A page walk costs a request
  per page at a one-second politeness interval, which is far too slow to hide
  behind a single tool call.
- **Inputs snake_case; outputs camelCase.** Output field names mirror the
  client's types exactly (`ourTake`, `hasMore`, `nextPageUrl`), so
  `structuredContent` needs no translation layer and cannot drift from the
  library.
- **Resolve ids through `src/lib/ids.ts`.** Every lookup tool takes an `id` and
  must pass it through `resolveEntityId(id, expectedType)`, which validates
  the host (inkeedecoder.com and incidecoder.com), the entity type, and the
  `/<type>/<slug>` shape — dot segments and extra path segments are rejected
  because URL normalization would otherwise collapse them before the fetch.
  Never hand a raw model-supplied string to the client.
- **Forward cancellation and keep timeouts.** Tool handlers take
  `(args, ctx)` and pass `ctx.mcpReq.signal` into every client call, so a host
  cancelling a call stops the in-flight request; `INKEEDECODER_TIMEOUT_MS`
  bounds requests that hang.
- **Verbose sections stay opt-in.** `long_descriptions`, `skim_table`,
  `tooltips`, `details`, and `proof` default off; a single product's writeups
  can fill a context window.
- **Be a good citizen of the site.** Config enforces the default interval as a
  floor for inkeedecoder.com and incidecoder.com (lower values are only for
  mirrors), and the server shares one cached client per configuration so
  requests are spaced across tool calls, not just within one. Read only the
  robots-allowed paths this server uses, and do not republish the site's prose
  verbatim — summarize and cite the URL.

### Documentation

- Keep `AGENTS.md` and `README.md` up to date as part of any change that
  affects setup, conventions, or project structure.
- Use the `docs/` directory for higher-level design notes, architecture, and
  decision records (ADRs). See `docs/README.md` for the ADR template.
- Treat `docs/` as living documentation. Create an ADR in `docs/decisions/`
  for significant design decisions.

### Before declaring done

- Run all quality gates:
  ```bash
  npm run lint && npm run typecheck && npm test && npm run build && npm run test:smoke
  ```
  (`npm test` must run after `npm run build` at least once — `tests/stdio.test.ts`
  skips itself when `dist/` is missing.)
- Verify that `npm pack --dry-run` includes only `dist/`, `README.md`,
  `CHANGELOG.md`, and `LICENSE` (no source, config, or secret files).
- Verify the built server starts without writing to stdout:
  `echo '{}' | node dist/index.js` should produce only a stderr banner (or
  nothing), never stdout output.
- Verify that `AGENTS.md` and `README.md` still reflect the current state of
  the repository.
