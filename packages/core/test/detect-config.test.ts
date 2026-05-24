import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectEslintConfig } from '../src/detect-config';

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
