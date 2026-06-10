import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectLinter, detectLinters } from '../src/detect-config';

// Per-linter config detection (detectEslintConfig & co.) is tested in
// @lintscope/adapters — these tests cover the registry-driven orchestration.

describe('detectLinter', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'lintscope-detect-linter-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when no linter config is found', () => {
    expect(detectLinter(dir)).toBeNull();
  });

  it('picks biome when only biome config exists', () => {
    writeFileSync(path.join(dir, 'biome.json'), '{}');
    expect(detectLinter(dir)?.linter).toBe('biome');
  });

  it('picks eslint when only eslint config exists', () => {
    writeFileSync(path.join(dir, 'eslint.config.mjs'), 'export default [];');
    expect(detectLinter(dir)?.linter).toBe('eslint');
  });

  it('prefers biome when biome + eslint configs exist', () => {
    writeFileSync(path.join(dir, 'biome.json'), '{}');
    writeFileSync(path.join(dir, 'eslint.config.mjs'), 'export default [];');
    expect(detectLinter(dir)?.linter).toBe('biome');
  });

  it('prefers oxc over biome + eslint when all three configs exist', () => {
    writeFileSync(path.join(dir, '.oxlintrc.json'), '{}');
    writeFileSync(path.join(dir, 'biome.json'), '{}');
    writeFileSync(path.join(dir, 'eslint.config.mjs'), 'export default [];');
    expect(detectLinter(dir)?.linter).toBe('oxc');
  });
});

describe('detectLinters', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'lintscope-detect-all-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns an empty array when no linter config exists', () => {
    expect(detectLinters(dir)).toEqual([]);
  });

  it('returns the single linter when only one config exists', () => {
    writeFileSync(path.join(dir, 'biome.json'), '{}');
    expect(detectLinters(dir).map((d) => d.linter)).toEqual(['biome']);
  });

  it('returns ALL configured linters (not just the highest-precedence one)', () => {
    writeFileSync(path.join(dir, '.oxlintrc.json'), '{}');
    writeFileSync(path.join(dir, 'biome.json'), '{}');
    writeFileSync(path.join(dir, 'eslint.config.mjs'), 'export default [];');
    // Order is adapter priority order (oxc > biome > eslint) — the default focus.
    expect(detectLinters(dir).map((d) => d.linter)).toEqual(['oxc', 'biome', 'eslint']);
  });

  it('returns a subset in precedence order (oxc + eslint, no biome)', () => {
    writeFileSync(path.join(dir, '.oxlintrc.json'), '{}');
    writeFileSync(path.join(dir, 'eslint.config.mjs'), 'export default [];');
    expect(detectLinters(dir).map((d) => d.linter)).toEqual(['oxc', 'eslint']);
  });

  it('carries each linter config path', () => {
    writeFileSync(path.join(dir, 'biome.json'), '{}');
    const biome = detectLinters(dir).find((d) => d.linter === 'biome');
    expect(biome?.config.path).toBe(path.join(dir, 'biome.json'));
  });
});
