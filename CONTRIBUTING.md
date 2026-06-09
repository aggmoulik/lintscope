# Contributing to lintscope

Thanks for your interest! lintscope is a local-first, framework-agnostic UI for your linter. This guide covers how to get set up and land a change.

## Prerequisites
- **Node.js 20+**
- **pnpm 10** (`corepack enable` then `corepack prepare pnpm@10 --activate`)

## Setup
```sh
git clone https://github.com/aggmoulik/lintscope
cd lintscope
pnpm install
```

## Common commands
| Command | What it does |
|---|---|
| `pnpm dev` | Run the registry site (Next.js, :3000) — also serves `/studio` |
| `pnpm test` | Vitest across every package |
| `pnpm typecheck` | `tsc --noEmit` across the graph |
| `pnpm lint` | Biome (we dogfood it) — `pnpm lint:fix` to auto-fix |
| `pnpm build` | Build all packages (turbo) |
| `pnpm ui:add <name>` | Add a shadcn primitive to `packages/ui` |

Try the CLI against the bundled fixture:
```sh
pnpm build
cd fixture && node ../packages/cli/dist/lintscope.js studio --dev
```

## Monorepo layout
```
apps/registry        Next.js site at lintscope.vercel.app (landing · /r registry · /studio)
packages/cli         Commander CLI: init · scan · studio · watch · view · export
packages/studio-server  Lint-AGNOSTIC transport (HTTP + CORS + token + handshake + SSE). No @lintscope/* imports.
packages/api-schema  Zod request/response + SSE schemas (CLI ↔ /studio page)
packages/core        Linter adapters (eslint · biome · oxc) + normalization
packages/ui          Source-of-truth React components (the registry serves these)
packages/schema      Zod Diagnostic + LintReport (schemaVersion 1.0)
```

## Ground rules
- **Branch off `main`** with a descriptive name: `feat/…`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`, `test/…`.
- **Tests first.** Add or update Vitest tests with every code change; adapter tests use captured real linter output, not hand-written mocks.
- **`packages/schema` is the source of truth** for `Diagnostic`/`LintReport` — never re-declare those shapes elsewhere; validate adapter output against the Zod schema at the boundary.
- **`packages/studio-server` stays lint-agnostic** — zero imports of any other `@lintscope/*` package (it's designed to be extracted post-v1.0).
- **Always parse a linter's structured JSON** (`--format json` / `--reporter=json`) — never regex its human-readable stdout.
- Keep `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` green before opening a PR.

## Adding a changeset
Any user-facing change needs a changeset so it lands in the changelog + release:
```sh
pnpm changeset
```
Pick the affected packages and a bump (patch/minor/major), and write a short note.

## Pull requests
- One focused change per PR; fill out the PR template.
- CI must be green (lint · typecheck · test matrix · build · CLI smoke).
- Be kind in review — see the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Reporting bugs / proposing features
Open an issue with the relevant template. For anything security-sensitive (the CLI runs a local HTTP server), see [SECURITY.md](./SECURITY.md).
