import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface ResolveLinterBinOptions {
  /** Project root to look in for a local `node_modules/.bin` install. */
  projectRoot: string;
  /** The bin command name, e.g. `eslint`, `biome`, `oxlint`. */
  name: string;
  /** Explicit override path. Wins over everything when provided. */
  override?: string;
}

export interface ResolveLinterBinDeps {
  /** Injectable existence check (defaults to `fs.existsSync`) — for testing. */
  exists?: (p: string) => boolean;
  /** Injectable platform (defaults to `process.platform`) — for testing. */
  platform?: NodeJS.Platform;
}

export interface ResolvedLinterBin {
  /** The command to spawn. */
  command: string;
  /** Where the command came from — useful for diagnostics + "not installed" errors. */
  resolvedFrom: 'override' | 'local' | 'path';
}

/**
 * Resolve the executable to run for a linter, preferring the project's own
 * install so we run the version the project actually uses.
 *
 * Order: explicit `override` → `<projectRoot>/node_modules/.bin/<name>` → bare
 * `name` on PATH. On Windows the local `.bin` shim carries a `.cmd`/`.exe`
 * extension, so we probe those variants.
 */
export function resolveLinterBin(
  options: ResolveLinterBinOptions,
  deps: ResolveLinterBinDeps = {},
): ResolvedLinterBin {
  const exists = deps.exists ?? existsSync;
  const platform = deps.platform ?? process.platform;

  if (options.override) {
    return { command: options.override, resolvedFrom: 'override' };
  }

  const binDir = path.join(options.projectRoot, 'node_modules', '.bin');
  for (const candidate of binCandidates(options.name, platform)) {
    const full = path.join(binDir, candidate);
    if (exists(full)) {
      return { command: full, resolvedFrom: 'local' };
    }
  }

  return { command: options.name, resolvedFrom: 'path' };
}

/**
 * Candidate filenames for a bin on the given platform, in preference order.
 * On Windows the extension-less shim is not directly spawnable, so we only
 * accept the `.cmd`/`.exe` variants from `node_modules/.bin`.
 */
function binCandidates(name: string, platform: NodeJS.Platform): string[] {
  if (platform === 'win32') return [`${name}.cmd`, `${name}.CMD`, `${name}.exe`];
  return [name];
}

export interface ResolveLinterVersionDeps {
  /** Injectable package.json reader (defaults to read+parse) — for testing. */
  readPackageJson?: (packageJsonPath: string) => { version?: unknown };
}

/**
 * Read the version of a linter package as installed in the project, from
 * `<projectRoot>/node_modules/<packageName>/package.json`. Returns `'unknown'`
 * if the package isn't installed or has no string `version` — we never throw,
 * because a missing version shouldn't fail a lint run.
 *
 * `packageName` may be scoped (e.g. `@biomejs/biome`).
 */
export function resolveLinterVersion(
  projectRoot: string,
  packageName: string,
  deps: ResolveLinterVersionDeps = {},
): string {
  const read = deps.readPackageJson ?? defaultReadPackageJson;
  try {
    const pkgPath = path.join(
      projectRoot,
      'node_modules',
      ...packageName.split('/'),
      'package.json',
    );
    const json = read(pkgPath);
    return typeof json.version === 'string' ? json.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

function defaultReadPackageJson(packageJsonPath: string): { version?: unknown } {
  return JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown };
}
