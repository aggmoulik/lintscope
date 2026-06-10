import { type DetectedConfig, listAdapters } from '@lintscope/adapters';

/** A linter found in a project: the adapter's name + its detected config. */
export interface DetectedLinter {
  linter: string;
  config: DetectedConfig;
}

/**
 * Pick the single highest-precedence linter for a project (oxc > biome >
 * eslint, per adapter `priority`). The reasoning is migration intent — a
 * project that has switched to the faster, newer tool wants its output. Used
 * by `view` and as a building block; the studio/scan/export flows run ALL
 * linters via `detectLinters`.
 */
export function detectLinter(cwd: string): DetectedLinter | null {
  return detectLinters(cwd)[0] ?? null;
}

/**
 * Detect EVERY linter that has a config in `cwd`, in adapter-priority order —
 * a workspace often runs more than one (e.g. Biome for format + ESLint for
 * rules). The order is the default *focus*, not an exclusion. Returns `[]`
 * when none are configured.
 */
export function detectLinters(cwd: string): DetectedLinter[] {
  return listAdapters().flatMap((adapter) => {
    const config = adapter.detect(cwd);
    return config ? [{ linter: adapter.name, config }] : [];
  });
}
