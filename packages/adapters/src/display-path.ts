import path from 'node:path';

/**
 * The platform path functions {@link relativeDisplayPath} needs — injectable
 * (`path.win32` / `path.posix`) so Windows behaviour is unit-testable anywhere.
 */
export type PathImpl = Pick<typeof path, 'relative' | 'basename' | 'sep'>;

/** Convert a platform path to forward-slash form (`src\util.ts` → `src/util.ts`). */
export function toPosix(p: string, pathImpl: PathImpl = path): string {
  return pathImpl.sep === '/' ? p : p.split(pathImpl.sep).join('/');
}

/**
 * Compute `Diagnostic.relativePath` from the lint cwd, normalized to forward
 * slashes on every platform. The forward-slash form is load-bearing, not
 * cosmetic: the UI file tree groups by splitting on `/`, and the stable
 * diagnostic ID hashes `relativePath` — Windows backslashes would yield
 * different IDs for the same diagnostic across platforms.
 */
export function relativeDisplayPath(from: string, to: string, pathImpl: PathImpl = path): string {
  const rel = pathImpl.relative(from, to) || pathImpl.basename(to);
  return toPosix(rel, pathImpl);
}
