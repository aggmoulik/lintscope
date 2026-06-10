import { existsSync } from 'node:fs';
import path from 'node:path';

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
