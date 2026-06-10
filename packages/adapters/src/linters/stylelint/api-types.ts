/**
 * Subset of stylelint's `--formatter json` output we depend on. One result
 * per linted file; clean files appear with an empty `warnings` array.
 *
 * Captured from stylelint 16.26.1. Note: stylelint 16 prints this report to
 * STDERR, not stdout — the adapter declares `readFrom: 'stderr'`.
 */
export interface StylelintWarning {
  /** Nullable: parse-error-class warnings can lack a position. */
  line?: number | null;
  column?: number | null;
  endLine?: number;
  endColumn?: number;
  /** Rule id, e.g. 'block-no-empty'. Nullable for non-rule warnings. */
  rule?: string | null;
  severity: 'error' | 'warning';
  /** Human message, e.g. 'Unexpected empty block (block-no-empty)'. */
  text: string;
  url?: string;
}

export interface StylelintResult {
  /** Absolute path of the linted file. */
  source?: string;
  errored?: boolean;
  warnings: StylelintWarning[];
  deprecations?: unknown[];
  invalidOptionWarnings?: unknown[];
  parseErrors?: unknown[];
}

export interface MapStylelintContext {
  cwd: string;
  stylelintVersion: string;
  configPath?: string;
}
