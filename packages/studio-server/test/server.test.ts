import { afterEach, describe, expect, it } from 'vitest';
import { createStudioServer } from '../src/server';
import type { StudioServerInstance } from '../src/types';

async function withStudio<T>(
  opts: Omit<Parameters<typeof createStudioServer>[0], 'name' | 'hostedUi' | 'open'> & {
    hostedUi?: string;
    name?: string;
  },
  fn: (studio: StudioServerInstance) => Promise<T>,
): Promise<T> {
  const studio = await createStudioServer({
    name: opts.name ?? 'test-studio',
    hostedUi: opts.hostedUi ?? 'https://example.dev/studio',
    open: false,
    ...opts,
  } as Parameters<typeof createStudioServer>[0]);
  try {
    return await fn(studio);
  } finally {
    await studio.close();
  }
}

describe('createStudioServer', () => {
  it('listens on a random port and returns a fully-qualified hosted UI URL', async () => {
    await withStudio(
      {
        allowOrigin: 'https://example.dev',
        endpoints: { 'GET /init': () => ({ body: { ok: true } }) },
      },
      (studio) => {
        expect(studio.port).toBeGreaterThan(0);
        const u = new URL(studio.url);
        expect(u.origin).toBe('https://example.dev');
        expect(u.pathname).toBe('/studio');
        expect(u.searchParams.get('host')).toBe('localhost');
        expect(u.searchParams.get('port')).toBe(String(studio.port));
        expect(u.searchParams.get('token')).toBe(studio.token);
        expect(u.searchParams.get('name')).toBe('test-studio');
        return Promise.resolve();
      },
    );
  });

  it('dispatches GET to the registered handler and returns 200 with JSON', async () => {
    await withStudio(
      {
        allowOrigin: 'https://example.dev',
        endpoints: { 'GET /init': () => ({ body: { apiVersion: '1' } }) },
      },
      async (studio) => {
        const res = await fetch(`http://127.0.0.1:${studio.port}/init?token=${studio.token}`);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('application/json');
        expect(await res.json()).toEqual({ apiVersion: '1' });
      },
    );
  });

  it('parses POST JSON body via ctx.body()', async () => {
    await withStudio(
      {
        allowOrigin: 'https://example.dev',
        endpoints: {
          'POST /scan': async ({ body }) => {
            const payload = await body<{ rescan: boolean }>();
            return { body: { received: payload } };
          },
        },
      },
      async (studio) => {
        const res = await fetch(`http://127.0.0.1:${studio.port}/scan?token=${studio.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rescan: true }),
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ received: { rescan: true } });
      },
    );
  });

  it('returns 401 when the token is missing or wrong', async () => {
    await withStudio(
      {
        allowOrigin: 'https://example.dev',
        endpoints: { 'GET /init': () => ({ body: { ok: true } }) },
      },
      async (studio) => {
        const noToken = await fetch(`http://127.0.0.1:${studio.port}/init`);
        expect(noToken.status).toBe(401);

        const wrongToken = await fetch(`http://127.0.0.1:${studio.port}/init?token=wrong`);
        expect(wrongToken.status).toBe(401);
      },
    );
  });

  it('accepts token via Authorization: Bearer header', async () => {
    await withStudio(
      {
        allowOrigin: 'https://example.dev',
        endpoints: { 'GET /init': () => ({ body: { ok: true } }) },
      },
      async (studio) => {
        const res = await fetch(`http://127.0.0.1:${studio.port}/init`, {
          headers: { Authorization: `Bearer ${studio.token}` },
        });
        expect(res.status).toBe(200);
      },
    );
  });

  it('returns 404 for unknown paths', async () => {
    await withStudio(
      {
        allowOrigin: 'https://example.dev',
        endpoints: { 'GET /init': () => ({ body: { ok: true } }) },
      },
      async (studio) => {
        const res = await fetch(`http://127.0.0.1:${studio.port}/nope?token=${studio.token}`);
        expect(res.status).toBe(404);
      },
    );
  });

  it('responds to CORS preflight with allowed Origin', async () => {
    await withStudio(
      {
        allowOrigin: 'https://example.dev',
        endpoints: { 'GET /init': () => ({ body: { ok: true } }) },
      },
      async (studio) => {
        const res = await fetch(`http://127.0.0.1:${studio.port}/init`, {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://example.dev',
            'Access-Control-Request-Method': 'GET',
          },
        });
        expect(res.status).toBe(204);
        expect(res.headers.get('access-control-allow-origin')).toBe('https://example.dev');
        expect(res.headers.get('access-control-allow-methods')).toContain('GET');
      },
    );
  });

  it('rejects CORS preflight from disallowed origin with 403', async () => {
    await withStudio(
      {
        allowOrigin: 'https://example.dev',
        endpoints: { 'GET /init': () => ({ body: { ok: true } }) },
      },
      async (studio) => {
        const res = await fetch(`http://127.0.0.1:${studio.port}/init`, {
          method: 'OPTIONS',
          headers: { Origin: 'https://evil.dev', 'Access-Control-Request-Method': 'GET' },
        });
        expect(res.status).toBe(403);
      },
    );
  });

  it('returns 500 with an errorId when a handler throws', async () => {
    await withStudio(
      {
        allowOrigin: 'https://example.dev',
        endpoints: {
          'GET /boom': () => {
            throw new Error('kaboom');
          },
        },
      },
      async (studio) => {
        const res = await fetch(`http://127.0.0.1:${studio.port}/boom?token=${studio.token}`);
        expect(res.status).toBe(500);
        const body = (await res.json()) as { errorId?: string };
        expect(body.errorId).toMatch(/^[0-9a-f-]{36}$/);
      },
    );
  });

  it('rejects an invalid endpoint spec at construction time', async () => {
    await expect(() =>
      createStudioServer({
        name: 'test',
        hostedUi: 'https://example.dev/studio',
        allowOrigin: 'https://example.dev',
        open: false,
        endpoints: {
          // @ts-expect-error — deliberately bad spec to test the runtime guard
          BADSPEC: () => ({ body: {} }),
        },
      }),
    ).rejects.toThrowError(/Invalid endpoint spec/);
  });

  it('rejects allowOrigin "*" at construction time', async () => {
    await expect(() =>
      createStudioServer({
        name: 'test',
        hostedUi: 'https://example.dev/studio',
        // @ts-expect-error — covered by runtime guard
        allowOrigin: '*',
        open: false,
        endpoints: { 'GET /init': () => ({ body: {} }) },
      }),
    ).rejects.toThrowError(/wildcard/i);
  });

  it('close() runs onShutdown and is idempotent', async () => {
    let shutdownCalls = 0;
    const studio = await createStudioServer({
      name: 'test',
      hostedUi: 'https://example.dev/studio',
      allowOrigin: 'https://example.dev',
      open: false,
      endpoints: { 'GET /init': () => ({ body: { ok: true } }) },
      onShutdown: () => {
        shutdownCalls += 1;
      },
    });
    await studio.close();
    await studio.close();
    expect(shutdownCalls).toBe(1);
  });

  it('broadcast() pushes an SSE event to a connected client', async () => {
    const studio = await createStudioServer({
      name: 'test',
      hostedUi: 'https://example.dev/studio',
      allowOrigin: 'https://example.dev',
      open: false,
      endpoints: {
        'GET /events': ({ sse }) => {
          sse();
          return undefined;
        },
      },
    });

    try {
      const controller = new AbortController();
      const eventsP = fetch(`http://127.0.0.1:${studio.port}/events?token=${studio.token}`, {
        signal: controller.signal,
      });
      // Give the connection a beat to register with the broadcaster
      await new Promise((r) => setTimeout(r, 100));
      studio.broadcast('hello', { n: 1 });
      // Read until we see the event
      const res = await eventsP;
      if (!res.body) throw new Error('SSE response had no body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let received = '';
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline && !received.includes('event: hello')) {
        const { value, done } = await reader.read();
        if (done) break;
        received += decoder.decode(value, { stream: true });
      }
      controller.abort();
      expect(received).toContain('event: hello');
      expect(received).toContain('"n":1');
    } finally {
      await studio.close();
    }
  });
});

afterEach(() => {
  // Defensive: any orphaned servers will be cleaned up by their own withStudio's finally.
});
