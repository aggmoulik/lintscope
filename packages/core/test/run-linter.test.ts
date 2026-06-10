import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DetectedLinter } from '../src/detect-config';
import { resolveLinterChoice, resolveLintScope } from '../src/run-linter';

const eslintDetected: DetectedLinter = {
  linter: 'eslint',
  config: { kind: 'flat', path: '/p/eslint.config.mjs' },
};
const oxcDetected: DetectedLinter = {
  linter: 'oxc',
  config: { path: '/p/.oxlintrc.json' },
};

describe('resolveLinterChoice', () => {
  it('uses the detected linter and carries its config path', () => {
    expect(resolveLinterChoice('/p', undefined, () => eslintDetected)).toEqual({
      linter: 'eslint',
      configPath: '/p/eslint.config.mjs',
    });
  });

  it('honors an explicit override and drops a mismatched detected config', () => {
    // Override biome while eslint is detected — the eslint configPath must not leak.
    expect(resolveLinterChoice('/p', 'biome', () => eslintDetected)).toEqual({ linter: 'biome' });
  });

  it('keeps the config path when the override matches what was detected', () => {
    expect(resolveLinterChoice('/p', 'oxc', () => oxcDetected)).toEqual({
      linter: 'oxc',
      configPath: '/p/.oxlintrc.json',
    });
  });

  it('falls back to the override when nothing is detected', () => {
    expect(resolveLinterChoice('/p', 'biome', () => null)).toEqual({ linter: 'biome' });
  });

  it('throws a clear error when no linter is detected and no override is given', () => {
    expect(() => resolveLinterChoice('/p', undefined, () => null)).toThrow(/No linter detected/);
  });
});

describe('resolveLintScope', () => {
  // resolveLintScope path.resolve()s the cwd before walking up, so the fake
  // root must be platform-resolved too ('/repo' becomes 'D:\repo' on Windows).
  const ROOT = path.resolve('/repo');

  // detect() that only finds oxc at the root, nowhere else (root config).
  const oxcAtRoot = (dir: string): DetectedLinter | null =>
    dir === ROOT ? { linter: 'oxc', config: { path: '/repo/.oxlintrc.json' } } : null;

  it('config at cwd, no targets → whole project (no patterns)', () => {
    const scope = resolveLintScope({ cwd: ROOT }, oxcAtRoot);
    expect(scope).toEqual({
      projectRoot: ROOT,
      linter: 'oxc',
      configPath: '/repo/.oxlintrc.json',
    });
  });

  it('walks up to the config root and scopes to the sub-path when run from a sub-package', () => {
    const scope = resolveLintScope({ cwd: path.join(ROOT, 'apps/web') }, oxcAtRoot);
    expect(scope.projectRoot).toBe(ROOT);
    expect(scope.linter).toBe('oxc');
    expect(scope.patterns).toEqual(['apps/web']);
  });

  it('uses explicit targets relative to the config root (run from root)', () => {
    const scope = resolveLintScope({ cwd: ROOT, targets: ['apps/web'] }, oxcAtRoot);
    expect(scope.projectRoot).toBe(ROOT);
    expect(scope.patterns).toEqual(['apps/web']);
  });

  it('resolves explicit targets relative to cwd, expressed against the config root', () => {
    const scope = resolveLintScope(
      { cwd: path.join(ROOT, 'apps/web'), targets: ['src'] },
      oxcAtRoot,
    );
    expect(scope.projectRoot).toBe(ROOT);
    expect(scope.patterns).toEqual(['apps/web/src']);
  });

  it('honors an explicit linter override', () => {
    const scope = resolveLintScope({ cwd: ROOT, linter: 'biome' }, oxcAtRoot);
    // override differs from detected oxc → no oxc configPath leaks
    expect(scope.linter).toBe('biome');
    expect(scope.configPath).toBeUndefined();
  });

  it('throws when no config is found in cwd or any ancestor and no override', () => {
    expect(() => resolveLintScope({ cwd: path.join(ROOT, 'apps/web') }, () => null)).toThrow(
      /No linter detected/,
    );
  });
});
