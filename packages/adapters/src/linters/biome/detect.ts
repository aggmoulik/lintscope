import { existsSync } from 'node:fs';
import path from 'node:path';

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
