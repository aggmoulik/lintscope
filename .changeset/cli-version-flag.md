---
"lintscope": patch
---

CLI fixes and dependency refresh:

- `lintscope --version` now reports the real package version (it was hardcoded to 0.0.0). The version is baked in at build time from package.json via tsup `define`.
- `commander` 13 → 14. Commander 15 was skipped on purpose: it requires Node ≥ 22.12, and lintscope supports Node 20.
- `chokidar` 4 → 5 (ESM-only; lintscope already ships ESM).
- `engines.node` is now `>=20.19`, chokidar 5's floor. Node 20.0–20.18 users get a clear engines error instead of a confusing runtime failure.
