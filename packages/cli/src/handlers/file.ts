import type { Stats } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { FileQuerySchema, type FileResponse, FileResponseSchema } from '@lintscope/api-schema';
import { PathTraversalError, safePath } from '@lintscope/studio-server';
import type { LintContext } from '../context';

const MAX_FILE_BYTES = 5_000_000; // 5MB — generous for source files, prevents bombs.

export type FileHandlerResult =
  | { status: 200; body: FileResponse }
  | { status: 400; body: { error: 'Bad request'; message: string } }
  | { status: 403; body: { error: 'Forbidden' } }
  | { status: 404; body: { error: 'Not found' } }
  | { status: 413; body: { error: 'File too large' } }
  | { status: 415; body: { error: 'Unsupported media type'; message: string } };

/**
 * Read a file by `path` from the project root, guarded against traversal.
 *
 * Returns a discriminated union so the HTTP wrapper can map cleanly to status
 * codes without `throw`-ing for expected outcomes (bad query, file missing, etc.).
 */
export async function handleFileRequest(
  context: LintContext,
  rawQuery: Record<string, string>,
): Promise<FileHandlerResult> {
  const parsed = FileQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        error: 'Bad request',
        message: parsed.error.issues.map((i) => i.message).join('; '),
      },
    };
  }

  let absolute: string;
  try {
    absolute = safePath(context.projectRoot, parsed.data.path);
  } catch (err) {
    if (err instanceof PathTraversalError) {
      return { status: 403, body: { error: 'Forbidden' } };
    }
    throw err;
  }

  let stats: Stats;
  try {
    stats = await stat(absolute);
  } catch {
    return { status: 404, body: { error: 'Not found' } };
  }

  if (!stats.isFile()) {
    return { status: 404, body: { error: 'Not found' } };
  }

  if (stats.size > MAX_FILE_BYTES) {
    return { status: 413, body: { error: 'File too large' } };
  }

  let content: string;
  try {
    content = await readFile(absolute, 'utf8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 415,
      body: { error: 'Unsupported media type', message: `Not UTF-8: ${message}` },
    };
  }

  const relative = path.relative(context.projectRoot, absolute) || path.basename(absolute);
  const response: FileResponse = {
    path: absolute,
    relativePath: relative,
    content,
    size: stats.size,
  };
  return { status: 200, body: FileResponseSchema.parse(response) };
}
