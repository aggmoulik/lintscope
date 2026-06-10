/**
 * Structural type for the subset of `oxlint --format=json` we depend on.
 *
 * oxlint's JSON format has shifted between minor releases. Field names we've
 * observed:
 *   - `severity` ∈ {error, warning, info, advice, hint}
 *   - `code` (rule id) — sometimes nested under `scope` qualifier
 *   - `filename` OR `file` for the path
 *   - `labels[]` for spans + line/column when available
 *
 * The mapper accepts all of these. When line/column is missing we fall back
 * to 1/1 rather than failing — for `advice`-class diagnostics that often
 * carry no location.
 */
export interface OxcLabel {
  message?: string;
  /**
   * oxlint 1.x nests line/column INSIDE `span` (alongside the byte offset);
   * older releases put them at the label top level. We read both.
   */
  span?: {
    offset?: number;
    length?: number;
    line?: number;
    column?: number;
    end_line?: number;
    end_column?: number;
  };
  line?: number;
  column?: number;
  end_line?: number;
  end_column?: number;
}

export interface OxcDiagnostic {
  severity: string;
  code?: string;
  /** Some versions namespace rules — e.g. "eslint/no-console". */
  scope?: string;
  message?: string;
  filename?: string;
  /** Older versions used `file`. */
  file?: string;
  labels?: OxcLabel[];
}

export interface OxcReport {
  diagnostics?: OxcDiagnostic[];
}

export interface MapOxcContext {
  cwd: string;
  oxcVersion: string;
  configPath?: string;
}
