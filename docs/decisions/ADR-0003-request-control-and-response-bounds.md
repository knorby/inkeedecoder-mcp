# ADR-0003: Request control and response bounds

- **Status:** Accepted
- **Date:** 2026-10-18

## Context

Reviewing the server before its first release surfaced three gaps where a
documented promise was not actually kept:

1. **`structuredContent` was unbounded.** The text block went through
   `applyCharacterLimit`, but the structured half returned the client's record
   untouched. With every verbose section enabled, the captured product fixture
   alone serialized to ~26,000 characters — above the 25,000-character limit —
   and larger pages were not limited at all.
2. **The politeness interval did not space tool calls.** The client applied
   `requestIntervalMs` only while walking `allPages`, which this server never
   enables. Two consecutive tool calls therefore hit the site ~24 ms apart
   under a nominal 1,000 ms setting, and the README's spacing promise was
   false.
3. **Dot segments bypassed id validation.** `resolveEntityId` checked only the
   first path segment, so `/products/../ingredients/squalane` passed the
   product-tool check; URL normalization at fetch time then collapsed it into
   an ingredient page, which the product tool mis-parsed.

Requests also had no timeout and no way to be cancelled.

## Decision

1. **Bound both halves of a result.** Text is truncated by
   `applyCharacterLimit`; structured content goes through `boundStructured`,
   which tries progressively tighter string-length and array-size caps until
   the serialized value fits, marking shortened strings with `…[truncated]`.
   Bounding never drops fields or changes types, so `outputSchema` stays
   valid, and the text block reports when fields were shortened.
2. **Spacing belongs to the client library.** `@knorby/inkeedecoder-client`
   now spaces *every* request it makes through a per-instance scheduler, and
   accepts a `timeoutMs` option plus a per-call `AbortSignal` (released as
   0.3.0). The client is multipurpose — "space requests to the site" was
   always its job; it was just incomplete.
3. **The server shares one client per configuration.** `getClient()` caches
   the client keyed by base URL, interval, and timeout. Sharing the instance
   is what makes spacing real across separate tool calls.
4. **Cancellation and timeouts flow through.** Every tool handler receives
   `ctx` and passes `ctx.mcpReq.signal` into the client call, so a host
   cancelling a call stops the in-flight request. `INKEEDECODER_TIMEOUT_MS`
   (default 30,000; `0` disables) bounds requests that hang, and
   `toUserMessage` maps cancellation and timeouts to text the model can act
   on.
5. **Id resolution is strict about shape.** A path must be exactly
   `/<type>/<slug>`. Dot segments (raw or percent-encoded) and extra path
   segments are rejected before any request, because URL normalization would
   otherwise collapse them between validation and fetch.
6. **The politeness floor applies to the site, not to mirrors.** Config
   rejects an `INKEEDECODER_REQUEST_INTERVAL_MS` below the default when the
   base URL is inkeedecoder.com or incidecoder.com, and allows lower values
   for mirrors and archives. The tool tests therefore run against a fixture
   mirror with pacing off.

## Consequences

- **Nothing is silently cut, and nothing is silently fetched.** A shortened
  result says so in its text; a suspicious id is an error naming what to pass
  instead. Both were review findings with reproduction; both now have direct
  tests (an all-verbose product must serialize to ≤ 25,000 characters, and
  traversal paths must fetch nothing).
- **The client dependency moves to `^0.3.0`.** The signal/timeout/scheduler
  work is unreleased until the client's 0.3.0 ships; the MCP's lockfile must
  be refreshed (`npm install`) after that release, before CI installs work.
- **Spacing is per client instance, not global.** A library cannot space
  requests it does not make; the MCP does its part by sharing one client.
  Other consumers of the client get the same behavior for their own calls.
- **Tests can assert timing safely.** Request control is tested with explicit
  small numbers (a 250 ms interval must delay the second call; a 50 ms
  timeout must fail a hanging request), so the suite stays fast while the
  behavior stays pinned.
- **`INKEEDECODER_MAX_PAGES` is gone.** It existed for the client's
  `allPages` walk, which this server never uses (see ADR-0002).
