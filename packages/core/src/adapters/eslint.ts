import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  type Diagnostic,
  diagnosticId,
  type LintReport,
  LintReportSchema,
  SCHEMA_VERSION,
} from '@lintscope/schema';
import { resolveLinterBin, resolveLinterVersion } from '../resolve-bin';

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
  /** Lint patterns. Defaults to `['.']` so ESLint's own config drives the file set. */
  patterns?: string[];
  /** Optional explicit config file. If omitted, ESLint auto-detects. */
  configPath?: string;
  /**
   * Explicit eslint binary path (override). When omitted, the project-local
   * `node_modules/.bin/eslint` is preferred, falling back to `eslint` on PATH.
   */
  binary?: string;
}

/** Build the `eslint` CLI args. Pure — exported for testing. */
export function buildEslintArgs(patterns: string[], configPath?: string): string[] {
  return [
    '--format',
    'json',
    // Don't fail the whole run when a pattern matches nothing.
    '--no-error-on-unmatched-pattern',
    ...(configPath ? ['--config', configPath] : []),
    ...patterns,
  ];
}

/**
 * Run the project's own ESLint via its CLI (`eslint --format json`) and
 * normalize the output into a LintReport.
 *
 * We spawn the resolved binary rather than `import('eslint')` so we run the
 * version installed in the *target* project — `import` would resolve ESLint
 * from `@lintscope/core`'s own dependency tree instead. The `--format json`
 * output is the same `LintResult[]` shape the Node API returns, so
 * `mapEslintResults` is reused unchanged.
 */
export async function runEslint(options: RunEslintOptions): Promise<LintReport> {
  const patterns = options.patterns ?? ['.'];
  const { command: binary, resolvedFrom } = resolveLinterBin({
    projectRoot: options.cwd,
    name: 'eslint',
    ...(options.binary ? { override: options.binary } : {}),
  });
  const args = buildEslintArgs(patterns, options.configPath);

  const child = spawn(binary, args, {
    cwd: options.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    // A local `.bin` shim on Windows is a `.cmd`, which Node refuses to spawn
    // without a shell (CVE-2024-27980). PATH/override stay shell-free.
    shell: resolvedFrom === 'local' && /\.(cmd|bat)$/i.test(binary),
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
  child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

  let spawnError: NodeJS.ErrnoException | undefined;
  child.on('error', (err) => {
    spawnError = err as NodeJS.ErrnoException;
  });

  const exitCode: number | null = await new Promise((resolve) => {
    child.once('close', resolve);
  });

  if (spawnError) {
    if (spawnError.code === 'ENOENT') {
      throw new Error(
        `Could not find \`${binary}\`. Install ESLint (\`pnpm add -D eslint\`) or pass an explicit binary.`,
      );
    }
    throw spawnError;
  }

  const stdout = Buffer.concat(stdoutChunks).toString('utf8');
  const stderr = Buffer.concat(stderrChunks).toString('utf8');

  // ESLint exits 1 when there are lint problems — that's normal. Exit ≥ 2 means
  // a fatal error (bad config, crash, no config found).
  if (exitCode !== null && exitCode > 1) {
    throw new Error(
      `eslint exited with code ${exitCode}: ${stderr.trim() || stdout.trim() || 'no output'}`,
    );
  }

  if (!stdout.trim()) {
    throw new Error(`eslint produced no stdout (stderr: ${stderr.trim() || 'empty'})`);
  }

  let results: EslintLintResult[];
  try {
    results = JSON.parse(stdout) as EslintLintResult[];
  } catch (err) {
    throw new Error(
      `eslint --format json output was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return mapEslintResults(results, {
    cwd: options.cwd,
    eslintVersion: resolveLinterVersion(options.cwd, 'eslint'),
    ...(options.configPath ? { configPath: options.configPath } : {}),
  });
}
