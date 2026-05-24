import path from 'node:path';

/**
 * Thrown by {@link safePath} when the requested target escapes the project root.
 * Catch this to translate to a 403 / 404 in your endpoint handler.
 */
export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathTraversalError';
  }
}

/**
 * Resolve an untrusted path to an absolute filesystem path, asserting that the
 * result stays within `projectRoot`. Throws {@link PathTraversalError} on:
 *
 *  - `../` escapes  (e.g. `src/../../etc/passwd`)
 *  - absolute paths outside `projectRoot`  (e.g. `/etc/passwd`)
 *  - null-byte injection  (`foo.ts\x00.png`)
 *  - empty / non-string inputs
 *
 * Use this for EVERY file-content endpoint. Never pass untrusted paths to `fs.*`
 * without going through this guard first.
 *
 * @example
 * const file = safePath(projectRoot, query.path);
 * const content = await readFile(file, 'utf8');
 */
export function safePath(projectRoot: string, untrusted: string): string {
  if (typeof untrusted !== 'string' || untrusted.length === 0) {
    throw new PathTraversalError('Path must be a non-empty string');
  }
  if (untrusted.includes('\0')) {
    throw new PathTraversalError('Path contains null byte');
  }

  const root = path.resolve(projectRoot);
  const requested = path.resolve(root, untrusted);

  // Allow the root itself; require everything else to live strictly under it.
  if (requested !== root && !requested.startsWith(`${root}${path.sep}`)) {
    throw new PathTraversalError(`Path escapes project root: ${untrusted} → ${requested}`);
  }

  return requested;
}
