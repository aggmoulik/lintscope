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
  await listen(server, options.port ?? 0);
  const port = (server.address() as AddressInfo).port;

  const hostedUiUrl = new URL(options.hostedUi);
  hostedUiUrl.searchParams.set('host', studioHost);
  hostedUiUrl.searchParams.set('port', String(port));
  hostedUiUrl.searchParams.set('token', token);
  hostedUiUrl.searchParams.set('name', options.name);
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

    if (req.method === 'OPTIONS') {
      // Preflight — short-circuit
      res.writeHead(cors['Access-Control-Allow-Origin'] ? 204 : 403, cors);
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

function listen(server: Server, port: number): Promise<void> {
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
