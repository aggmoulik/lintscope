import path from 'node:path';
import {
  type Diagnostic,
  diagnosticId,
  type LintReport,
  LintReportSchema,
  SCHEMA_VERSION,
} from '@lintscope/schema';
import { relativeDisplayPath } from '../../display-path';
import type { BiomeDiagnostic, BiomeReport, MapBiomeContext } from './api-types';

const BIOME_SEVERITY_MAP: Record<BiomeDiagnostic['severity'], Diagnostic['severity']> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
  hint: 'info',
};

/**
 * Map a Biome `--reporter=json` payload into a normalized LintReport.
 *
 * Pure function — does no I/O. Exported separately from the adapter so we can
 * test it against captured Biome output without spawning the binary.
 */
export function mapBiomeResults(payload: BiomeReport, ctx: MapBiomeContext): LintReport {
  const diagnostics: Diagnostic[] = [];
  const filesIndex = new Map<string, { errorCount: number; warningCount: number }>();
  const ruleFrequency: Record<string, number> = {};

  for (const d of payload.diagnostics ?? []) {
    const filePath = extractPath(d.location?.path);
    if (!filePath) continue;

    const absolute = path.resolve(ctx.cwd, filePath);
    const relativePath = relativeDisplayPath(ctx.cwd, absolute);

    const span = d.location?.span;
    const source = d.location?.sourceCode ?? '';
    const { line, column } = span ? offsetToLineCol(source, span[0]) : { line: 1, column: 1 };
    const end = span ? offsetToLineCol(source, span[1]) : undefined;

    const severity = BIOME_SEVERITY_MAP[d.severity];
    const message = d.description || stringifyMessage(d.message) || d.category;
    const ruleId = d.category;
    ruleFrequency[ruleId] = (ruleFrequency[ruleId] ?? 0) + 1;

    const fixable =
      Array.isArray(d.tags) && d.tags.some((t) => String(t).toLowerCase() === 'fixable');

    const diagnostic: Diagnostic = {
      id: diagnosticId({ relativePath, line, column, ruleId, message }),
      filePath: absolute,
      relativePath,
      line,
      column,
      ruleId,
      severity,
      message,
      source: 'biome',
      category: ruleId,
    };
    if (end) {
      diagnostic.endLine = end.line;
      diagnostic.endColumn = end.column;
    }
    if (fixable) diagnostic.fixable = true;
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

  const totalErrors = diagnostics.filter((d) => d.severity === 'error').length;
  const totalWarnings = diagnostics.filter((d) => d.severity === 'warning').length;

  const report: LintReport = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    projectRoot: ctx.cwd,
    linters: [
      ctx.configPath
        ? { name: 'biome', version: ctx.biomeVersion, configPath: ctx.configPath }
        : { name: 'biome', version: ctx.biomeVersion },
    ],
    files,
    diagnostics,
    summary: {
      errorCount: totalErrors,
      warningCount: totalWarnings,
      // Biome marks auto-fixable diagnostics with a `fixable` tag; count those.
      fixableCount: diagnostics.filter((d) => d.fixable).length,
      fileCount: files.length,
      ruleFrequency,
    },
  };

  return LintReportSchema.parse(report);
}

function extractPath(
  p: BiomeDiagnostic['location'] extends { path?: infer P } ? P : unknown,
): string | undefined {
  if (typeof p === 'string') return p;
  if (
    p &&
    typeof p === 'object' &&
    'file' in p &&
    typeof (p as { file?: unknown }).file === 'string'
  ) {
    return (p as { file: string }).file;
  }
  return undefined;
}

function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  if (!source || offset <= 0) return { line: 1, column: 1 };
  let line = 1;
  let column = 1;
  const limit = Math.min(offset, source.length);
  for (let i = 0; i < limit; i++) {
    if (source.charCodeAt(i) === 0x0a /* \n */) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function stringifyMessage(message: unknown): string {
  if (typeof message === 'string') return message;
  // Biome's structured message is a tree of { content: Array<{ Slice: string } | string> }.
  // Walk it shallowly and concatenate any string slices we find.
  if (message && typeof message === 'object') {
    const node = message as { content?: unknown };
    if (Array.isArray(node.content)) {
      return node.content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && 'Slice' in part) {
            const slice = (part as { Slice?: unknown }).Slice;
            return typeof slice === 'string' ? slice : '';
          }
          return '';
        })
        .join('');
    }
  }
  return '';
}
