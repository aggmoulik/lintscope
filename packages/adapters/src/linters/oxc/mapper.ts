import path from 'node:path';
import {
  type Diagnostic,
  diagnosticId,
  type LintReport,
  LintReportSchema,
  SCHEMA_VERSION,
} from '@lintscope/schema';
import { relativeDisplayPath } from '../../display-path';
import type { MapOxcContext, OxcDiagnostic, OxcReport } from './api-types';

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
  if (!label) return { line: 1, column: 1 };

  // Top-level line/column (older oxlint) take precedence; fall back to the
  // values nested inside `span` (oxlint 1.x). Either may be absent.
  const line = label.line ?? label.span?.line;
  const column = label.column ?? label.span?.column;
  if (typeof line === 'number' && typeof column === 'number') {
    const result: { line: number; column: number; endLine?: number; endColumn?: number } = {
      line,
      column,
    };
    const endLine = label.end_line ?? label.span?.end_line;
    const endColumn = label.end_column ?? label.span?.end_column;
    if (typeof endLine === 'number') result.endLine = endLine;
    if (typeof endColumn === 'number') result.endColumn = endColumn;
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
    const relativePath = relativeDisplayPath(ctx.cwd, absolute);

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
      relativePath: relativeDisplayPath(ctx.cwd, absolute),
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
