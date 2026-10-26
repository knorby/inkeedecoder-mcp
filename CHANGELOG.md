# Changelog

## 0.2.1

### Patch Changes

- Remove the Smithery and Glama distribution channels (smithery.yaml, Dockerfile, .dockerignore) and the README registries section; distribution is npm, the Claude Desktop MCPB bundle, and the Official MCP Registry.

## 0.2.0

### Minor Changes

- 0f80051: Add SKILL.md usage recipes, Official MCP Registry metadata (server.json + mcpName), an MCPB bundle for one-click Claude Desktop installs, and Smithery/Glama compatibility files (smithery.yaml, Dockerfile). Also fixes all npm audit warnings, updates dev dependencies (Biome 2.6, MCP Inspector 2.12), and ratchets test coverage at ~99% statements/lines with Codecov reporting.

## 0.1.0

### Minor Changes

- Initial release: an MCP server for INKEEDecoder (formerly INCIDecoder), wrapping `@knorby/inkeedecoder-client`.

  Eight read-only tools: search products and ingredients by name, advanced product search (filter by the ingredients a product must or must not contain), product and ingredient lookups, products containing an ingredient, brand catalogues, ingredient functions, and a configuration ping. Plus a `server://info` resource and an `analyze_ingredients` prompt.

  Every lookup takes a slug, a site path, or a URL — including links from the former incidecoder.com, which are resolved through the current site. Results come one page at a time; verbose sections (long writeups, skim tables, tooltips) are opt-in; and responses are bounded in both their text and structured content. Requests are spaced per server and time out instead of hanging.

<!-- Changesets generates entries below this line. Do not edit manually. -->
