import { describe, expect, it } from 'vitest';
import { applyEslintFix } from '../src/lib/apply-fix';

describe('applyEslintFix', () => {
  it('replaces the bytes within range with text', () => {
    const before = "const x = 'a';\n";
    const after = applyEslintFix(before, { range: [10, 13], text: "'b'" });
    expect(after).toBe("const x = 'b';\n");
  });

  it('handles a pure insert (start === end)', () => {
    const before = 'const x = 1\n';
    const after = applyEslintFix(before, { range: [11, 11], text: ';' });
    expect(after).toBe('const x = 1;\n');
  });

  it('handles a pure delete (text is empty)', () => {
    const before = 'a; b;\n';
    const after = applyEslintFix(before, { range: [1, 2], text: '' });
    expect(after).toBe('a b;\n');
  });

  it('handles a fix at the end of the file', () => {
    const before = 'foo()';
    const after = applyEslintFix(before, { range: [5, 5], text: ';\n' });
    expect(after).toBe('foo();\n');
  });

  it('handles a fix at the very start of the file', () => {
    const before = 'x = 1\n';
    const after = applyEslintFix(before, { range: [0, 0], text: 'const ' });
    expect(after).toBe('const x = 1\n');
  });

  it('preserves UTF-16 byte indexing (string slice is char-based, matches ESLint)', () => {
    // ESLint's `range` values are character offsets into the JS string (same
    // indexing String.prototype.slice uses), so a multi-byte char doesn't
    // throw off the math.
    const before = 'const é = 1';
    const after = applyEslintFix(before, { range: [6, 7], text: 'X' });
    expect(after).toBe('const X = 1');
  });
});
