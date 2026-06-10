/**
 * Subset of the ESLint LintResult shape we depend on. Declared locally so
 * the mapping logic is testable without importing the ESLint package at
 * type-check time and so we don't break when ESLint adds fields.
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
