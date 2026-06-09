# lintscope

**A polished UI for your linter — runs in your browser, your code stays on your machine.**

[![npm](https://img.shields.io/npm/v/lintscope.svg)](https://www.npmjs.com/package/lintscope)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/aggmoulik/lintscope/blob/main/LICENSE)

```sh
npx lintscope studio
```

That's it — lintscope runs your project's linters (ESLint, Biome, oxlint) and opens a polished dashboard in your browser. Your code and diagnostics **never leave your machine**: the hosted UI only ever talks to a server on *your* `localhost`.

## Commands

```sh
lintscope studio [paths…]   # lint + open the dashboard (default; `scan` is an alias)
lintscope watch  [paths…]   # …and live-update on file changes
lintscope export [paths…]   # run once, emit a LintReport JSON (CI / piping) — no browser
lintscope init              # write a lintscope.config.json with the detected linter(s)
lintscope view --from <eslint|biome|oxc> [file]   # render lint JSON you already have
```

- **Multi-linter** — runs every linter your project configures and merges them into one dashboard, filterable per linter.
- **Runs *your* linter, *your* config** — spawns the linter installed in your project at its own version; no re-implementation.
- **Monorepo-aware** — `lintscope studio apps/web` finds the config at the repo root and scopes the run to that package.

Requires **Node.js 20+**.

## How it works

Shaped like [Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview): the CLI spawns a local HTTP server on `127.0.0.1` and opens a hosted, always-latest UI that calls back to it over an origin/CORS-gated handshake (with a DNS-rebinding guard). Browsers exempt `localhost` from mixed-content rules, so there's no TLS dance.

Full docs, the component registry, and source: **[github.com/aggmoulik/lintscope](https://github.com/aggmoulik/lintscope)**.

## License

MIT © [aggmoulik](https://github.com/aggmoulik)
