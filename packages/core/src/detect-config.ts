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

const OXC_CONFIG_NAMES = ['.oxlintrc.json', 'oxlintrc.json'];

export interface DetectedOxcConfig {
  path: string;
}

/**
 * Find an oxlint config (`.oxlintrc.json` preferred, `oxlintrc.json` accepted).
 */
export function detectOxcConfig(cwd: string): DetectedOxcConfig | null {
  for (const name of OXC_CONFIG_NAMES) {
    const p = path.join(cwd, name);
    if (existsSync(p)) return { path: p };
  }
  return null;
}

export type DetectedLinter =
  | { linter: 'oxc'; config: DetectedOxcConfig }
  | { linter: 'biome'; config: DetectedBiomeConfig }
  | { linter: 'eslint'; config: DetectedEslintConfig };

/**
 * Pick the linter for a project based on which config files exist.
 * Precedence: oxc > biome > eslint. The reasoning is migration intent — a
 * project that has switched to the faster, newer tool wants its output.
 * Explicit `--linter` flags will override this default (tracked for v1.x).
 */
export function detectLinter(cwd: string): DetectedLinter | null {
  const oxc = detectOxcConfig(cwd);
  if (oxc) return { linter: 'oxc', config: oxc };
  const biome = detectBiomeConfig(cwd);
  if (biome) return { linter: 'biome', config: biome };
  const eslint = detectEslintConfig(cwd);
  if (eslint) return { linter: 'eslint', config: eslint };
  return null;
}
