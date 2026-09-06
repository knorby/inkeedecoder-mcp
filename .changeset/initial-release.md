---
"@knorby/inkeedecoder-mcp": minor
---

Initial release: an MCP server for INKEEDecoder (formerly INCIDecoder), wrapping `@knorby/inkeedecoder-client`.

Eight read-only tools: search products and ingredients by name, advanced product search (filter by ingredients a product must or must not contain), product and ingredient lookups, products containing an ingredient, brand catalogues, ingredient functions, and a configuration ping. Plus a `server://info` resource and an `analyze_ingredients` prompt.

Every lookup takes a slug, a site path, or a URL — including links from the former incidecoder.com, which are resolved through the current site. Results come one page at a time, and verbose sections (long writeups, skim tables, tooltips) are opt-in so a single product cannot flood a context window.
