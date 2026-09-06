# ADR-0002: Wrap the client library instead of scraping in the server

- **Status:** Accepted
- **Date:** 2026-09-05

## Context

INKEEDecoder has no API: reading it means fetching HTML and parsing it. That
work already exists in
[`@knorby/inkeedecoder-client`](https://www.npmjs.com/package/@knorby/inkeedecoder-client),
which is deliberately multipurpose — it runs on Node, React Native, and
browsers, takes an injectable `fetch`, and exposes both a client and standalone
`parse*` functions.

This repo needs the same data in MCP shape. Two questions followed from that:

1. Does the server re-implement fetching and parsing (self-contained, but
   duplicated), or depend on the client?
2. The client accepts a slug, a site path, or any absolute URL, and normalizes
   all three to a path. It does **not** check which site a URL points at, nor
   whether the page is the kind of page the caller asked for. Since the site
   renamed itself from INCIDecoder to INKEEDecoder after a trademark dispute
   with PCPC (see [inkeedecoder.com/new-name](https://inkeedecoder.com/new-name)),
   a large body of existing links point at incidecoder.com and now redirect.
   Where should that be handled?

## Decision

1. **Depend on the client; add nothing that belongs in it.** This repo contains
   no `fetch` calls and no HTML parsing. The former template `src/lib/http.ts`
   was deleted. What remains is MCP-shaped: tool schemas and descriptions,
   annotations, identifier resolution, and response bounding. A tool that needs
   data the client does not expose is a client change, not a server change.
2. **Resolve ids in the server, in `src/lib/ids.ts`.** Every lookup tool passes
   its `id` through `resolveEntityId(id, expectedType)`, which:
   - allows only the four hosts `inkeedecoder.com`, `www.inkeedecoder.com`,
     `incidecoder.com`, `www.incidecoder.com`;
   - keeps only the path, so an old-domain link is fetched from the configured
     base URL and the old domain is never contacted;
   - checks the path's first segment against the entity type the tool reads,
     and on a mismatch returns an error naming the tool that *would* work.
   The client keeps its permissive behavior for non-MCP callers.
3. **Page-only pagination.** Tools expose `page` and never the client's
   `allPages`. Results carry `page`, `hasMore`, and `nextPageUrl` so the model
   can request the next page itself.
4. **Verbose sections are opt-in.** `long_descriptions`, `skim_table`,
   `tooltips`, `details`, and `proof` default off.
5. **Output field names mirror the client's types** (`ourTake`, `hasMore`,
   `nextPageUrl`), so `structuredContent` needs no translation layer.

## Consequences

- **One runtime dependency, one parser.** Site markup changes are fixed once,
  in the client; this repo only needs to keep its schemas in step with the
  client's types. A client field added without a schema update is dropped from
  `structuredContent` rather than widening the advertised contract.
- **Old links work, and fail loudly when wrong.** An incidecoder.com URL from
  an old chat transcript resolves; a link to another site, or an ingredient
  link passed to the product tool, becomes an actionable error instead of a
  mis-parsed page.
- **A page walk is the model's job, not one call's.** `allPages` would spend
  one request per page with a one-second politeness delay between them — tens
  of seconds inside a single tool call. Surfacing `hasMore` lets the model
  decide whether it needs more, and lets a host show incremental progress.
  Cost: enumerating a large brand catalogue takes several round trips.
- **The server is not portable the way the client is.** `resolveEntityId` uses
  `URL`, which is fine for a Node process and would need a replacement for the
  environments the client targets.
- **Follow-up:** if the client grows a URL-normalization helper that covers
  host rewriting, revisit `src/lib/ids.ts` to delegate to it; the MCP layer
  would keep only the entity-type check and the error messages.
