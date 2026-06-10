---
"lintscope": minor
---

Linter-agnostic dashboard. The report's `linters[]` entries now carry display
meta (label, logo, docs URL, autofix command) stamped by each adapter, and the
studio UI renders everything from it — badges, logos, filter tags, and the
copy-to-clipboard autofix hint all work for any adapter (including future
community ones) with zero UI changes. Stylelint diagnostics now show their
`stylelint --fix` hint. Additive schema field: reports produced by older
versions still load, falling back to built-in branding.
