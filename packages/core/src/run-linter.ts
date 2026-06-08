import path from 'node:path';
import type { LintReport } from '@lintscope/schema';
import { runBiome } from './adapters/biome';
import { runEslint } from './adapters/eslint';
import { runOxc } from './adapters/oxc';
import { type DetectedLinter, detectLinter } from './detect-config';

export type LinterName = 'eslint' | 'biome' | 'oxc';

export interface RunLinterOptions {
  /** Project root. */
  cwd: string;
  /** Force a specific linter. When omitted, it's auto-detected from config files. */
  linter?: LinterName;
  /** Lint patterns, forwarded to the chosen adapter. */
  patterns?: string[];
}

export interface ResolvedLinterChoice {
  linter: LinterName;
  /** Config path — only set when a detected config matches the chosen linter. */
  configPath?: string;
}

/**
 * Decide which linter to run for a project: an explicit `override` wins,
 * otherwise the detected linter (precedence oxc > biome > eslint). Throws a
 * clear error when neither is available. Pure — `detect` is injectable.
 */
export function resolveLinterChoice(
  cwd: string,
  override?: LinterName,
  detect: (cwd: string) => DetectedLinter | null = detectLinter,
): ResolvedLinterChoice {
  const detected = detect(cwd);
  const linter = override ?? detected?.linter;
  if (!linter) {
    throw new Error(
      'No linter detected. Add an eslint, biome, or oxlint config to your project, or pass an explicit linter.',
    );
  }
  // Only carry a config path when the detected config is for the chosen linter
  // — an override to a different linter must not inherit the wrong config.
  if (detected && detected.linter === linter) {
    return { linter, configPath: detected.config.path };
  }
  return { linter };
}

export interface ResolveLintScopeOptions {
  /** Where the CLI was invoked (`process.cwd()`). */
  cwd: string;
  /** Explicit lint targets (positional CLI args), relative to `cwd`. */
  targets?: string[];
  /** Force a linter instead of detecting. */
  linter?: LinterName;
}

export interface ResolvedLintScope {
  /** Directory holding the linter config — `cwd` or the nearest ancestor with one. */
  projectRoot: string;
  linter: LinterName;
  configPath?: string;
  /** Lint patterns relative to `projectRoot`. Undefined = lint the whole project. */
  patterns?: string[];
}

/**
 * Resolve where to run a linter and what to lint, for monorepo-friendly use:
 *
 *  - Walks UP from `cwd` to find the nearest directory with a linter config, so
 *    `lintscope studio` works from a sub-package whose config lives at the root.
 *  - Scopes the file set: explicit `targets` (relative to `cwd`) win; otherwise,
 *    if `cwd` is below the config root, it scopes to that sub-path; otherwise the
 *    whole project is linted.
 *
 * Pure — `detect` is injectable for tests.
 */
export function resolveLintScope(
  options: ResolveLintScopeOptions,
  detect: (cwd: string) => DetectedLinter | null = detectLinter,
): ResolvedLintScope {
  const cwd = path.resolve(options.cwd);

  // Walk up from cwd to the nearest directory that has a linter config.
  let found: DetectedLinter | null = null;
  let projectRoot = cwd;
  let dir = cwd;
  while (true) {
    const detected = detect(dir);
    if (detected) {
      found = detected;
      projectRoot = dir;
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached the filesystem root
    dir = parent;
  }

  const linter = options.linter ?? found?.linter;
  if (!linter) {
    throw new Error(
      `No linter detected in ${cwd} or any parent directory. Add an eslint, biome, or oxlint config, or pass an explicit linter.`,
    );
  }
  // Override with no config found anywhere → root the run at cwd.
  if (!found) projectRoot = cwd;

  const configPath = found && found.linter === linter ? found.config.path : undefined;
  const patterns = computePatterns(cwd, projectRoot, options.targets);

  return {
    projectRoot,
    linter,
    ...(configPath ? { configPath } : {}),
    ...(patterns ? { patterns } : {}),
  };
}

/** Lint patterns relative to `projectRoot`: explicit targets win, else scope to `cwd`. */
function computePatterns(
  cwd: string,
  projectRoot: string,
  targets?: string[],
): string[] | undefined {
  if (targets && targets.length > 0) {
    return targets.map((target) => {
      const rel = path.relative(projectRoot, path.resolve(cwd, target));
      return rel === '' ? '.' : rel;
    });
  }
  if (cwd !== projectRoot) {
    return [path.relative(projectRoot, cwd)];
  }
  return undefined;
}

/**
 * Run the project's own linter, auto-detected (or forced via `options.linter`),
 * and return a normalized LintReport. Dispatches to the matching adapter, which
 * resolves the project-local binary.
 */
export async function runLinter(options: RunLinterOptions): Promise<LintReport> {
  const choice = resolveLinterChoice(options.cwd, options.linter);
  const base = {
    cwd: options.cwd,
    ...(options.patterns ? { patterns: options.patterns } : {}),
  };
  switch (choice.linter) {
    case 'eslint':
      return runEslint({
        ...base,
        ...(choice.configPath ? { configPath: choice.configPath } : {}),
      });
    case 'biome':
      return runBiome(base);
    case 'oxc':
      return runOxc(base);
  }
}
