/**
 * Subset of Biome's `--reporter=json` output that we depend on. Declared
 * structurally so the mapper survives minor format drift.
 *
 * Biome 2.x format quirks:
 *  - `location.path` can be either `string` or `{ file: string }`
 *  - `location.span` is byte offsets, not line/column — we derive those from
 *    `location.sourceCode`
 *  - `message` can be a structured rich-text tree OR a plain string; we fall
 *    back to `description` (which is always a plain string).
 */
export interface BiomeDiagnostic {
  category: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  description: string;
  message?: unknown;
  /** Biome marks auto-fixable diagnostics with a `fixable` tag. */
  tags?: string[];
  location?: {
    path?: string | { file?: string };
    sourceCode?: string;
    span?: [number, number];
  };
}

export interface BiomeReport {
  summary?: {
    errors?: number;
    warnings?: number;
  };
  diagnostics?: BiomeDiagnostic[];
}

export interface MapBiomeContext {
  cwd: string;
  biomeVersion: string;
  configPath?: string;
}
