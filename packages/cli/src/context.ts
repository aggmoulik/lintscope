import type { LintReport } from '@lintscope/schema';

/**
 * Per-CLI-invocation state shared across endpoint handlers. The CLI builds
 * one of these in the `studio` command and passes it down. Keeping it as a
 * plain object (no class, no DI container) makes handlers trivial to test.
 */
export interface LintContext {
  /** Absolute project root (the user's cwd, normalized). */
  projectRoot: string;
  /** Display name surfaced to the studio page via `/init`. */
  name: string;
  /** Linter the CLI session is bound to. v1 = eslint; biome/oxc later. */
  linter: 'eslint';
  /** Memoized report. Updated by /scan and (later) the watch reconciler. */
  report: LintReport;
  /**
   * Re-run the linter. Returns the fresh report; the caller is responsible for
   * storing it back into `context.report` if desired. This indirection lets
   * tests inject a mock without spawning ESLint.
   */
  rerun: () => Promise<LintReport>;
}
