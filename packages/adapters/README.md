# @lintscope/adapters

The linter adapter layer for [lintscope](https://github.com/aggmoulik/lintscope): a small
contract, a shared runner, a registry, and one folder per supported linter.

**This is where you add support for a new linter.** An adapter is ~150 lines of plain
functions plus captured fixtures — no classes, no inheritance, no lintscope internals.

## Supported linters

| Linter | Spawns | Detection | Priority |
|--------|--------|-----------|----------|
| **OXC** (oxlint) | `oxlint --format=json` | `.oxlintrc.json` / `oxlintrc.json` | 10 (first) |
| **Biome** | `biome lint --reporter=json` | `biome.json` / `biome.jsonc` | 20 |
| **ESLint** | `eslint --format json` | `eslint.config.*` / `.eslintrc.*` | 30 |
| **Stylelint** | `stylelint --formatter json` (report on **stderr**, exits **2** on findings) | `.stylelintrc*` / `stylelint.config.*` | 40 |

Priority is *detection focus order* (ascending), not exclusion — lintscope runs every
detected linter and merges the reports.

## Architecture

```
src/
  types.ts                 # The LinterAdapter contract (start here)
  runner.ts                # runAdapter(): the shared composition root
  registry.ts              # createRegistry + getAdapter/listAdapters/registerAdapter
  resolve-bin.ts           # override → <project>/node_modules/.bin → PATH
  display-path.ts          # POSIX relativePath helpers (Windows-safe)
  testing.ts               # describeAdapterContract — the invariant test harness
  index.ts                 # Barrel: seeds the registry with the built-ins
  linters/
    eslint/
      api-types.ts         #   Structural types for the linter's JSON output
      detect.ts            #   Find the linter's config file in a project
      mapper.ts            #   JSON payload -> normalized LintReport (pure)
      adapter.ts           #   The descriptor composing the pieces
      index.ts             #   Barrel exports
    biome/                 # …same shape
    oxc/                   # …same shape
test/
  fixtures/                # Captured REAL linter outputs (never hand-written)
  contract.test.ts         # Built-ins run through describeAdapterContract
```

Every adapter is a plain object implementing `LinterAdapter<Payload>` (`src/types.ts`),
where `Payload` is the parsed shape of the linter's JSON output. The shared runner
composes the pieces — adapters never spawn processes themselves:

```
runAdapter(adapter, { cwd })
  → resolveLinterBin(cwd, adapter.bin)        # project-local install wins over PATH
  → spawn(binary, adapter.buildArgs({...}))   # Windows .cmd handled, 16MB output cap
  → exit code ∈ adapter.okExitCodes?          # default [0, 1] — 1 usually means "findings"
  → payload = adapter.parse?(stdout) ?? JSON.parse(stdout)
  → version = node_modules/<adapter.pkgName>/package.json
  → adapter.map(payload, { cwd, binaryPath, version, configPath? })   # pure
  → LintReport                                 # Zod-validated inside map()
```

## The contract, field by field

The real ESLint descriptor (`src/linters/eslint/adapter.ts`):

```ts
export const eslintAdapter: LinterAdapter<EslintLintResult[]> = {
  name: 'eslint',                       // lowercase, unique — the registry key
  meta: {
    label: 'ESLint',                    // brand-cased; shown in the studio UI
    logoSlug: 'eslint',                 // logo on logos.lndev.me (omit for text fallback)
    docsUrl: 'https://eslint.org',
  },
  priority: 30,                         // ascending detection order across adapters
  bin: 'eslint',                        // the executable to resolve + spawn
  pkgName: 'eslint',                    // npm package for version lookup (scoped OK)
  defaultPatterns: ['.'],               // what to lint when the caller passes nothing
  installHint: 'pnpm add -D eslint',    // shown when the binary is missing
  okExitCodes: [0, 1],                  // exit codes that still carry a usable report
  detect: detectEslintConfig,           // (cwd) => { path, kind? } | null
  buildArgs: ({ patterns, configPath }) => buildEslintArgs(patterns, configPath),
  map: (payload, ctx) =>                // pure; MUST end in LintReportSchema.parse
    mapEslintResults(payload, { cwd: ctx.cwd, eslintVersion: ctx.version, ... }),
};
```

Notes that save review rounds:

- **`okExitCodes`** — research your linter's convention. ESLint/Biome/oxlint exit `1`
  on findings; Stylelint exits `2` (and reserves `1` for fatal errors, so its adapter
  declares `[0, 2]`). Anything outside the list is treated as a crash.
- **`readFrom`** — which stream carries the report; defaults to `'stdout'`. Check this
  empirically: stylelint 16 prints its JSON report to **stderr** (`readFrom: 'stderr'`).
  If your capture file comes out empty, this is why.
- **Pattern semantics** — `buildArgs` receives directory-ish patterns from the monorepo
  scope walk-up (e.g. `apps/web`). If your linter doesn't lint directories (stylelint
  doesn't), expand them into globs there — see `buildStylelintArgs`.
- **`map` must be pure** (no I/O) and must validate: `return LintReportSchema.parse(report)`.
  Shape drift then fails loudly at the boundary instead of corrupting the UI.
- **`relativePath` is computed with `relativeDisplayPath`**, never `path.relative` —
  it must be forward-slash on every platform (the UI file tree splits on `/`, and
  diagnostic IDs hash it, so backslashes would make IDs platform-dependent).
- **`Diagnostic.id`** comes from `diagnosticId(...)` in `@lintscope/schema` — a stable
  hash so the UI can dedupe across re-runs.
- **Structural payload types** (`api-types.ts`): declare only the fields you read,
  tolerate everything else. Linter JSON formats drift between minors.

## Adding a linter, step by step

1. **Capture real output first.** In a project that uses the linter:
   `npx <linter> --your-json-flag > capture.json 2> capture-stderr.json`. Capture BOTH
   streams and note the exit code and linter version — that's how you learn `readFrom`
   and `okExitCodes` (stylelint surprised us on both). The non-empty file becomes
   `test/fixtures/<name>-results.json` — fixtures are never hand-written. Normalize
   the captured absolute paths to `/repo` to match the fixture convention.
2. **Scaffold** `src/linters/<name>/` with the five files (copy the `oxc/` folder —
   it's the smallest).
3. **`detect.ts`** — check `cwd` for the linter's config file(s), in preference order.
4. **`api-types.ts`** — structural types for the slice of the JSON you read.
5. **`mapper.ts`** — payload → `LintReport`. Use `relativeDisplayPath` for relative
   paths and `diagnosticId` for IDs; end in `LintReportSchema.parse`.
6. **`adapter.ts`** — the descriptor (see above). Pick the next free `priority`.
7. **Register it** in `src/index.ts` (import + add to the seed loop + re-export), add
   the subpath export to `package.json` and the entry to `tsup.config.ts`.
8. **Test it** — add your fixtures to `test/contract.test.ts`:

   ```ts
   describeAdapterContract(stylelintAdapter, {
     fixtures: [{
       name: 'captured stylelint --formatter json run (v16.8)',
       payload: fixture<StylelintResult[]>('stylelint-results.json'),
       context: { cwd: '/repo', binaryPath: 'stylelint', version: '16.8.0' },
     }],
   });
   ```

   The harness enforces the invariants (schema-valid report, absolute paths +
   forward-slash relativePaths, stable IDs, summary consistency). Add a
   `test/<name>.test.ts` for mapper edge cases the harness can't know about
   (severity mapping, position fallbacks, format quirks).
9. **Run the gauntlet:** `pnpm test && pnpm typecheck && pnpm lint` from the repo root.

## PR checklist

- [ ] Fixtures are captured from a **real linter run**, with the linter version noted
      in the test name
- [ ] `map()` ends in `LintReportSchema.parse` and the harness suite passes
- [ ] Relative paths via `relativeDisplayPath` (no raw `path.relative` / no `\`)
- [ ] `okExitCodes` matches the linter's documented convention (link it in the PR)
- [ ] No new npm dependencies (adapters spawn the *project's* linter — we never depend
      on linter packages ourselves)
- [ ] `docs/roadmap.md` + `docs/CHANGELOG.md` updated if the linter priority order changes

## Consuming the package

```ts
import { getAdapter, listAdapters, registerAdapter, runAdapter } from '@lintscope/adapters';
import { eslintAdapter } from '@lintscope/adapters/eslint';          // per-linter subpath
import { describeAdapterContract } from '@lintscope/adapters/testing'; // test harness
```

`@lintscope/core` composes this package into multi-linter runs (`runLinters`) and
re-exports it; the published `lintscope` CLI bundles both. `registerAdapter()` is the
seam external `lintscope-adapter-*` packages will use post-v1.0 — until then, adapters
land in-repo via the steps above.
