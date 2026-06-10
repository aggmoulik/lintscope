import type { LinterAdapter } from '../../types';
import type { BiomeReport } from './api-types';
import { detectBiomeConfig } from './detect';
import { mapBiomeResults } from './mapper';

/**
 * Biome adapter. Spawns `biome lint --reporter=json` — `lint`, not `check`,
 * so lintscope shows lint-rule violations only (consistent with the
 * eslint/oxlint adapters) rather than `check`'s formatter + import-sort diffs.
 *
 * Biome discovers its own config by walking up from cwd, so `configPath` is
 * not forwarded to the CLI args or the report (faithful to the pre-registry
 * behavior).
 */
export const biomeAdapter: LinterAdapter<BiomeReport> = {
  name: 'biome',
  meta: {
    label: 'Biome',
    logoSlug: 'biome',
    docsUrl: 'https://biomejs.dev',
    fixCommand: 'biome lint --write',
  },
  priority: 20,
  bin: 'biome',
  pkgName: '@biomejs/biome',
  defaultPatterns: ['.'],
  installHint: 'pnpm add -D @biomejs/biome',
  okExitCodes: [0, 1],
  detect: detectBiomeConfig,
  buildArgs: ({ patterns }) => ['lint', '--reporter=json', ...patterns],
  map: (payload, ctx) => mapBiomeResults(payload, { cwd: ctx.cwd, biomeVersion: ctx.version }),
};
