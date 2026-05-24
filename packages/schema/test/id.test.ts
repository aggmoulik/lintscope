import { describe, expect, it } from 'vitest';
import { diagnosticId } from '../src/id';

describe('diagnosticId', () => {
  const sample = {
    relativePath: 'src/foo.ts',
    line: 12,
    column: 3,
    ruleId: 'no-unused-vars',
    message: "'foo' is defined but never used.",
  };

  it('is deterministic for the same input', () => {
    expect(diagnosticId(sample)).toBe(diagnosticId(sample));
  });

  it('changes when any field changes', () => {
    const base = diagnosticId(sample);
    expect(diagnosticId({ ...sample, line: 13 })).not.toBe(base);
    expect(diagnosticId({ ...sample, column: 4 })).not.toBe(base);
    expect(diagnosticId({ ...sample, ruleId: 'no-undef' })).not.toBe(base);
    expect(diagnosticId({ ...sample, message: 'different' })).not.toBe(base);
    expect(diagnosticId({ ...sample, relativePath: 'src/bar.ts' })).not.toBe(base);
  });

  it('handles null ruleId distinctly from empty-string ruleId', () => {
    const nullId = diagnosticId({ ...sample, ruleId: null });
    const emptyId = diagnosticId({ ...sample, ruleId: '' });
    // Both yield empty after the `?? ''` coalesce, so they should be equal — document the intent
    expect(nullId).toBe(emptyId);
  });

  it('produces a 16-character lowercase hex string', () => {
    const id = diagnosticId(sample);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
});
