# ADR-0004: Distribution channels and registry metadata

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

Until now the server reached users one way: `npx @knorby/inkeedecoder-mcp`
configured by hand in a host's JSON. That works, but it makes the server
invisible to the directories people actually browse (the Official MCP
Registry, Smithery, Glama) and gives Claude Desktop users no one-click
install. Feedback from real usage also showed the tools were
self-explanatory but the multi-step flows (search-then-fetch, filtered
search, INCI decoding) were not — agents rediscovered them per session.

Distribution metadata has a versioning trap: `server.json` (Official MCP
Registry) and `manifest.json` (MCPB) each repeat the package name and
version, and a release that bumps `package.json` but not the copies fails
only at publish time — or worse, publishes stale metadata.

## Decision

1. **npm remains the artifact; registries carry metadata.** The npm package
   is the single published artifact. The Official MCP Registry is metadata
   only (`server.json` + `mcpName` in `package.json`); publishing to it is a
   documented manual step after each npm release (`mcp-publisher publish`).
2. **Claude Desktop gets an MCPB bundle**, built from a production-only
   staging tree by `scripts/pack-mcpb.sh` and attached to GitHub Releases by
   the release workflow. DevDependencies can never enter the bundle because
   the staging tree never contains them.
3. **Smithery and Glama are served by repo files** (`smithery.yaml`,
   `Dockerfile`) that their scanners read; no separate publishing step.
   Their formats move faster than this repo — verify current docs before
   changing those files.
4. **`package.json` is the single source of truth.** `tests/metadata.test.ts`
   pins every name/version relationship across `package.json`, `server.json`,
   and `manifest.json`, so drift fails the suite at PR time.
5. **Usage knowledge ships with the package** as `SKILL.md` (Agent Skills
   format): recipes for the action types users actually ask for, plus the
   etiquette rules. It rides in the npm tarball.

## Consequences

- A release is now: merge to main → changesets publishes to npm and creates
  the GitHub Release with the `.mcpb` attached → manual `mcp-publisher
  publish` for the Official Registry.
- Three metadata files must stay in lockstep; the metadata test makes that
  mechanical rather than a review duty.
- The MCPB staging approach doubles as the canonical "production install"
  recipe; the Dockerfile's final stage mirrors it.
