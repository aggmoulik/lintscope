import { existsSync } from 'node:fs';
import path from 'node:path';

const FLAT_CONFIG_NAMES = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
];

const LEGACY_CONFIG_NAMES = [
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml',
];

export interface DetectedEslintConfig {
  kind: 'flat' | 'legacy';
  path: string;
}

/**
 * Find an ESLint config in `cwd`. Returns the first match in preference order:
 * flat config first (eslint.config.{js,mjs,cjs,ts}), then legacy (.eslintrc.*).
 *
 * Returns `null` if no config is found. Callers should error with a hint
 * rather than guessing.
 */
export function detectEslintConfig(cwd: string): DetectedEslintConfig | null {
  for (const name of FLAT_CONFIG_NAMES) {
    const p = path.join(cwd, name);
    if (existsSync(p)) return { kind: 'flat', path: p };
  }
  for (const name of LEGACY_CONFIG_NAMES) {
    const p = path.join(cwd, name);
    if (existsSync(p)) return { kind: 'legacy', path: p };
  }
  return null;
}
