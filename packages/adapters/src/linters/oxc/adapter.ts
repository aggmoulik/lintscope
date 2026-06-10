import type { LinterAdapter } from '../../types';
import type { OxcReport } from './api-types';
import { detectOxcConfig } from './detect';
import { mapOxcResults } from './mapper';

/**
 * OXC (oxlint) adapter. Spawns `oxlint --format=json`. Highest detection
 * priority of the built-ins — a project that has adopted the newest, fastest
 * tool wants its output focused first.
 *
 * oxlint discovers `.oxlintrc.json` itself, so `configPath` is not forwarded
 * (faithful to the pre-registry behavior).
 */
export const oxcAdapter: LinterAdapter<OxcReport> = {
  name: 'oxc',
  meta: { label: 'OXC', logoSlug: 'oxc', docsUrl: 'https://oxc.rs', fixCommand: 'oxlint --fix' },
  priority: 10,
  bin: 'oxlint',
  pkgName: 'oxlint',
  defaultPatterns: ['.'],
  installHint: 'pnpm add -D oxlint',
  okExitCodes: [0, 1],
  detect: detectOxcConfig,
  buildArgs: ({ patterns }) => ['--format=json', ...patterns],
  map: (payload, ctx) => mapOxcResults(payload, { cwd: ctx.cwd, oxcVersion: ctx.version }),
};
