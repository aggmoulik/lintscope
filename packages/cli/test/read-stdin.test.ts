import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { readStdin } from '../src/read-stdin';

function streamOf(...chunks: Array<string | Buffer>): Readable {
  // A simple in-memory Readable that yields the given chunks in order.
  return Readable.from(
    (async function* () {
      for (const c of chunks) yield typeof c === 'string' ? Buffer.from(c, 'utf8') : c;
    })(),
  );
}

describe('readStdin', () => {
  it('concatenates UTF-8 chunks into a single string', async () => {
    const result = await readStdin(streamOf('{"hello":', ' "world"}'));
    expect(result).toBe('{"hello": "world"}');
  });

  it('returns an empty string for an empty stream', async () => {
    const result = await readStdin(streamOf());
    expect(result).toBe('');
  });

  it('handles Buffer chunks with multi-byte UTF-8 characters across boundaries', async () => {
    // "é" is 0xC3 0xA9 in UTF-8; split across two chunks.
    const result = await readStdin(streamOf(Buffer.from([0xc3]), Buffer.from([0xa9])));
    expect(result).toBe('é');
  });
});
