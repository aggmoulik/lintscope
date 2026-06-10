import { existsSync } from 'node:fs';
import path from 'node:path';

// cosmiconfig search order (minus the package.json `stylelint` key, which we
// skip — detecting it would require parsing every project's package.json).
const STYLELINT_CONFIG_NAMES = [
  '.stylelintrc',
  '.stylelintrc.json',
  '.stylelintrc.yaml',
  '.stylelintrc.yml',
  '.stylelintrc.js',
  '.stylelintrc.cjs',
  '.stylelintrc.mjs',
  'stylelint.config.js',
  'stylelint.config.cjs',
  'stylelint.config.mjs',
];

export interface DetectedStylelintConfig {
  path: string;
}

/** Find a stylelint config in `cwd`, in cosmiconfig preference order. */
export function detectStylelintConfig(cwd: string): DetectedStylelintConfig | null {
  for (const name of STYLELINT_CONFIG_NAMES) {
    const p = path.join(cwd, name);
    if (existsSync(p)) return { path: p };
  }
  return null;
}
