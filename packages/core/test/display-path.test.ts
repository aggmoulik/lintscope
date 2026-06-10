import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { relativeDisplayPath, toPosix } from '../src/display-path';

describe('toPosix', () => {
  it('converts Windows separators to forward slashes', () => {
    expect(toPosix('src\\util.ts', path.win32)).toBe('src/util.ts');
    expect(toPosix('apps\\web\\src', path.win32)).toBe('apps/web/src');
  });

  it('leaves POSIX paths untouched', () => {
    expect(toPosix('src/util.ts', path.posix)).toBe('src/util.ts');
  });
});

describe('relativeDisplayPath', () => {
  it('computes a forward-slash relative path on Windows', () => {
    expect(relativeDisplayPath('C:\\repo', 'C:\\repo\\src\\util.ts', path.win32)).toBe(
      'src/util.ts',
    );
  });

  it('handles drive-less absolute inputs the way adapters receive them on Windows', () => {
    // Adapter tests (and some linter outputs) use '/repo'-style paths; win32
    // path.relative still produces a backslash relative path for these.
    expect(relativeDisplayPath('/repo', '/repo/src/util.ts', path.win32)).toBe('src/util.ts');
  });

  it('computes a relative path on POSIX', () => {
    expect(relativeDisplayPath('/repo', '/repo/src/util.ts', path.posix)).toBe('src/util.ts');
  });

  it('falls back to the basename when the target equals the base', () => {
    expect(relativeDisplayPath('/repo/src/util.ts', '/repo/src/util.ts', path.posix)).toBe(
      'util.ts',
    );
  });
});
