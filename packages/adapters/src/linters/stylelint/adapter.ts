import type { LinterAdapter } from '../../types';
import type { StylelintResult } from './api-types';
import { detectStylelintConfig } from './detect';
import { mapStylelintResults } from './mapper';

const STYLE_GLOB = '**/*.{css,scss,sass,less}';

/** True for patterns that are bare directories (no glob magic, no extension). */
function isBareDirectory(pattern: string): boolean {
  return !/[*?[\]{}]/.test(pattern) && !/\.[a-z0-9]+$/i.test(pattern);
}

/**
 * Build the `stylelint` CLI args. Pure — exported for testing.
 *
 * stylelint lints globs/files, never directories — so `.` and bare directory
 * patterns (which the monorepo scope walk-up produces, e.g. 'apps/web') are
 * expanded into stylesheet globs. `--allow-empty-input` keeps a scope with no
 * stylesheets from being a fatal error (stylelint's analog of ESLint's
 * `--no-error-on-unmatched-pattern`).
 */
export function buildStylelintArgs(patterns: string[], configPath?: string): string[] {
  const globbed = patterns.map((p) => {
    if (p === '.') return STYLE_GLOB;
    if (isBareDirectory(p)) return `${p.replace(/\/+$/, '')}/${STYLE_GLOB}`;
    return p;
  });
  return [
    '--formatter',
    'json',
    '--allow-empty-input',
    ...(configPath ? ['--config', configPath] : []),
    ...globbed,
  ];
}

/**
 * Stylelint adapter. Spawns `stylelint --formatter json`.
 *
 * Two conventions differ from the eslint/biome/oxc trio, both captured from
 * real 16.26.1 runs:
 *  - the JSON report goes to STDERR (`readFrom: 'stderr'`)
 *  - exit code 2 means "findings"; 1 is reserved for fatal errors
 */
export const stylelintAdapter: LinterAdapter<StylelintResult[]> = {
  name: 'stylelint',
  meta: {
    label: 'Stylelint',
    logoSlug: 'stylelint',
    docsUrl: 'https://stylelint.io',
    fixCommand: 'stylelint --fix',
  },
  priority: 40,
  bin: 'stylelint',
  pkgName: 'stylelint',
  defaultPatterns: ['.'],
  installHint: 'pnpm add -D stylelint',
  okExitCodes: [0, 2],
  readFrom: 'stderr',
  detect: detectStylelintConfig,
  buildArgs: ({ patterns, configPath }) => buildStylelintArgs(patterns, configPath),
  map: (payload, ctx) =>
    mapStylelintResults(payload, {
      cwd: ctx.cwd,
      stylelintVersion: ctx.version,
      ...(ctx.configPath ? { configPath: ctx.configPath } : {}),
    }),
};
