import type { Readable } from 'node:stream';

/**
 * Drain a Readable stream into a UTF-8 string.
 *
 * Buffers are collected and decoded ONCE at the end so multi-byte UTF-8
 * sequences split across chunk boundaries decode correctly. Factored to take
 * a stream (rather than reading `process.stdin` directly) so it's trivial to
 * unit-test with a synthetic Readable.
 */
export async function readStdin(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf8');
}
