import type { LinterAdapter } from '../../types';
import type { EslintLintResult } from './api-types';
import { detectEslintConfig } from './detect';
import { mapEslintResults } from './mapper';

/** Build the `eslint` CLI args. Pure — exported for testing. */
export function buildEslintArgs(patterns: string[], configPath?: string): string[] {
  return [
    '--format',
    'json',
    // Don't fail the whole run when a pattern matches nothing.
    '--no-error-on-unmatched-pattern',
    ...(configPath ? ['--config', configPath] : []),
    ...patterns,
  ];
}

/**
 * ESLint adapter. We spawn the project's own `eslint --format json` rather
 * than `import('eslint')` so we run the version installed in the *target*
 * project. The `--format json` output is the same `LintResult[]` shape the
 * Node API returns.
 *
 * Default patterns `['.']` are faithful to the user's own `eslint .` (correct
 * under flat config, ESLint 9's default). Legacy `.eslintrc` repos that relied
 * on `--ext` may under-lint — documented as a known limitation.
 */
export const eslintAdapter: LinterAdapter<EslintLintResult[]> = {
  name: 'eslint',
  meta: { label: 'ESLint', logoSlug: 'eslint', docsUrl: 'https://eslint.org' },
  priority: 30,
  bin: 'eslint',
  pkgName: 'eslint',
  defaultPatterns: ['.'],
  installHint: 'pnpm add -D eslint',
  okExitCodes: [0, 1],
  detect: detectEslintConfig,
  buildArgs: ({ patterns, configPath }) => buildEslintArgs(patterns, configPath),
  map: (payload, ctx) =>
    mapEslintResults(payload, {
      cwd: ctx.cwd,
      eslintVersion: ctx.version,
      ...(ctx.configPath ? { configPath: ctx.configPath } : {}),
    }),
};
