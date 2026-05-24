import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSseBroadcaster, createSseChannel } from '../src/sse';

interface ServerCtx {
  server: Server;
  port: number;
  url: string;
}

async function startServer(handler: Parameters<typeof createServer>[0]): Promise<ServerCtx> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return { server, port, url: `http://127.0.0.1:${port}` };
}

async function closeServer(ctx: ServerCtx): Promise<void> {
  await new Promise<void>((resolve) => ctx.server.close(() => resolve()));
}

/**
 * Read SSE frames from an open connection. Returns an async iterator of
 * `{ event, data }` records. Filters out heartbeat and comment lines.
 */
async function readSseFrames(
  url: string,
  maxFrames: number,
  timeoutMs = 3000,
): Promise<Array<{ event: string; data: string }>> {
  const controller = new AbortController();
  const res = await fetch(url, { signal: controller.signal });
  if (!res.body) throw new Error('No response body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const frames: Array<{ event: string; data: string }> = [];
  let buffer = '';
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    while (frames.length < maxFrames) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Drain every complete frame the buffer currently contains.
      // The `sep` lookup at the top of each iteration handles the
      // `continue` (comment/heartbeat) case correctly.
      for (;;) {
        const sep = buffer.indexOf('\n\n');
        if (sep === -1) break;
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (frame.startsWith(':')) continue;
        const eventLine = frame.split('\n').find((l) => l.startsWith('event:'));
        const dataLines = frame
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).replace(/^ /, ''));
        if (eventLine && dataLines.length > 0) {
          frames.push({
            event: eventLine.slice(6).trim(),
            data: dataLines.join('\n'),
          });
          if (frames.length >= maxFrames) break;
        }
      }
    }
  } catch (err) {
    // Abort or socket closed — that's fine if we already have the frames we wanted.
    if (frames.length < maxFrames) throw err;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }

  return frames;
}

describe('createSseChannel', () => {
  let ctx: ServerCtx;

  afterEach(async () => {
    if (ctx) await closeServer(ctx);
  });

  it('writes Content-Type: text/event-stream', async () => {
    ctx = await startServer((_req, res) => {
      const ch = createSseChannel(res);
      ch.send('hello', { ok: true });
    });
    const r = await fetch(ctx.url);
    expect(r.headers.get('content-type')).toContain('text/event-stream');
    // Drain so the server can close
    await r.body?.cancel();
  });

  it('sends a named event with a JSON payload', async () => {
    ctx = await startServer((_req, res) => {
      const ch = createSseChannel(res);
      ch.send('report.updated', { generatedAt: '2026-05-24T10:00:00.000Z' });
      setTimeout(() => ch.close(), 20);
    });
    const frames = await readSseFrames(ctx.url, 1);
    expect(frames).toHaveLength(1);
    expect(frames[0]?.event).toBe('report.updated');
    expect(JSON.parse(frames[0]?.data ?? '{}')).toEqual({
      generatedAt: '2026-05-24T10:00:00.000Z',
    });
  });

  it('serializes strings without re-encoding them as JSON', async () => {
    ctx = await startServer((_req, res) => {
      const ch = createSseChannel(res);
      ch.send('msg', 'hello world');
      setTimeout(() => ch.close(), 20);
    });
    const frames = await readSseFrames(ctx.url, 1);
    expect(frames[0]?.data).toBe('hello world');
  });

  it('marks itself closed after close()', async () => {
    ctx = await startServer((_req, res) => {
      const ch = createSseChannel(res);
      expect(ch.closed).toBe(false);
      ch.close();
      expect(ch.closed).toBe(true);
    });
    const r = await fetch(ctx.url);
    await r.body?.cancel();
  });
});

describe('createSseBroadcaster', () => {
  let ctx: ServerCtx;
  const broadcaster = createSseBroadcaster();

  beforeEach(() => {
    broadcaster.closeAll();
  });

  afterEach(async () => {
    if (ctx) await closeServer(ctx);
    broadcaster.closeAll();
  });

  it('counts subscribers and pushes events to each', async () => {
    ctx = await startServer((_req, res) => {
      const ch = createSseChannel(res);
      broadcaster.register(ch);
    });

    const r1 = await fetch(ctx.url);
    const r2 = await fetch(ctx.url);
    // Wait briefly for the server to register both
    await new Promise((r) => setTimeout(r, 50));
    expect(broadcaster.subscriberCount).toBe(2);

    broadcaster.broadcast('ping', { i: 1 });
    // Drain
    await Promise.all([r1.body?.cancel(), r2.body?.cancel()]);
  });
});
