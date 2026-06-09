import {
  type BiomeReport,
  type EslintLintResult,
  mapBiomeResults,
  mapEslintResults,
  mapOxcResults,
  type OxcReport,
} from '@lintscope/core';
import type { LintReport } from '@lintscope/schema';

export type LinterFormat = 'eslint' | 'biome' | 'oxc';

export const LINTER_FORMATS: readonly LinterFormat[] = ['eslint', 'biome', 'oxc'] as const;

/**
 * Human-readable CLI command each format expects, used in error messages so
 * users know what to pipe in when they get `--from` wrong.
 */
const PRODUCER_HINT: Record<LinterFormat, string> = {
  eslint: 'eslint -f json',
  biome: 'biome lint --reporter=json',
  oxc: 'oxlint --format=json',
};

/**
 * Parse a raw linter JSON payload (as produced by the linter's own `--format
 * json`/`--reporter=json` CLI) and map it to a normalized `LintReport` via
 * the existing pure mappers in `@lintscope/core`.
 *
 * Designed for `lintscope view` — never spawns a linter, never validates
 * versions. `linters[0].version` is stamped `'unknown'` because we have no
 * way to know which binary actually produced the payload.
 *
 * Throws a helpful, actionable Error on:
 *  - non-JSON input (cites the expected producer command)
 *  - shape mismatch with `from` (hints the user to check `--from`)
 */
export function loadReport(from: LinterFormat, raw: string, cwd: string): LintReport {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Input wasn't valid JSON. \`--from ${from}\` expects \`${PRODUCER_HINT[from]}\` output. (${reason})`,
    );
  }

  // Pre-flight top-level shape check. Without this, feeding the wrong format
  // (e.g. an ESLint array with `--from biome`) silently produces an empty
  // report because the mapper tolerates missing `diagnostics`. We'd rather
  // surface a clear "wrong --from" error than render a misleading dashboard.
  if (from === 'eslint') {
    if (!Array.isArray(json)) throw shapeMismatch(from);
  } else {
    if (Array.isArray(json) || typeof json !== 'object' || json === null) {
      throw shapeMismatch(from);
    }
  }

  try {
    switch (from) {
      case 'eslint':
        return mapEslintResults(json as EslintLintResult[], {
          cwd,
          eslintVersion: 'unknown',
        });
      case 'biome':
        return mapBiomeResults(json as BiomeReport, {
          cwd,
          biomeVersion: 'unknown',
        });
      case 'oxc':
        return mapOxcResults(json as OxcReport, {
          cwd,
          oxcVersion: 'unknown',
        });
    }
  } catch (err) {
    // Mapper Zod-validation failure → wrap with the same shape-mismatch hint
    // so the user gets one consistent diagnosis path.
    const reason = err instanceof Error ? err.message : String(err);
    throw shapeMismatch(from, reason);
  }
}

function shapeMismatch(from: LinterFormat, detail?: string): Error {
  const base = `Input didn't match the expected ${from} JSON shape — is \`--from\` correct?`;
  return new Error(detail ? `${base} (${detail})` : base);
}
