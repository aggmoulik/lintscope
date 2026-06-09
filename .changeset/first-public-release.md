---
"lintscope": minor
---

First public release — **lintscope 0.1.0**.

A local-first, framework-agnostic UI for your linter, shaped like Drizzle Studio: `lintscope studio` runs your project's linters and opens a hosted dashboard that only ever talks back to a server on your `localhost`.

- **CLI**: `init` · `scan`/`studio` · `watch` · `view` · `export`, with monorepo `[paths…]` scoping.
- **Runs your linters, your config**: spawns the project's installed ESLint / Biome / oxlint at their own versions and respects each config exactly.
- **Multi-linter**: runs every configured linter in parallel and merges into one dashboard, tagged + filterable per linter.
- **Clean studio URL**: a bare `/studio` URL (no tokens/ports in the address bar); the page discovers the local server via an origin/CORS-gated handshake + port probe, with a DNS-rebinding guard and Private Network Access handling.
- **shadcn component registry** at `/r/[name].json` for embedding the dashboard pieces.
