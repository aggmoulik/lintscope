import type { LintReport } from '@lintscope/schema';
import { describe, expect, it } from 'vitest';
import { deriveLinterMeta, resolveLinterMeta } from '../src/lib/linter-meta';

function makeReport(overrides: Partial<LintReport> = {}): LintReport {
  return {
    schemaVersion: '1.0',
    generatedAt: '2026-06-10T10:00:00.000Z',
    projectRoot: '/repo',
    linters: [{ name: 'eslint', version: '9.15.0' }],
    files: [],
    diagnostics: [],
    summary: { errorCount: 0, warningCount: 0, fixableCount: 0, fileCount: 0, ruleFrequency: {} },
    ...overrides,
  } as LintReport;
}

describe('resolveLinterMeta', () => {
  it('prefers report-borne meta over built-in knowledge', () => {
    const report = makeReport({
      linters: [
        {
          name: 'eslint',
          version: '9.15.0',
          meta: { label: 'ESLint (custom)', fixCommand: 'eslint --fix --cache' },
        },
      ],
    });
    const meta = resolveLinterMeta(report);
    expect(meta.eslint?.label).toBe('ESLint (custom)');
    expect(meta.eslint?.fixCommand).toBe('eslint --fix --cache');
  });

  it('treats report meta as authoritative: absent fixCommand means NO autofix', () => {
    // The adapter said "no fix command" — the builtin fallback must not resurrect one.
    const report = makeReport({
      linters: [{ name: 'eslint', version: '9.15.0', meta: { label: 'ESLint' } }],
    });
    expect(resolveLinterMeta(report).eslint?.fixCommand).toBeNull();
  });

  it('falls back to built-in meta for pre-meta reports', () => {
    const report = makeReport(); // no meta on the eslint entry
    const meta = resolveLinterMeta(report);
    expect(meta.eslint?.label).toBe('ESLint');
    expect(meta.eslint?.logoSlug).toBe('eslint');
    expect(meta.eslint?.fixCommand).toBe('eslint --fix');
  });

  it('derives complete meta for a linter it has never heard of', () => {
    const report = makeReport({
      linters: [{ name: 'hypothetlint', version: '1.0.0' }],
    });
    const meta = resolveLinterMeta(report).hypothetlint;
    expect(meta?.label).toBe('hypothetlint');
    expect(meta?.tone).toBeTruthy();
    expect(meta?.logoSlug).toBeNull();
    expect(meta?.fixCommand).toBeNull();
  });

  it('covers diagnostic sources missing from linters[] (defensive completeness)', () => {
    const report = makeReport({
      diagnostics: [
        {
          id: 'x1',
          filePath: '/repo/a.ts',
          relativePath: 'a.ts',
          line: 1,
          column: 1,
          ruleId: 'r',
          severity: 'error',
          message: 'm',
          source: 'mysterylint',
        },
      ],
    });
    expect(resolveLinterMeta(report).mysterylint?.label).toBe('mysterylint');
  });
});

describe('deriveLinterMeta', () => {
  it('is deterministic: same unknown source always gets the same tone', () => {
    expect(deriveLinterMeta('quicklint').tone).toBe(deriveLinterMeta('quicklint').tone);
  });

  it('returns a fully-populated object (no undefined fields)', () => {
    const meta = deriveLinterMeta('whatever');
    expect(meta.label).toBe('whatever');
    expect(meta.tone).toBeTruthy();
    expect(meta.logoSlug).toBeNull();
    expect(meta.docsUrl).toBeNull();
    expect(meta.fixCommand).toBeNull();
  });
});
