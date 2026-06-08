import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { openBrowser } from './browser';
import { buildCorsHeaders, normalizeAllowOrigin } from './cors';
import { createSseBroadcaster, createSseChannel, type SseChannel } from './sse';
import { generateToken, tokensMatch } from './token';
import type {
  CreateStudioServerOptions,
  EndpointContext,
  EndpointHandler,
  EndpointResponse,
  EndpointSpec,
  HttpMethod,
  StudioServerInstance,
} from './types';

const MAX_BODY_BYTES = 1_000_000; // 1MB hard cap

/**
 * Spin up the local studio server, bind to a port, register endpoints, and
 * (optionally) open the browser. Returns once the server is listening — the
 * returned `url` is safe to share with the user immediately.
 *
 * @example
 * const studio = await createStudioServer({
 *   name: 'lintscope',
 *   hostedUi: 'https://lintscope.dev/studio',
 *   allowOrigin: 'https://lintscope.dev',
 *   endpoints: {
 *     'GET /init': () => ({ body: initPayload() }),
 *     'GET /events': ({ sse }) => { sse(); return undefined; },
 *   },
 * });
 * console.log(`Open ${studio.url}`);
 */
export async function createStudioServer(
  options: CreateStudioServerOptions,
): Promise<StudioServerInstance> {
  const allowedOrigins = normalizeAllowOrigin(options.allowOrigin);
  const routes = compileRoutes(options.endpoints);
  const broadcaster = createSseBroadcaster();
  const token = generateToken();
  const studioHost = options.studioHost ?? 'localhost';

  const server = createServer((req, res) => handle(req, res));
  const { port, discoverable } = await bindServer(server, options.port);

  const hostedUiUrl = new URL(options.hostedUi);
  // When the port came from a discovery list the page can probe for it, so we
  // omit host+port for a clean URL. An explicit/fallback port the page can't
  // guess is included so it can still connect.
  if (!discoverable) {
    hostedUiUrl.searchParams.set('host', studioHost);
    hostedUiUrl.searchParams.set('port', String(port));
  }
  // Neither the token nor the name is in the URL — the page fetches both via
  // GET /handshake (origin- and CORS-gated below). For a discovery-range port
  // this leaves a fully bare `…/studio`, like Drizzle Studio.
  const url = hostedUiUrl.toString();

  if (options.open !== false) {
    // Fire-and-forget — we do NOT want to delay returning from createStudioServer
    void openBrowser(url);
  }

  let closing: Promise<void> | null = null;
  const close = (): Promise<void> => {
    if (closing) return closing;
    closing = (async () => {
      broadcaster.closeAll('server.shutdown');
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (options.onShutdown) await options.onShutdown();
    })();
    return closing;
  };

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const origin = (req.headers.origin as string | undefined) ?? undefined;
    const cors = buildCorsHeaders({ origin, allowed: allowedOrigins });

    // DNS-rebinding guard: only serve requests addressed to a loopback Host. A
    // rebinding attack reaches 127.0.0.1 with the attacker's domain as Host and
    // omits the Origin header (same-origin from the browser's view), which would
    // otherwise slip past the origin check below.
    if (!isLoopbackHost(req.headers.host ?? '')) {
      res.writeHead(403, cors);
      res.end();
      return;
    }

    if (req.method === 'OPTIONS') {
      // Preflight — short-circuit. A public HTTPS page (the hosted UI) calling
      // http://127.0.0.1 triggers a Private Network Access preflight in
      // Chromium; answer it so the real request isn't blocked.
      const allowed = Boolean(cors['Access-Control-Allow-Origin']);
      const headers: Record<string, string> = { ...cors };
      if (allowed && req.headers['access-control-request-private-network'] === 'true') {
        headers['Access-Control-Allow-Private-Network'] = 'true';
      }
      res.writeHead(allowed ? 204 : 403, headers);
      res.end();
      return;
    }

    // Reject anything from a non-allowed origin if Origin was sent (browsers
    // always send it cross-origin; some same-origin or curl requests omit it,
    // and we still serve those so local debugging works).
    if (origin && !cors['Access-Control-Allow-Origin']) {
      res.writeHead(403, cors);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const method = (req.method ?? 'GET').toUpperCase() as HttpMethod;

    // Built-in handshake: lets the hosted UI fetch the session token so it never
    // has to live in the URL. Deliberately EXEMPT from the token check (it's how
    // you obtain the token) — but it's already origin-gated above (disallowed
    // origins got 403) and the response carries the allow-origin CORS header, so
    // only the genuine hosted UI can read the token back.
    if (method === 'GET' && url.pathname === '/handshake') {
      writeResponse(res, cors, { body: { token, name: options.name } });
      return;
    }

    // Auth check: token via ?token= OR Authorization: Bearer
    const presented = extractToken(url, req);
    if (!presented || !tokensMatch(presented, token)) {
      res.writeHead(401, cors);
      res.end();
      return;
    }

    const route = routes.get(`${method} ${url.pathname}` as EndpointSpec);
    if (!route) {
      res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    let bodyCache: { value: unknown } | undefined;
    let sseClaimed = false;
    const ctx: EndpointContext = {
      req,
      url,
      method,
      query: Object.fromEntries(url.searchParams.entries()),
      async body<T>() {
        if (bodyCache) return bodyCache.value as T;
        const raw = await readBody(req);
        if (raw.length === 0) {
          bodyCache = { value: undefined };
          return undefined as T;
        }
        const contentType = req.headers['content-type'];
        if (typeof contentType !== 'string' || !contentType.includes('application/json')) {
          throw new Error('Body content-type must be application/json');
        }
        bodyCache = { value: JSON.parse(raw.toString('utf8')) };
        return bodyCache.value as T;
      },
      sse(): SseChannel {
        sseClaimed = true;
        const channel = createSseChannel(res, { extraHeaders: cors });
        broadcaster.register(channel);
        return channel;
      },
    };

    try {
      const result = await route(ctx);
      if (sseClaimed) {
        // Stream already started — nothing more to do.
        return;
      }
      writeResponse(res, cors, result);
    } catch (err) {
      if (sseClaimed) {
        // Best we can do is close the stream — headers are already sent.
        return;
      }
      const errorId = generateToken();
      const message = err instanceof Error ? err.message : String(err);
      console.error(`studio-server: handler error [${errorId}]`, err);
      writeResponse(res, cors, {
        status: 500,
        body: { error: 'Internal server error', errorId, message },
      });
    }
  }

  return {
    url,
    port,
    token,
    broadcast: (eventName, data) => broadcaster.broadcast(eventName, data),
    close,
  };
}

/**
 * True only when `host` (a `Host` header, possibly with a port) addresses the
 * loopback interface: `localhost`, `127.0.0.0/8`, or `::1`. Used as the
 * DNS-rebinding guard — anything else (e.g. `evil.com`) is rejected.
 */
export function isLoopbackHost(host: string): boolean {
  if (!host) return false;
  // Strip a trailing `:port`, but not the colons inside an IPv6 literal `[::1]`.
  let hostname = host;
  const lastColon = host.lastIndexOf(':');
  if (lastColon > host.lastIndexOf(']')) {
    hostname = host.slice(0, lastColon);
  }
  hostname = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname === '::1') return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

function compileRoutes(
  endpoints: CreateStudioServerOptions['endpoints'],
): Map<EndpointSpec, EndpointHandler> {
  const map = new Map<EndpointSpec, EndpointHandler>();
  for (const [spec, handler] of Object.entries(endpoints) as Array<
    [EndpointSpec, EndpointHandler]
  >) {
    if (!/^(GET|POST|PUT|DELETE) \//.test(spec)) {
      throw new Error(`Invalid endpoint spec: "${spec}". Expected "METHOD /path".`);
    }
    map.set(spec, handler);
  }
  return map;
}

/**
 * Bind the server. A `number[]` is a discovery list — try each, bind the first
 * free one (`discoverable: true`, so the URL omits host+port). A single number
 * or `undefined` binds exactly / randomly (`discoverable: false`). If every
 * candidate in a list is busy, fall back to a random free port.
 */
async function bindServer(
  server: Server,
  port: number | number[] | undefined,
): Promise<{ port: number; discoverable: boolean }> {
  if (Array.isArray(port)) {
    for (const candidate of port) {
      if (await tryListen(server, candidate)) {
        return { port: candidate, discoverable: true };
      }
    }
    await forceListen(server, 0);
    return { port: (server.address() as AddressInfo).port, discoverable: false };
  }
  await forceListen(server, port ?? 0);
  return { port: (server.address() as AddressInfo).port, discoverable: false };
}

/** Attempt to listen on `port`; resolve true on success, false on any bind error. */
function tryListen(server: Server, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const onError = () => {
      server.off('listening', onListening);
      resolve(false);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(true);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

function forceListen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError);
      resolve();
    });
  });
}

function extractToken(url: URL, req: IncomingMessage): string | undefined {
  const fromQuery = url.searchParams.get('token');
  if (fromQuery) return fromQuery;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }
  return undefined;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) {
      throw new Error(`Body exceeds ${MAX_BODY_BYTES} bytes`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function writeResponse(
  res: ServerResponse,
  corsHeaders: Record<string, string>,
  response: EndpointResponse | undefined,
): void {
  const status = response?.status ?? 200;
  const userHeaders = response?.headers ?? {};
  const body = response?.body;

  if (body === undefined || body === null) {
    res.writeHead(status, { ...corsHeaders, ...userHeaders });
    res.end();
    return;
  }

  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    res.writeHead(status, {
      'Content-Type': 'text/plain; charset=utf-8',
      ...corsHeaders,
      ...userHeaders,
    });
    res.end(body);
    return;
  }

  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...corsHeaders,
    ...userHeaders,
  });
  res.end(JSON.stringify(body));
}
