import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  detectBiomeConfig,
  detectEslintConfig,
  detectLinter,
  detectOxcConfig,
} from '../src/detect-config';

describe('detectEslintConfig', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'lintscope-detect-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when no config exists', () => {
    expect(detectEslintConfig(dir)).toBeNull();
  });

  it('detects flat config when only flat config exists', () => {
    writeFileSync(path.join(dir, 'eslint.config.mjs'), 'export default [];');
    const detected = detectEslintConfig(dir);
    expect(detected?.kind).toBe('flat');
    expect(detected?.path).toBe(path.join(dir, 'eslint.config.mjs'));
  });

  it('detects legacy config when only legacy exists', () => {
    writeFileSync(path.join(dir, '.eslintrc.json'), '{}');
    const detected = detectEslintConfig(dir);
    expect(detected?.kind).toBe('legacy');
    expect(detected?.path).toBe(path.join(dir, '.eslintrc.json'));
  });

  it('prefers flat config when both exist', () => {
    writeFileSync(path.join(dir, 'eslint.config.js'), 'module.exports = [];');
    writeFileSync(path.join(dir, '.eslintrc.json'), '{}');
    const detected = detectEslintConfig(dir);
    expect(detected?.kind).toBe('flat');
  });

  it('prefers .js > .mjs > .cjs > .ts for flat config (declared order)', () => {
    writeFileSync(path.join(dir, 'eslint.config.cjs'), 'module.exports = [];');
    writeFileSync(path.join(dir, 'eslint.config.mjs'), 'export default [];');
    const detected = detectEslintConfig(dir);
    // eslint.config.js > .mjs > .cjs > .ts in our detection order
    expect(detected?.path).toBe(path.join(dir, 'eslint.config.mjs'));
  });
});

describe('detectBiomeConfig', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'lintscope-detect-biome-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when no biome config exists', () => {
    expect(detectBiomeConfig(dir)).toBeNull();
  });

  it('detects biome.json', () => {
    writeFileSync(path.join(dir, 'biome.json'), '{}');
    expect(detectBiomeConfig(dir)?.path).toBe(path.join(dir, 'biome.json'));
  });

  it('detects biome.jsonc', () => {
    writeFileSync(path.join(dir, 'biome.jsonc'), '{}');
    expect(detectBiomeConfig(dir)?.path).toBe(path.join(dir, 'biome.jsonc'));
  });

  it('prefers biome.json over biome.jsonc when both exist', () => {
    writeFileSync(path.join(dir, 'biome.json'), '{}');
    writeFileSync(path.join(dir, 'biome.jsonc'), '{}');
    expect(detectBiomeConfig(dir)?.path).toBe(path.join(dir, 'biome.json'));
  });
});

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

describe('detectOxcConfig', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'lintscope-detect-oxc-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when no oxlint config exists', () => {
    expect(detectOxcConfig(dir)).toBeNull();
  });

  it('detects .oxlintrc.json', () => {
    writeFileSync(path.join(dir, '.oxlintrc.json'), '{}');
    expect(detectOxcConfig(dir)?.path).toBe(path.join(dir, '.oxlintrc.json'));
  });

  it('detects oxlintrc.json without the leading dot', () => {
    writeFileSync(path.join(dir, 'oxlintrc.json'), '{}');
    expect(detectOxcConfig(dir)?.path).toBe(path.join(dir, 'oxlintrc.json'));
  });

  it('prefers the dotfile when both exist', () => {
    writeFileSync(path.join(dir, '.oxlintrc.json'), '{}');
    writeFileSync(path.join(dir, 'oxlintrc.json'), '{}');
    expect(detectOxcConfig(dir)?.path).toBe(path.join(dir, '.oxlintrc.json'));
  });
});
