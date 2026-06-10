# lintscope

## 0.1.2

### Patch Changes

- [#17](https://github.com/aggmoulik/lintscope/pull/17) [`62948b7`](https://github.com/aggmoulik/lintscope/commit/62948b746569830daba0659289678aeb5306a29a) Thanks [@aggmoulik](https://github.com/aggmoulik)! - CLI fixes and dependency refresh:

  - `lintscope --version` now reports the real package version (it was hardcoded to 0.0.0). The version is baked in at build time from package.json via tsup `define`.
  - `commander` 13 → 14. Commander 15 was skipped on purpose: it requires Node ≥ 22.12, and lintscope supports Node 20.
  - `chokidar` 4 → 5 (ESM-only; lintscope already ships ESM).
  - `engines.node` is now `>=20.19`, chokidar 5's floor. Node 20.0–20.18 users get a clear engines error instead of a confusing runtime failure.

## 0.1.1

### Patch Changes

- [`cc8d598`](https://github.com/aggmoulik/lintscope/commit/cc8d59869f808de2dbaf8818f7c478fd0c8d3e63) Thanks [@aggmoulik](https://github.com/aggmoulik)! - Open the studio at the new hosted-UI domain (`lintscope.vercel.app`).

  `lintscope@0.1.0` opened `registry-seven-khaki.vercel.app/studio`; after the
  domain move that page redirects to the new origin, but the CLI's CORS allow-list
  (derived from the hosted-UI origin) still expected the old one — so the studio
  handshake failed. The CLI now targets the new origin directly. Also consolidates
  `DEFAULT_HOSTED_UI` + the allow-origin resolution into a shared `hosted-ui` module.

## 0.1.0

### Minor Changes

- [`bb90f81`](https://github.com/aggmoulik/lintscope/commit/bb90f8188f5553f0fb17cd20f2f3d6047e2a3022) Thanks [@aggmoulik](https://github.com/aggmoulik)! - First public release — **lintscope 0.1.0**.

  A local-first, framework-agnostic UI for your linter, shaped like Drizzle Studio: `lintscope studio` runs your project's linters and opens a hosted dashboard that only ever talks back to a server on your `localhost`.

  - **CLI**: `init` · `scan`/`studio` · `watch` · `view` · `export`, with monorepo `[paths…]` scoping.
  - **Runs your linters, your config**: spawns the project's installed ESLint / Biome / oxlint at their own versions and respects each config exactly.
  - **Multi-linter**: runs every configured linter in parallel and merges into one dashboard, tagged + filterable per linter.
  - **Clean studio URL**: a bare `/studio` URL (no tokens/ports in the address bar); the page discovers the local server via an origin/CORS-gated handshake + port probe, with a DNS-rebinding guard and Private Network Access handling.
  - **shadcn component registry** at `/r/[name].json` for embedding the dashboard pieces.
