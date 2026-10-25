# Contributing

Thanks for contributing! This guide covers getting set up, the development
workflow, and how to publish releases.

## Prerequisites

- **Node.js 24+** (use [nvm](https://github.com/nvm-sh/nvm) or
  [fnm](https://github.com/Schniz/fnm); this repo includes an `.nvmrc`)
- **npm** (bundled with Node)
- **pre-commit** — `pipx install pre-commit` or `brew install pre-commit`
- **gitleaks** — `brew install gitleaks` (secret scanner for pre-commit)
- **Go toolchain** — `brew install go` (required once for the TruffleHog hook
  build)

## Getting started

```bash
git clone https://github.com/knorby/inkeedecoder-mcp.git
cd inkeedecoder-mcp
nvm use              # or: fnm use
npm install          # installs deps (prepare blocked by .npmrc ignore-scripts)
npx husky            # sets up Husky hooks (run after npm install)
pre-commit install   # sets up pre-commit hooks for file hygiene + secrets
```

## Development commands

| Command | What it does |
| --- | --- |
| `npm run build` | Build the server (tsup ESM bundle + `tsc` declarations) |
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

## Testing

Four layers, cheapest first:

1. **In-process integration tests** — `createTestClient()` in
   `tests/helpers.ts` serves the server through `createMcpHandler` and connects
   a real `Client`, so tests exercise registration and schema validation with no
   port and no protocol mocks. Assert on `structuredContent`; failures come back
   with `isError: true` instead of throwing.
2. **Configuration tests** — `tests/config.test.ts` covers the environment
   contract: defaults, coercion, and the politeness floor for inkeedecoder.com.
3. **stdio spawn test** — `tests/stdio.test.ts` runs the built binary through
   `StdioClientTransport`. It skips itself when `dist/` is absent, so run
   `npm run build` first to include it.
4. **Inspector smoke test** — `npm run test:smoke` lists tools through the
   Inspector CLI against `dist/`. CI runs this after the build.

Explore by hand with `npm run inspect` (web UI), or
`npx @modelcontextprotocol/inspector --cli` / `--tui`.

Never write to stdout in server code — it carries the JSON-RPC stream. Use
`logInfo`/`logWarn`/`logError` from `src/lib/log.ts`.

## Git hooks

This repo uses **two** git hook managers that complement each other:

1. **pre-commit** — file hygiene (whitespace, EOL, YAML/JSON validation),
   secret scanning (gitleaks + TruffleHog), and shellcheck. Enforces
   `no-commit-to-branch` to protect `main`/`master`.

2. **Husky** — TypeScript-specific checks on staged files:
   - `pre-commit`: runs `lint-staged` (Biome format + lint on staged files
     only)
   - `commit-msg`: runs `commitlint` to enforce
     [conventional commits](https://www.conventionalcommits.org/)

You need both for full coverage:
```bash
pre-commit install
npx husky   # prepare script is blocked by .npmrc ignore-scripts=true
```

## Commit messages

This repo enforces [conventional commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`,
`perf`, `ci`.

Examples:
```
feat(auth): add token refresh logic
fix: handle null response from API
docs: update README with publish instructions
```

## Versioning and releases

This repo uses [Changesets](https://github.com/changesets/changesets) for
versioning. Versioning is **decoupled from merges** — you can merge multiple
PRs and release them all at once.

### Adding a changeset

Every PR that changes published output should include a changeset:

```bash
npx changeset
```

Select the bump type (patch/minor/major) and write a short summary. A new
`.md` file appears in `.changeset/` — commit it alongside your code.

### Releasing

**Automated release (default):** `.github/workflows/release.yml` runs on every
push to `main`. The `select-mode` job inspects repo state and picks what
happens next:

- **changesets found** → the `version` job runs the `version` sub-action with
  `script: npm run version:packages` (`changeset version` plus the
  `server.json`/`manifest.json` sync) and opens or updates a "Version
  Packages" pull request. Merging that PR triggers the workflow again, landing
  in publish mode.
- **new version not yet on npm** (no changesets left) → the `pack` job builds
  and packs the npm package plus the `.mcpb` bundle; the `publish` job
  publishes to npm via OIDC, creates the git tag/GitHub Release, and attaches
  the bundle.
- **nothing to do** → all downstream jobs are skipped.

No release secrets are configured. The Version Packages PR is opened with the
workflow's built-in `GITHUB_TOKEN` (requires the repo setting "Allow GitHub
Actions to create and approve pull requests"); npm uses OIDC.

**Manual fallback:**

```bash
npm run version:packages   # changeset version + metadata sync
npm run release            # builds + publishes to npm
git push --follow-tags
```

**First publish (manual, required once):** npm requires a package to exist
before it can link a trusted publisher, so `@knorby/inkeedecoder-mcp` (0.1.0)
is published by hand before the workflow can take over:

```bash
npm login
npm pkg delete publishConfig.provenance   # provenance needs CI + a public repo
npm run build
npm pack --dry-run                        # confirm the file list first
npm run release                           # build + changeset publish
npm pkg set publishConfig.provenance=true
git push origin main --follow-tags
gh release create v0.1.0 --notes-from-tag
```

**One-time setup after the first publish (repository owner):**

1. Repo **Settings → Actions → General → Workflow permissions**: select
   **Read and write permissions** (the workflow scopes the token per job;
   no "Allow GitHub Actions to create and approve pull requests" setting is
   needed — this flow never opens a PR).
2. Repo **Settings → Environments**: create an environment named `release`.
3. On npmjs.com, add a **trusted publisher** for the package. Values must
   match the workflow exactly: this repository, workflow filename `release.yml`,
   environment `release`.
4. Enable npm 2FA: `npm profile enable-2fa auth-and-writes`.

**Manual release (fallback):**
```bash
npx changeset version                      # bumps package.json + CHANGELOG.md
npx tsx scripts/sync-metadata-version.ts   # keeps server.json/manifest.json in step
npm run release                            # builds + publishes to npm
git add . && git commit -m "chore: release" && git push
```

### Before publishing, always verify

```bash
npm run build
npm pack --dry-run    # verify only dist/, README.md, CHANGELOG.md, LICENSE, SKILL.md
```

## Publishing security

- **Trusted publishing (OIDC)** — the release workflow publishes with an OIDC
  token minted by GitHub Actions; there are no npm tokens (no `NPM_TOKEN`
  secret). Compatible with 2FA (`npm profile enable-2fa auth-and-writes`)
  because no token needs an OTP.
- **Provenance** — this repo publishes with provenance (cryptographic
  attestation linking the published package to the commit + workflow).
  Requires a public repo and publishing from CI; the manual first publish
  temporarily removes `publishConfig.provenance`.
- **Scoped name** — `@knorby/inkeedecoder-mcp` prevents dependency confusion;
  `publishConfig.access: "public"` is set because scoped packages default to
  restricted visibility.
- **No secrets in the package** — the `files` field in `package.json`
  whitelists only `dist`, `README.md`, `CHANGELOG.md`, and `LICENSE`.

## Pull request process

1. Create a branch from `main`.
2. Make your changes + add a changeset (`npx changeset`).
3. Ensure all checks pass: `npm run lint && npm run typecheck && npm test &&
   npm run build`.
4. Open a PR against `main`. CI runs lint, typecheck, build, test, and
   `npm audit`, plus the pre-commit suite (file hygiene + secret scanning).
5. After review, merge. Release separately via changesets.
