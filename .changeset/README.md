# Changesets

This directory drives version + changelog management via [Changesets](https://github.com/changesets/changesets).

## Adding a changeset

```sh
pnpm changeset
```

Pick the affected packages and bump kind (patch / minor / major). Commit the generated markdown file with your PR.

## What happens on merge to main

1. The `release` workflow opens (or updates) a "Version Packages" PR that bumps versions + writes CHANGELOG entries.
2. When that PR is merged, the workflow runs `pnpm release` which publishes to npm with provenance.

The `@lintscope/registry` and `@lintscope/tsconfig` packages are ignored — registry is a deployed app, tsconfig is internal only.
