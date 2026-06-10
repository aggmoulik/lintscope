import path from 'node:path';
import {
  type Diagnostic,
  diagnosticId,
  type LintReport,
  LintReportSchema,
  SCHEMA_VERSION,
} from '@lintscope/schema';
import { relativeDisplayPath } from '../../display-path';
import type { MapStylelintContext, StylelintResult } from './api-types';

/**
 * Map a stylelint `--formatter json` payload into a normalized LintReport.
 * Pure — no I/O. Clean files stay in the files list with zero counts (the
 * payload is one result per linted file, like ESLint's).
 */
export function mapStylelintResults(
  results: StylelintResult[],
  ctx: MapStylelintContext,
): LintReport {
  const diagnostics: Diagnostic[] = [];
  const files: LintReport['files'] = [];
  const ruleFrequency: Record<string, number> = {};

  for (const result of results) {
    if (!result.source) continue;
    const absolute = path.resolve(ctx.cwd, result.source);
    const relativePath = relativeDisplayPath(ctx.cwd, absolute);

    let errorCount = 0;
    let warningCount = 0;

    for (const w of result.warnings) {
      const ruleId = w.rule ?? null;
      if (ruleId) {
        ruleFrequency[ruleId] = (ruleFrequency[ruleId] ?? 0) + 1;
      }
      const line = w.line ?? 1;
      const column = w.column ?? 1;
      const severity: Diagnostic['severity'] = w.severity === 'error' ? 'error' : 'warning';
      if (severity === 'error') errorCount += 1;
      else warningCount += 1;

      const diagnostic: Diagnostic = {
        id: diagnosticId({ relativePath, line, column, ruleId, message: w.text }),
        filePath: absolute,
        relativePath,
        line,
        column,
        ruleId,
        severity,
        message: w.text,
        source: 'stylelint',
      };
      if (w.endLine !== undefined) diagnostic.endLine = w.endLine;
      if (w.endColumn !== undefined) diagnostic.endColumn = w.endColumn;

      diagnostics.push(diagnostic);
    }

    files.push({ path: absolute, relativePath, errorCount, warningCount });
  }

  const report: LintReport = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    projectRoot: ctx.cwd,
    linters: [
      ctx.configPath
        ? { name: 'stylelint', version: ctx.stylelintVersion, configPath: ctx.configPath }
        : { name: 'stylelint', version: ctx.stylelintVersion },
    ],
    files,
    diagnostics,
    summary: {
      errorCount: diagnostics.filter((d) => d.severity === 'error').length,
      warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
      // The JSON formatter doesn't mark per-warning fixability; report 0 and
      // let users run `stylelint --fix` themselves (same stance as oxc).
      fixableCount: 0,
      fileCount: files.length,
      ruleFrequency,
    },
  };

  return LintReportSchema.parse(report);
}
