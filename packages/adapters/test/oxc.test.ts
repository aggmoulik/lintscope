import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mapOxcResults, type OxcReport } from '../src/linters/oxc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/oxc-results.json'), 'utf8'),
) as OxcReport;

// Captured from a real `oxlint --format=json` run — oxlint's JSON exposes no
// per-diagnostic fix info, so every mapped diagnostic must have `fixable`
// undefined (we must never guess fixability for oxc).
const OXC_FIXABLE = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/oxc-fixable.json'), 'utf8'),
) as OxcReport;

describe('mapOxcResults — fixability', () => {
  it('never marks oxc diagnostics fixable (oxlint JSON omits fix info)', () => {
    const report = mapOxcResults(OXC_FIXABLE, { cwd: '/repo', oxcVersion: '1.66.0' });
    expect(report.diagnostics.length).toBeGreaterThan(0);
    expect(report.diagnostics.every((d) => d.fixable === undefined)).toBe(true);
    expect(report.summary.fixableCount).toBe(0);
  });
});

describe('mapOxcResults', () => {
  const ctx = { cwd: '/repo', oxcVersion: '0.13.0' };

  it('produces a schema-valid LintReport with source=oxc', () => {
    const report = mapOxcResults(FIXTURE, ctx);
    expect(report.schemaVersion).toBe('1.0');
    expect(report.linters[0]?.name).toBe('oxc');
    expect(report.diagnostics.every((d) => d.source === 'oxc')).toBe(true);
  });

  it('counts errors and warnings from diagnostic severities', () => {
    const report = mapOxcResults(FIXTURE, ctx);
    expect(report.summary.errorCount).toBe(2);
    expect(report.summary.warningCount).toBe(1);
    expect(report.summary.fileCount).toBe(3);
  });

  it('builds the rule frequency map, namespacing by scope when present', () => {
    const report = mapOxcResults(FIXTURE, ctx);
    expect(report.summary.ruleFrequency).toEqual({
      'eslint/no-debugger': 2,
      'eslint/no-console': 1,
      'eslint/prefer-const': 1,
    });
  });

  it('maps severity "advice" / "hint" to info', () => {
    const synthetic: OxcReport = {
      diagnostics: [
        { severity: 'advice', code: 'a', filename: 'x.ts' },
        { severity: 'hint', code: 'b', filename: 'x.ts' },
      ],
    };
    const report = mapOxcResults(synthetic, ctx);
    expect(report.diagnostics.map((d) => d.severity)).toEqual(['info', 'info']);
  });

  it('accepts both `filename` and `file` for the path field', () => {
    const synthetic: OxcReport = {
      diagnostics: [
        { severity: 'error', code: 'x', filename: 'a.ts' },
        { severity: 'error', code: 'x', file: 'b.ts' },
      ],
    };
    const report = mapOxcResults(synthetic, ctx);
    expect(report.diagnostics.map((d) => d.relativePath)).toEqual(['a.ts', 'b.ts']);
  });

  it('reads line/column from labels[0] when available', () => {
    const report = mapOxcResults(FIXTURE, ctx);
    const debugger1 = report.diagnostics.find(
      (d) => d.ruleId === 'eslint/no-debugger' && d.line === 2,
    );
    expect(debugger1?.column).toBe(3);
    expect(debugger1?.endLine).toBe(2);
    expect(debugger1?.endColumn).toBe(12);
  });

  it('reads line/column nested inside label.span (oxlint 1.x format)', () => {
    // Real oxlint 1.66.0 nests line/column INSIDE `labels[0].span`, not at the
    // label top level. Captured from `oxlint --format=json` on a real project.
    const synthetic: OxcReport = {
      diagnostics: [
        {
          severity: 'warning',
          code: 'eslint(no-constant-binary-expression)',
          message: 'Unexpected constant nullishness',
          filename: 'src/form.tsx',
          labels: [{ span: { offset: 4482, length: 33, line: 159, column: 37 } }],
        },
      ],
    };
    const report = mapOxcResults(synthetic, ctx);
    expect(report.diagnostics[0]?.line).toBe(159);
    expect(report.diagnostics[0]?.column).toBe(37);
  });

  it('falls back to line/column 1/1 when labels are missing (advice diagnostics)', () => {
    const report = mapOxcResults(FIXTURE, ctx);
    const advice = report.diagnostics.find((d) => d.ruleId === 'eslint/prefer-const');
    expect(advice?.line).toBe(1);
    expect(advice?.column).toBe(1);
  });

  it('falls back to label.message → ruleId when top-level message is missing', () => {
    const synthetic: OxcReport = {
      diagnostics: [
        {
          severity: 'error',
          code: 'no-bar',
          filename: 'x.ts',
          labels: [{ message: 'from label' }],
        },
        {
          severity: 'error',
          code: 'no-baz',
          filename: 'x.ts',
        },
      ],
    };
    const report = mapOxcResults(synthetic, ctx);
    expect(report.diagnostics[0]?.message).toBe('from label');
    expect(report.diagnostics[1]?.message).toBe('no-baz');
  });

  it('skips diagnostics with no path field at all', () => {
    const synthetic: OxcReport = {
      diagnostics: [{ severity: 'error', code: 'orphan' }],
    };
    expect(mapOxcResults(synthetic, ctx).diagnostics).toHaveLength(0);
  });

  it('handles an empty payload', () => {
    expect(mapOxcResults({}, ctx).diagnostics).toEqual([]);
  });

  it('respects an already-namespaced code (does not double-prefix scope)', () => {
    const synthetic: OxcReport = {
      diagnostics: [
        {
          severity: 'error',
          code: 'typescript/no-explicit-any',
          scope: 'typescript',
          filename: 'x.ts',
        },
      ],
    };
    expect(mapOxcResults(synthetic, ctx).diagnostics[0]?.ruleId).toBe('typescript/no-explicit-any');
  });

  it('passes configPath through to the linter info', () => {
    const report = mapOxcResults(FIXTURE, { ...ctx, configPath: '/repo/.oxlintrc.json' });
    expect(report.linters[0]?.configPath).toBe('/repo/.oxlintrc.json');
  });
});
