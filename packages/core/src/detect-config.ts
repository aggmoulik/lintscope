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

const BIOME_CONFIG_NAMES = ['biome.json', 'biome.jsonc'];

export interface DetectedBiomeConfig {
  path: string;
}

/**
 * Find a Biome config (`biome.json` or `biome.jsonc`) in `cwd`. Biome itself
 * walks up the tree to find one, but for autodetect we only care about the
 * project root.
 */
export function detectBiomeConfig(cwd: string): DetectedBiomeConfig | null {
  for (const name of BIOME_CONFIG_NAMES) {
    const p = path.join(cwd, name);
    if (existsSync(p)) return { path: p };
  }
  return null;
}

export type DetectedLinter =
  | { linter: 'biome'; config: DetectedBiomeConfig }
  | { linter: 'eslint'; config: DetectedEslintConfig };

/**
 * Pick the linter for a project based on which config files exist. Biome wins
 * over ESLint when both are present (a project that has both is most likely
 * migrating to Biome and wants Biome's output).
 */
export function detectLinter(cwd: string): DetectedLinter | null {
  const biome = detectBiomeConfig(cwd);
  if (biome) return { linter: 'biome', config: biome };
  const eslint = detectEslintConfig(cwd);
  if (eslint) return { linter: 'eslint', config: eslint };
  return null;
}
