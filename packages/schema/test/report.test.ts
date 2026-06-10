import { describe, expect, it } from 'vitest';
import { LintReportSchema } from '../src/report';
import { SCHEMA_VERSION } from '../src/version';

const makeReport = (overrides: Partial<Record<string, unknown>> = {}) => ({
  schemaVersion: SCHEMA_VERSION,
  generatedAt: '2026-05-23T10:00:00.000Z',
  projectRoot: '/repo',
  linters: [{ name: 'eslint', version: '9.15.0' }],
  files: [{ path: '/repo/src/a.ts', relativePath: 'src/a.ts', errorCount: 1, warningCount: 0 }],
  diagnostics: [],
  summary: {
    errorCount: 1,
    warningCount: 0,
    fixableCount: 0,
    fileCount: 1,
    ruleFrequency: { 'no-unused-vars': 1 },
  },
  ...overrides,
});

describe('LintReportSchema', () => {
  it('accepts a well-formed empty-diagnostics report', () => {
    expect(() => LintReportSchema.parse(makeReport())).not.toThrow();
  });

  it('rejects a report with the wrong schemaVersion literal', () => {
    expect(() => LintReportSchema.parse(makeReport({ schemaVersion: '0.9' }))).toThrow();
    expect(() => LintReportSchema.parse(makeReport({ schemaVersion: '2.0' }))).toThrow();
  });

  it('rejects a non-ISO generatedAt', () => {
    expect(() => LintReportSchema.parse(makeReport({ generatedAt: 'last tuesday' }))).toThrow();
  });

  it('requires at least one linter entry', () => {
    expect(() => LintReportSchema.parse(makeReport({ linters: [] }))).toThrow();
  });

  it('accepts a linter entry with display meta (additive 1.x field)', () => {
    const report = makeReport({
      linters: [
        {
          name: 'stylelint',
          version: '16.26.1',
          meta: {
            label: 'Stylelint',
            logoSlug: 'stylelint',
            docsUrl: 'https://stylelint.io',
            fixCommand: 'stylelint --fix',
          },
        },
      ],
    });
    const parsed = LintReportSchema.parse(report);
    expect(parsed.linters[0]?.meta?.label).toBe('Stylelint');
    expect(parsed.linters[0]?.meta?.fixCommand).toBe('stylelint --fix');
  });

  it('accepts meta with only the required label (all other fields optional)', () => {
    const report = makeReport({
      linters: [{ name: 'hypothetlint', version: '1.0.0', meta: { label: 'Hypothetlint' } }],
    });
    expect(() => LintReportSchema.parse(report)).not.toThrow();
  });

  it('still accepts linter entries WITHOUT meta (pre-meta reports)', () => {
    expect(() => LintReportSchema.parse(makeReport())).not.toThrow();
  });

  it('rejects meta with an empty label', () => {
    const report = makeReport({
      linters: [{ name: 'x', version: '1.0.0', meta: { label: '' } }],
    });
    expect(() => LintReportSchema.parse(report)).toThrow();
  });

  it('rejects negative counts in summary', () => {
    expect(() =>
      LintReportSchema.parse(
        makeReport({
          summary: {
            errorCount: -1,
            warningCount: 0,
            fixableCount: 0,
            fileCount: 0,
            ruleFrequency: {},
          },
        }),
      ),
    ).toThrow();
  });
});
