import {
  type Diagnostic,
  diagnosticId,
  type LintReport,
  LintReportSchema,
  SCHEMA_VERSION,
} from '@lintscope/schema';
import { relativeDisplayPath } from '../../display-path';
import type { EslintLintResult, MapEslintContext } from './api-types';

/**
 * Map a batch of ESLint `LintResult[]` into a normalized `LintReport`.
 *
 * Pure function — does no I/O. Exported separately from the adapter so it can
 * be tested with captured ESLint outputs without spawning a real ESLint instance.
 */
export function mapEslintResults(results: EslintLintResult[], ctx: MapEslintContext): LintReport {
  const diagnostics: Diagnostic[] = [];
  const files: LintReport['files'] = [];
  const ruleFrequency: Record<string, number> = {};
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalFixable = 0;

  for (const result of results) {
    const relativePath = relativeDisplayPath(ctx.cwd, result.filePath);

    files.push({
      path: result.filePath,
      relativePath,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
    });

    totalErrors += result.errorCount;
    totalWarnings += result.warningCount;
    totalFixable += (result.fixableErrorCount ?? 0) + (result.fixableWarningCount ?? 0);

    for (const m of result.messages) {
      const ruleId = m.ruleId ?? null;
      if (ruleId) {
        ruleFrequency[ruleId] = (ruleFrequency[ruleId] ?? 0) + 1;
      }
      const line = m.line ?? 1;
      const column = m.column ?? 1;
      const severity: Diagnostic['severity'] = m.severity === 2 ? 'error' : 'warning';

      const diagnostic: Diagnostic = {
        id: diagnosticId({ relativePath, line, column, ruleId, message: m.message }),
        filePath: result.filePath,
        relativePath,
        line,
        column,
        ruleId,
        severity,
        message: m.message,
        source: 'eslint',
      };

      if (m.endLine !== undefined) diagnostic.endLine = m.endLine;
      if (m.endColumn !== undefined) diagnostic.endColumn = m.endColumn;
      if (m.fix) {
        diagnostic.fix = { range: [m.fix.range[0], m.fix.range[1]], text: m.fix.text };
      }
      if (m.suggestions && m.suggestions.length > 0) {
        diagnostic.suggestions = m.suggestions.map((s) => ({
          desc: s.desc,
          fix: { range: [s.fix.range[0], s.fix.range[1]], text: s.fix.text },
        }));
      }

      diagnostics.push(diagnostic);
    }
  }

  const report: LintReport = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    projectRoot: ctx.cwd,
    linters: [
      ctx.configPath
        ? { name: 'eslint', version: ctx.eslintVersion, configPath: ctx.configPath }
        : { name: 'eslint', version: ctx.eslintVersion },
    ],
    files,
    diagnostics,
    summary: {
      errorCount: totalErrors,
      warningCount: totalWarnings,
      fixableCount: totalFixable,
      fileCount: files.length,
      ruleFrequency,
    },
  };

  // Validate at the boundary — fail loudly if our mapping ever drifts from the schema.
  return LintReportSchema.parse(report);
}
