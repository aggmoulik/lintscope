---
"lintscope": minor
---

**Stylelint support** + a community adapter architecture.

- New linter: **Stylelint** (16+). Detected via `.stylelintrc*` / `stylelint.config.*`, runs alongside the other linters and merges into the same report. Handles stylelint's conventions: the JSON report on stderr and exit code 2 for findings.
- New internal `@lintscope/adapters` package (bundled into the CLI): a small plain-object contract, shared spawn runner, and registry — adding a linter is now a one-folder contribution with a reusable test harness. See `packages/adapters/README.md` for the guide.
- The Auto-fixable stat in the dashboard no longer counts ESLint *suggestions* (which `--fix` doesn't apply) — it now matches the per-diagnostic badge.
