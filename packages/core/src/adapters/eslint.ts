import path from 'node:path';
import {
  type Diagnostic,
  diagnosticId,
  type LintReport,
  LintReportSchema,
  SCHEMA_VERSION,
} from '@lintscope/schema';

/**
 * Subset of the ESLint LintResult shape we depend on. Declared locally so
 * @lintscope/core's mapping logic is testable without importing the ESLint
 * package at type-check time and so we don't break when ESLint adds fields.
 */
export interface EslintLintMessage {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  fix?: { range: [number, number]; text: string };
  suggestions?: Array<{ desc: string; fix: { range: [number, number]; text: string } }>;
}

export interface EslintLintResult {
  filePath: string;
  messages: EslintLintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount?: number;
  fixableWarningCount?: number;
}

export interface MapEslintContext {
  cwd: string;
  eslintVersion: string;
  configPath?: string;
}

/**
 * Map a batch of ESLint `LintResult[]` into a normalized `LintReport`.
 *
 * Pure function — does no I/O. Exported separately from `runEslint` so it can
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
    const relativePath = path.relative(ctx.cwd, result.filePath) || path.basename(result.filePath);

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

export interface RunEslintOptions {
  /** Project root. Used as ESLint cwd and to compute relative paths. */
  cwd: string;
  /** Glob patterns to lint. Defaults to `['**\/*.{js,jsx,ts,tsx,mjs,cjs}']`. */
  patterns?: string[];
  /** Optional explicit config file. If omitted, ESLint auto-detects. */
  configPath?: string;
}

/**
 * Run ESLint via its Node API and return a normalized LintReport.
 *
 * Requires `eslint` to be installed in the caller's project (declared as an
 * optional peer dependency so `@lintscope/core` itself stays lightweight).
 */
export async function runEslint(options: RunEslintOptions): Promise<LintReport> {
  const patterns = options.patterns ?? ['**/*.{js,jsx,ts,tsx,mjs,cjs}'];
  // Dynamic import keeps ESLint as an optional peer.
  const eslintModule = (await import('eslint')) as typeof import('eslint');
  const eslint = new eslintModule.ESLint({
    cwd: options.cwd,
    ...(options.configPath ? { overrideConfigFile: options.configPath } : {}),
    fix: false,
    errorOnUnmatchedPattern: false,
  });

  const results = await eslint.lintFiles(patterns);
  return mapEslintResults(results as unknown as EslintLintResult[], {
    cwd: options.cwd,
    eslintVersion: eslintModule.ESLint.version,
    ...(options.configPath ? { configPath: options.configPath } : {}),
  });
}
