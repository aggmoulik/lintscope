<div align="center">

# lintscope

**A polished UI for your linter — runs in your browser, data stays on your machine.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Status: pre-alpha](https://img.shields.io/badge/Status-pre--alpha-orange.svg)](#status)

</div>

---

## Why

ESLint, Biome, and oxlint all emit JSON — but the only tools that visualize their output are:

- The terminal (`stylish`, `pretty`, `compact`) — fine for a handful of issues, painful for monorepos.
- IDE Problems panes — not shareable, not designed for triage at scale.
- SaaS dashboards (SonarQube, Codacy, DeepSource) — heavyweight, hosted, your code leaves your machine.

There is no local-first, framework-agnostic, polished web UI for browsing lint output across linters. **lintscope** is that.

## How it works

lintscope is shaped like [Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview):

```sh
npx lintscope studio
```

- The CLI runs your linter and spawns a **local HTTP server** on a random free port.
- Your browser opens to **`https://lintscope.dev/studio?host=localhost&port=<PORT>&token=<UUID>`**.
- The hosted page makes plain `http://localhost:<PORT>` REST calls back to that local server.
  This is allowed because browsers exempt `localhost` from mixed-content rules ([Secure Contexts spec](https://www.w3.org/TR/secure-contexts/#localhost)) — no TLS cert dance.
- Watch mode uses a Server-Sent Events stream at `GET /events` for push updates.
- The hosted UI is **always-latest** — no CLI republishes needed for UI improvements.
- Your code and your diagnostics **never leave your machine** — the studio page only ever talks to your local CLI.

You also get a **shadcn-compatible component registry** for embedding pieces of the UI in your own dashboards:

```sh
npx shadcn add https://lintscope.dev/r/diagnostic-list.json
```

Components include `<DiagnosticList />`, `<DiagnosticCard />`, `<SeverityBadge />`, `<LintDashboard />`, with `<FileTree />`, `<RuleSummary />`, and `<DiffPreview />` landing in v1.0.

## Linter support

| Linter | Status | Notes |
|---|---|---|
| ESLint | Phase 1 (scaffold complete) | Flat config + legacy config, Node API |
| Biome | Phase 3 | `biome check --reporter=json` |
| OXC / oxlint | Phase 4 | Defensive parsing — format still drifting |
| tsc / typescript-eslint | Phase 5+ | Type errors as diagnostics |
| Stylelint | Phase 5+ | Easy adapter once core is solid |

## Architecture

Monorepo. pnpm + Turborepo.

```
apps/
  registry       Next.js 15 site at lintscope.dev
                 · landing + MDX docs
                 · /r/[name].json registry
                 · /studio (the hosted dashboard UI)
packages/
  cli            Commander CLI: init | studio | scan | watch | serve | export
  studio-server  Lint-agnostic framework: HTTP + CORS + token + SSE + browser-open.
                 Designed for standalone publish post-v1.0 (the Drizzle-Studio
                 pattern as a reusable library — no equivalent exists today).
  api-schema     Zod request/response + SSE payload schemas (CLI ↔ /studio page)
  core           Linter adapters + normalization + watching
  ui             Source-of-truth React components (the registry serves these)
  schema         Zod Diagnostic + LintReport types
  tsconfig       Shared tsconfig bases
fixture/         Sample lintable project for CLI integration tests
```

## Status

**Pre-alpha.** Phase 1 foundation (schema · core · components · registry) is scaffolded. Phase 2 (CLI + `/studio`) is next. Building in public — follow along at [github.com/aggmoulik/lintscope](https://github.com/aggmoulik/lintscope).

## License

MIT © [aggmoulik](https://github.com/aggmoulik)
