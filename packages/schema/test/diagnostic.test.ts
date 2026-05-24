import { describe, expect, it } from 'vitest';
import { DiagnosticSchema, SeveritySchema } from '../src/diagnostic';

describe('SeveritySchema', () => {
  it('accepts the three known severities', () => {
    expect(SeveritySchema.parse('error')).toBe('error');
    expect(SeveritySchema.parse('warning')).toBe('warning');
    expect(SeveritySchema.parse('info')).toBe('info');
  });

  it('rejects unknown severities', () => {
    expect(() => SeveritySchema.parse('fatal')).toThrow();
  });
});

describe('DiagnosticSchema', () => {
  const valid = {
    id: 'a1b2c3d4e5f60718',
    filePath: '/repo/src/foo.ts',
    relativePath: 'src/foo.ts',
    line: 12,
    column: 3,
    endLine: 12,
    endColumn: 18,
    ruleId: 'no-unused-vars',
    severity: 'warning' as const,
    message: "'foo' is defined but never used.",
    source: 'eslint',
  };

  it('accepts a minimal diagnostic', () => {
    const minimal = {
      id: 'x',
      filePath: '/a',
      relativePath: 'a',
      line: 1,
      column: 1,
      ruleId: null,
      severity: 'error' as const,
      message: 'Parsing error',
      source: 'eslint',
    };
    expect(() => DiagnosticSchema.parse(minimal)).not.toThrow();
  });

  it('accepts a fully-populated diagnostic', () => {
    const parsed = DiagnosticSchema.parse({
      ...valid,
      category: 'lint/correctness',
      url: 'https://eslint.org/docs/rules/no-unused-vars',
      fix: { range: [120, 135], text: '', description: 'Remove unused' },
      suggestions: [{ desc: 'Use it', fix: { range: [120, 120], text: 'console.log(foo)' } }],
    });
    expect(parsed.ruleId).toBe('no-unused-vars');
    expect(parsed.fix?.range).toEqual([120, 135]);
    expect(parsed.suggestions).toHaveLength(1);
  });

  it('rejects non-positive line numbers', () => {
    expect(() => DiagnosticSchema.parse({ ...valid, line: 0 })).toThrow();
    expect(() => DiagnosticSchema.parse({ ...valid, line: -1 })).toThrow();
  });

  it('rejects malformed URL on rule docs', () => {
    expect(() => DiagnosticSchema.parse({ ...valid, url: 'not-a-url' })).toThrow();
  });

  it('allows ruleId to be null (parser errors etc.)', () => {
    const parsed = DiagnosticSchema.parse({ ...valid, ruleId: null });
    expect(parsed.ruleId).toBeNull();
  });

  it('accepts unknown sources as plain strings (forward-compat)', () => {
    const parsed = DiagnosticSchema.parse({ ...valid, source: 'deno-lint' });
    expect(parsed.source).toBe('deno-lint');
  });
});
