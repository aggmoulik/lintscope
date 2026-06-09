<div align="center">

# lintscope

**A polished UI for your linter — runs in your browser, your code stays on your machine.**

[![npm](https://img.shields.io/npm/v/lintscope.svg)](https://www.npmjs.com/package/lintscope)
[![CI](https://github.com/aggmoulik/lintscope/actions/workflows/ci.yml/badge.svg)](https://github.com/aggmoulik/lintscope/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

</div>

---

```sh
npx lintscope studio
```

That's it — lintscope runs your project's linters and opens a polished dashboard in your browser. Your code and diagnostics **never leave your machine**.

## Why

ESLint, Biome, and oxlint all emit JSON — but the only ways to *see* their output are:

- The terminal — fine for a handful of issues, painful for monorepos.
- IDE Problems panes — not shareable, not built for triage at scale.
- SaaS dashboards (SonarQube, Codacy, …) — heavyweight, hosted, your code leaves your machine.

There's no local-first, framework-agnostic, polished web UI for browsing lint output across linters. **lintscope** is that.

## Highlights

- 🔒 **Local-first** — the dashboard is hosted, but it only ever talks to a server on *your* `localhost`. No code, no diagnostics, no third parties.
- 🧩 **Multi-linter** — runs **every** linter your project configures (ESLint + Biome + oxlint) in parallel and merges them into one dashboard, tagged + filterable per linter.
- 🎯 **Runs your linter, your config** — spawns the linter installed in your project at its own version and respects your config exactly (no re-implementation).
- 🗂️ **Monorepo-aware** — `lintscope studio apps/web` finds the config at the repo root and scopes the run to that package.
- ⚡ **Fast** — virtualized list stays at 60fps even at 100k diagnostics.
- 🪄 **Clean URL** — the studio opens a bare `registry-seven-khaki.vercel.app/studio` (no tokens/ports in the address bar); the page discovers your local server itself.

## How it works

lintscope is shaped like [Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview):

- `lintscope studio` runs your linters and spawns a **local HTTP server** on `127.0.0.1`.
- Your browser opens to **`https://registry-seven-khaki.vercel.app/studio`** — a hosted, always-latest UI.
- That page makes plain `http://127.0.0.1:<port>` calls back to your local server. Browsers exempt `localhost` from mixed-content rules ([Secure Contexts spec](https://www.w3.org/TR/secure-contexts/#localhost)) — no TLS dance.
- The session token is fetched over an **origin- and CORS-gated handshake** (never in the URL); a **DNS-rebinding guard** + Private Network Access handling keep the local server locked to the real UI.
- Watch mode pushes updates over Server-Sent Events. The hosted UI is always-latest — UI improvements ship without a CLI republish.

## Commands

```sh
lintscope studio [paths…]   # lint + open the dashboard (default; `scan` is an alias)
lintscope watch  [paths…]   # …and live-update on file changes
lintscope export [paths…]   # run once, emit a LintReport JSON (CI / piping) — no browser
lintscope init              # write a lintscope.config.json with the detected linter(s)
```

### View results you already have

Already running a linter in CI or locally? Pipe its JSON straight in — lintscope never spawns the linter, you do:

```sh
eslint -f json . | npx lintscope view --from eslint
biome lint --reporter=json . | npx lintscope view --from biome
oxlint --format=json . | npx lintscope view --from oxc
```

## Component registry (shadcn)

The dashboard is built from a **shadcn-compatible registry** — drop pieces into your own internal tools:

```sh
npx shadcn add https://registry-seven-khaki.vercel.app/r/diagnostic-list.json
```

Components: `<DiagnosticList />`, `<DiagnosticCard />`, `<SeverityBadge />`, `<LinterBadge />`, `<FileTree />`, `<RuleSummary />`, `<DiffPreview />`, `<CommandPalette />`, `<LintDashboard />`. They consume the `Diagnostic` type from `@lintscope/schema`.

## Linter support

| Linter | Status | How |
|---|---|---|
| ESLint | ✅ | `eslint --format json` (flat + legacy config) |
| Biome | ✅ | `biome lint --reporter=json` (lint-only) |
| OXC / oxlint | ✅ | `oxlint --format=json` (defensive parsing) |
| tsc / typescript-eslint | planned | type errors as diagnostics |
| Stylelint | planned | |

## Architecture

pnpm + Turborepo monorepo:

```
apps/registry        Next.js site at registry-seven-khaki.vercel.app (landing · /r registry · /studio)
packages/cli         Commander CLI: init · scan · studio · watch · view · export
packages/studio-server  Lint-AGNOSTIC transport (HTTP + CORS + token + handshake + SSE).
                        Extract candidate post-v1.0 — no equivalent framework exists today.
packages/api-schema  Zod request/response + SSE schemas (CLI ↔ /studio page)
packages/core        Linter adapters + normalization + watching
packages/ui          Source-of-truth React components (the registry serves these)
packages/schema      Zod Diagnostic + LintReport (schemaVersion 1.0)
```

## Status

**v0.1 — early but usable.** Building in public — follow along and contribute at
[github.com/aggmoulik/lintscope](https://github.com/aggmoulik/lintscope). See
[CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

## License

MIT © [aggmoulik](https://github.com/aggmoulik)
