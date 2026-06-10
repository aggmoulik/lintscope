import type { Diagnostic, LintReport } from '@lintscope/schema';
import { describe, expect, it } from 'vitest';
import { mergeReports } from '../src/run-linter';

function diag(over: Partial<Diagnostic> & Pick<Diagnostic, 'source'>): Diagnostic {
  return {
    id: over.id ?? `${over.source}:${over.relativePath ?? 'a.ts'}:${over.line ?? 1}`,
    filePath: over.filePath ?? '/repo/a.ts',
    relativePath: over.relativePath ?? 'a.ts',
    line: over.line ?? 1,
    column: over.column ?? 1,
    ruleId: over.ruleId ?? 'rule',
    severity: over.severity ?? 'error',
    message: over.message ?? 'msg',
    source: over.source,
  };
}

function report(over: Partial<LintReport>): LintReport {
  return {
    schemaVersion: '1.0',
    generatedAt: '2026-01-01T00:00:00.000Z',
    projectRoot: '/repo',
    linters: over.linters ?? [{ name: 'eslint', version: '9' }],
    files: over.files ?? [],
    diagnostics: over.diagnostics ?? [],
    summary: over.summary ?? {
      errorCount: 0,
      warningCount: 0,
      fixableCount: 0,
      fileCount: 0,
      ruleFrequency: {},
    },
  };
}

describe('mergeReports', () => {
  it('returns an equivalent report when given a single report', () => {
    const r = report({
      diagnostics: [diag({ source: 'eslint' })],
      linters: [{ name: 'eslint', version: '9' }],
      summary: { errorCount: 1, warningCount: 0, fixableCount: 0, fileCount: 1, ruleFrequency: {} },
    });
    const merged = mergeReports([r]);
    expect(merged.diagnostics).toHaveLength(1);
    expect(merged.linters).toEqual([{ name: 'eslint', version: '9' }]);
    expect(merged.summary.errorCount).toBe(1);
  });

  it('concatenates diagnostics from all reports WITHOUT deduping', () => {
    const d = diag({ source: 'eslint', line: 5 });
    const r1 = report({ diagnostics: [d] });
    const r2 = report({ diagnostics: [{ ...d, source: 'oxc' }, d] }); // includes a literal dup
    expect(mergeReports([r1, r2]).diagnostics).toHaveLength(3);
  });

  it('merges files by path and sums their counts', () => {
    const r1 = report({
      files: [{ path: '/repo/a.ts', relativePath: 'a.ts', errorCount: 1, warningCount: 0 }],
    });
    const r2 = report({
      files: [
        { path: '/repo/a.ts', relativePath: 'a.ts', errorCount: 0, warningCount: 2 },
        { path: '/repo/b.ts', relativePath: 'b.ts', errorCount: 1, warningCount: 0 },
      ],
    });
    const merged = mergeReports([r1, r2]);
    expect(merged.files).toHaveLength(2);
    expect(merged.files.find((f) => f.path === '/repo/a.ts')).toMatchObject({
      errorCount: 1,
      warningCount: 2,
    });
  });

  it('concatenates the linters from every report', () => {
    const r1 = report({ linters: [{ name: 'oxc', version: '1.66.0' }] });
    const r2 = report({ linters: [{ name: 'biome', version: '1.8.3' }] });
    expect(mergeReports([r1, r2]).linters.map((l) => l.name)).toEqual(['oxc', 'biome']);
  });

  it('sums summary counts, uses unique file count, merges ruleFrequency', () => {
    const r1 = report({
      files: [{ path: '/repo/a.ts', relativePath: 'a.ts', errorCount: 1, warningCount: 0 }],
      summary: {
        errorCount: 1,
        warningCount: 0,
        fixableCount: 1,
        fileCount: 1,
        ruleFrequency: { x: 1 },
      },
    });
    const r2 = report({
      files: [{ path: '/repo/a.ts', relativePath: 'a.ts', errorCount: 0, warningCount: 2 }],
      summary: {
        errorCount: 0,
        warningCount: 2,
        fixableCount: 0,
        fileCount: 1,
        ruleFrequency: { x: 1, y: 3 },
      },
    });
    const merged = mergeReports([r1, r2]);
    expect(merged.summary.errorCount).toBe(1);
    expect(merged.summary.warningCount).toBe(2);
    expect(merged.summary.fixableCount).toBe(1);
    expect(merged.summary.fileCount).toBe(1);
    expect(merged.summary.ruleFrequency).toEqual({ x: 2, y: 3 });
  });

  it('throws on an empty input', () => {
    expect(() => mergeReports([])).toThrow();
  });
});
