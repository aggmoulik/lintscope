import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveLinterBin, resolveLinterVersion } from '../src/resolve-bin';

const ROOT = '/repo';

/** Build an `exists` predicate that returns true only for the given paths. */
function existsFor(...present: string[]) {
  const set = new Set(present);
  return (p: string) => set.has(p);
}

describe('resolveLinterBin', () => {
  it('returns the override verbatim when provided', () => {
    const res = resolveLinterBin(
      { projectRoot: ROOT, name: 'eslint', override: '/custom/eslint' },
      { exists: () => true, platform: 'linux' },
    );
    expect(res).toEqual({ command: '/custom/eslint', resolvedFrom: 'override' });
  });

  it('override wins even when a local install exists', () => {
    const local = path.join(ROOT, 'node_modules', '.bin', 'eslint');
    const res = resolveLinterBin(
      { projectRoot: ROOT, name: 'eslint', override: '/custom/eslint' },
      { exists: existsFor(local), platform: 'linux' },
    );
    expect(res.resolvedFrom).toBe('override');
    expect(res.command).toBe('/custom/eslint');
  });

  it('prefers the project-local node_modules/.bin install (posix)', () => {
    const local = path.join(ROOT, 'node_modules', '.bin', 'oxlint');
    const res = resolveLinterBin(
      { projectRoot: ROOT, name: 'oxlint' },
      { exists: existsFor(local), platform: 'linux' },
    );
    expect(res).toEqual({ command: local, resolvedFrom: 'local' });
  });

  it('falls back to the bare name on PATH when no local install exists', () => {
    const res = resolveLinterBin(
      { projectRoot: ROOT, name: 'biome' },
      { exists: () => false, platform: 'linux' },
    );
    expect(res).toEqual({ command: 'biome', resolvedFrom: 'path' });
  });

  it('probes the .cmd shim for a local install on Windows', () => {
    const localCmd = path.join(ROOT, 'node_modules', '.bin', 'eslint.cmd');
    const res = resolveLinterBin(
      { projectRoot: ROOT, name: 'eslint' },
      { exists: existsFor(localCmd), platform: 'win32' },
    );
    expect(res.resolvedFrom).toBe('local');
    expect(res.command).toBe(localCmd);
  });

  it('does not treat the extension-less name as a local install on Windows', () => {
    // Only the extension-less path "exists" — on Windows that is not spawnable,
    // so we must skip it and fall back to PATH.
    const bare = path.join(ROOT, 'node_modules', '.bin', 'eslint');
    const res = resolveLinterBin(
      { projectRoot: ROOT, name: 'eslint' },
      { exists: existsFor(bare), platform: 'win32' },
    );
    expect(res).toEqual({ command: 'eslint', resolvedFrom: 'path' });
  });
});

describe('resolveLinterVersion', () => {
  it('reads the version from the project node_modules package.json', () => {
    const v = resolveLinterVersion(ROOT, 'oxlint', {
      readPackageJson: () => ({ version: '1.66.0' }),
    });
    expect(v).toBe('1.66.0');
  });

  it('resolves the scoped-package path correctly', () => {
    let seen = '';
    resolveLinterVersion(ROOT, '@biomejs/biome', {
      readPackageJson: (p) => {
        seen = p;
        return { version: '1.8.3' };
      },
    });
    expect(seen).toBe(path.join(ROOT, 'node_modules', '@biomejs', 'biome', 'package.json'));
  });

  it('returns "unknown" when the package is not installed (read throws)', () => {
    const v = resolveLinterVersion(ROOT, 'eslint', {
      readPackageJson: () => {
        throw new Error('ENOENT');
      },
    });
    expect(v).toBe('unknown');
  });

  it('returns "unknown" when the version field is missing or non-string', () => {
    expect(resolveLinterVersion(ROOT, 'eslint', { readPackageJson: () => ({}) })).toBe('unknown');
    expect(resolveLinterVersion(ROOT, 'eslint', { readPackageJson: () => ({ version: 10 }) })).toBe(
      'unknown',
    );
  });
});
