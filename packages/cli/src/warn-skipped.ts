import type { SkippedLinter } from '@lintscope/core';

/**
 * Emit one structured stderr line per skipped linter, matching the CLI's
 * `{level, code, message, hint?}` convention. stderr (not stdout) so it never
 * pollutes `lintscope export`'s JSON.
 */
export function warnSkippedLinters(skipped: SkippedLinter[]): void {
  for (const s of skipped) {
    console.error(
      JSON.stringify({
        level: 'warn',
        code: 'linter_skipped',
        message: `Skipped ${s.linter}: ${s.reason}`,
        hint: `Install ${s.linter} (or remove its config) to silence this.`,
      }),
    );
  }
}
