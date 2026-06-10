import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildEslintArgs, type EslintLintResult, mapEslintResults } from '../src/linters/eslint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/eslint-results.json'), 'utf8'),
) as EslintLintResult[];

describe('mapEslintResults', () => {
  const ctx = { cwd: '/repo', eslintVersion: '9.15.0' };

  it('produces a schema-valid LintReport', () => {
    // mapEslintResults validates with Zod internally — throwing means schema drift.
    const report = mapEslintResults(FIXTURE, ctx);
    expect(report.schemaVersion).toBe('1.0');
    expect(report.linters[0]?.name).toBe('eslint');
    expect(report.linters[0]?.version).toBe('9.15.0');
  });

  it('counts errors, warnings, and fixable diagnostics correctly', () => {
    const report = mapEslintResults(FIXTURE, ctx);
    expect(report.summary.errorCount).toBe(2);
    expect(report.summary.warningCount).toBe(2);
    expect(report.summary.fixableCount).toBe(1);
    expect(report.summary.fileCount).toBe(3);
  });

  it('builds a per-rule frequency map (excluding null ruleIds)', () => {
    const report = mapEslintResults(FIXTURE, ctx);
    expect(report.summary.ruleFrequency).toEqual({
      'no-unused-vars': 1,
      'no-console': 1,
      'prefer-const': 1,
    });
  });

  it('maps severity 2 → "error" and severity 1 → "warning"', () => {
    const report = mapEslintResults(FIXTURE, ctx);
    const consoleDiag = report.diagnostics.find((d) => d.ruleId === 'no-console');
    const unusedDiag = report.diagnostics.find((d) => d.ruleId === 'no-unused-vars');
    expect(consoleDiag?.severity).toBe('error');
    expect(unusedDiag?.severity).toBe('warning');
  });

  it('keeps null ruleId for parser errors', () => {
    const report = mapEslintResults(FIXTURE, ctx);
    const parseError = report.diagnostics.find((d) => d.message.startsWith('Parsing error'));
    expect(parseError?.ruleId).toBeNull();
  });

  it('produces stable, deterministic diagnostic IDs', () => {
    const reportA = mapEslintResults(FIXTURE, ctx);
    const reportB = mapEslintResults(FIXTURE, ctx);
    expect(reportA.diagnostics.map((d) => d.id)).toEqual(reportB.diagnostics.map((d) => d.id));
    // Every ID is unique within the report
    const ids = reportA.diagnostics.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('computes relativePath from cwd', () => {
    const report = mapEslintResults(FIXTURE, ctx);
    expect(report.diagnostics[0]?.relativePath).toBe('src/unused.ts');
    expect(report.files.map((f) => f.relativePath)).toEqual([
      'src/unused.ts',
      'src/parse-error.ts',
      'src/with-suggestions.ts',
    ]);
  });

  it('passes through fix ranges', () => {
    const report = mapEslintResults(FIXTURE, ctx);
    const noConsole = report.diagnostics.find((d) => d.ruleId === 'no-console');
    expect(noConsole?.fix).toEqual({ range: [40, 60], text: '' });
  });

  it('passes through suggestions', () => {
    const report = mapEslintResults(FIXTURE, ctx);
    const preferConst = report.diagnostics.find((d) => d.ruleId === 'prefer-const');
    expect(preferConst?.suggestions).toHaveLength(1);
    expect(preferConst?.suggestions?.[0]?.desc).toBe("Replace 'let' with 'const'");
  });

  it('records configPath in the linter info when provided', () => {
    const report = mapEslintResults(FIXTURE, {
      ...ctx,
      configPath: '/repo/eslint.config.mjs',
    });
    expect(report.linters[0]?.configPath).toBe('/repo/eslint.config.mjs');
  });

  it('handles an empty result set without throwing', () => {
    const report = mapEslintResults([], ctx);
    expect(report.diagnostics).toEqual([]);
    expect(report.summary.fileCount).toBe(0);
    expect(report.summary.ruleFrequency).toEqual({});
  });
});

describe('buildEslintArgs', () => {
  it('always requests json format and tolerates unmatched patterns', () => {
    const args = buildEslintArgs(['.']);
    const fmt = args.indexOf('--format');
    expect(fmt).toBeGreaterThan(-1);
    expect(args[fmt + 1]).toBe('json');
    expect(args).toContain('--no-error-on-unmatched-pattern');
  });

  it('passes --config when a configPath is given', () => {
    const args = buildEslintArgs(['src'], '/repo/eslint.config.mjs');
    const i = args.indexOf('--config');
    expect(i).toBeGreaterThan(-1);
    expect(args[i + 1]).toBe('/repo/eslint.config.mjs');
  });

  it('omits --config when no configPath is given', () => {
    expect(buildEslintArgs(['.'])).not.toContain('--config');
  });

  it('appends all lint patterns last, in order', () => {
    const args = buildEslintArgs(['src', 'test']);
    expect(args.slice(-2)).toEqual(['src', 'test']);
  });
});
