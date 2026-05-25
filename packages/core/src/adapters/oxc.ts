import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  type Diagnostic,
  diagnosticId,
  type LintReport,
  LintReportSchema,
  SCHEMA_VERSION,
} from '@lintscope/schema';

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
  span?: { offset?: number; length?: number };
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

function normalizeSeverity(input: string): Diagnostic['severity'] {
  const s = input.toLowerCase();
  if (s === 'error') return 'error';
  if (s === 'warning' || s === 'warn') return 'warning';
  // Treat advice/hint/info equally — diagnostic, but not actionable.
  return 'info';
}

function extractPath(d: OxcDiagnostic): string | undefined {
  if (typeof d.filename === 'string' && d.filename.length > 0) return d.filename;
  if (typeof d.file === 'string' && d.file.length > 0) return d.file;
  return undefined;
}

function extractRuleId(d: OxcDiagnostic): string {
  if (!d.code) return 'unknown';
  // If scope is present and not already encoded in the code, prefix it for
  // disambiguation (eslint/no-console vs typescript/no-explicit-any).
  if (d.scope && !d.code.includes('/')) {
    return `${d.scope}/${d.code}`;
  }
  return d.code;
}

function extractPosition(d: OxcDiagnostic): {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
} {
  const label = d.labels?.[0];
  if (label && typeof label.line === 'number' && typeof label.column === 'number') {
    const result: { line: number; column: number; endLine?: number; endColumn?: number } = {
      line: label.line,
      column: label.column,
    };
    if (typeof label.end_line === 'number') result.endLine = label.end_line;
    if (typeof label.end_column === 'number') result.endColumn = label.end_column;
    return result;
  }
  return { line: 1, column: 1 };
}

/**
 * Map an oxlint JSON payload into a normalized LintReport. Pure — no I/O.
 *
 * The defensive parsing here is intentional: oxlint's JSON shape is still
 * shifting between minor releases. The mapper accepts what we know exists,
 * tolerates fields it doesn't recognize, and never throws on the "shape"
 * level — only on `LintReportSchema.parse` if the OUTPUT is invalid.
 */
export function mapOxcResults(payload: OxcReport, ctx: MapOxcContext): LintReport {
  const diagnostics: Diagnostic[] = [];
  const filesIndex = new Map<string, { errorCount: number; warningCount: number }>();
  const ruleFrequency: Record<string, number> = {};

  for (const d of payload.diagnostics ?? []) {
    const filePath = extractPath(d);
    if (!filePath) continue;

    const absolute = path.resolve(ctx.cwd, filePath);
    const relativePath = path.relative(ctx.cwd, absolute) || path.basename(absolute);

    const severity = normalizeSeverity(d.severity);
    const ruleId = extractRuleId(d);
    const message = d.message ?? d.labels?.[0]?.message ?? ruleId;
    const pos = extractPosition(d);

    ruleFrequency[ruleId] = (ruleFrequency[ruleId] ?? 0) + 1;

    const diagnostic: Diagnostic = {
      id: diagnosticId({
        relativePath,
        line: pos.line,
        column: pos.column,
        ruleId,
        message,
      }),
      filePath: absolute,
      relativePath,
      line: pos.line,
      column: pos.column,
      ruleId,
      severity,
      message,
      source: 'oxc',
    };
    if (pos.endLine !== undefined) diagnostic.endLine = pos.endLine;
    if (pos.endColumn !== undefined) diagnostic.endColumn = pos.endColumn;
    if (d.scope) diagnostic.category = d.scope;

    diagnostics.push(diagnostic);

    const bucket = filesIndex.get(absolute) ?? { errorCount: 0, warningCount: 0 };
    if (severity === 'error') bucket.errorCount += 1;
    else if (severity === 'warning') bucket.warningCount += 1;
    filesIndex.set(absolute, bucket);
  }

  const files: LintReport['files'] = [];
  for (const [absolute, counts] of filesIndex) {
    files.push({
      path: absolute,
      relativePath: path.relative(ctx.cwd, absolute) || path.basename(absolute),
      ...counts,
    });
  }

  const report: LintReport = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    projectRoot: ctx.cwd,
    linters: [
      ctx.configPath
        ? { name: 'oxc', version: ctx.oxcVersion, configPath: ctx.configPath }
        : { name: 'oxc', version: ctx.oxcVersion },
    ],
    files,
    diagnostics,
    summary: {
      errorCount: diagnostics.filter((d) => d.severity === 'error').length,
      warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
      // oxlint has --fix; we don't track fixability per-diagnostic in the JSON
      // output. Report 0; consumers run `oxlint --fix` themselves.
      fixableCount: 0,
      fileCount: files.length,
      ruleFrequency,
    },
  };

  return LintReportSchema.parse(report);
}

export interface RunOxcOptions {
  cwd: string;
  /** Globs / paths to lint. Defaults to `['.']`. */
  patterns?: string[];
  /** Optional explicit oxlint binary path. Defaults to `oxlint` on PATH. */
  binary?: string;
}

/**
 * Spawn `oxlint --format=json` and normalize the output into a LintReport.
 * Surfaces clear errors when oxlint is not installed, when it crashes
 * (exit ≥ 2), or when it emits malformed JSON.
 */
export async function runOxc(options: RunOxcOptions): Promise<LintReport> {
  const patterns = options.patterns ?? ['.'];
  const binary = options.binary ?? 'oxlint';
  const args = ['--format=json', ...patterns];

  const child = spawn(binary, args, {
    cwd: options.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
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
        `Could not find \`${binary}\` on PATH. Install oxlint (\`pnpm add -D oxlint\`) or pass --binary.`,
      );
    }
    throw spawnError;
  }

  const stdout = Buffer.concat(stdoutChunks).toString('utf8');
  const stderr = Buffer.concat(stderrChunks).toString('utf8');

  // oxlint, like ESLint and Biome, exits 1 when there are findings — normal.
  if (exitCode !== null && exitCode > 1) {
    throw new Error(
      `oxlint exited with code ${exitCode}: ${stderr.trim() || stdout.trim() || 'no output'}`,
    );
  }

  if (!stdout.trim()) {
    throw new Error(`oxlint produced no stdout (stderr: ${stderr.trim() || 'empty'})`);
  }

  let payload: OxcReport;
  try {
    payload = JSON.parse(stdout) as OxcReport;
  } catch (err) {
    throw new Error(
      `oxlint --format=json output was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return mapOxcResults(payload, {
    cwd: options.cwd,
    oxcVersion: 'unknown',
  });
}
