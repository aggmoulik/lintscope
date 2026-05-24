# @lintscope/studio-server

A tiny, lint-agnostic library for the **Drizzle-Studio pattern** — a local CLI tool plus a hosted browser UI that connects back to a local HTTP server on `localhost`.

This package currently lives inside the [lintscope](https://github.com/aggmoulik/lintscope) monorepo. It is designed to be extracted as a standalone npm package once lintscope ships v1.0 and a second consumer (e.g. a TypeScript error explorer) validates the API.

## Why this exists

When you want to build a CLI tool that opens a polished web UI, you have two bad options:

1. **Bundle the UI inside the CLI tarball** (like Storybook or Vite). The UI is always shipped — bigger CLI, slow CLI updates ship UI fixes too.
2. **Spawn an Electron app.** Heavy.

The pattern Drizzle Studio popularized — a local HTTP server with CORS that a hosted webapp talks to via the browser's `localhost` mixed-content exemption — is the third option. It's the best of both worlds: small CLI, always-latest UI, local data, no install.

No library exists for this pattern. You hand-roll it from `node:http`, `crypto.randomUUID()`, a CORS header table, an SSE stream helper, a cross-platform `open` call, and a token-comparison routine. **This package is that hand-rolled code, factored out.**

## What it gives you

- HTTP server on a random free port (or a fixed one)
- CORS allowlist (no wildcard accepted)
- Per-session UUID token, validated in constant time
- Endpoint registration via a plain object: `{ 'GET /init': handler, ... }`
- Server-Sent Events helper for push updates (heartbeat included)
- Cross-platform browser-open via the `open` package
- Graceful shutdown drains SSE clients
- Path-traversal guard helper (`safePath`)
- Zero runtime dependencies except `open`

## Usage

```ts
import { createStudioServer } from '@lintscope/studio-server';

const studio = await createStudioServer({
  name: 'lintscope',
  hostedUi: 'https://lintscope.dev/studio',
  allowOrigin: 'https://lintscope.dev',
  endpoints: {
    'GET /init': () => ({
      body: { apiVersion: '1', schemaVersion: '1.0' },
    }),
    'GET /report': async () => ({
      body: await loadReport(),
    }),
    'POST /scan': async () => ({
      body: await runLinter(),
    }),
    'GET /events': ({ sse }) => {
      sse(); // hijack the response into an SSE stream
      return undefined;
    },
  },
});

console.log(`Studio at ${studio.url}`);

// Push an event to all connected SSE subscribers
studio.broadcast('report.updated', { generatedAt: new Date().toISOString() });

// Clean shutdown
process.on('SIGINT', async () => {
  await studio.close();
  process.exit(0);
});
```

## URL the hosted UI sees

`createStudioServer` opens (or returns, with `open: false`):

```
https://lintscope.dev/studio?host=localhost&port=<PORT>&token=<UUID>&name=lintscope
```

Your hosted page reads `host`, `port`, and `token` from the URL and fetches:

```js
const base = `http://${host}:${port}`;
const init = await fetch(`${base}/init?token=${token}`).then((r) => r.json());
```

This works in the browser because [the Secure Contexts spec](https://www.w3.org/TR/secure-contexts/#localhost) exempts `localhost` / `127.0.0.0/8` / `::1` from mixed-content rules. No TLS cert dance.

## Path-traversal guard

For endpoints that serve file content from disk, wrap the untrusted path:

```ts
import { safePath, PathTraversalError } from '@lintscope/studio-server';

'GET /file': async ({ query }) => {
  try {
    const file = safePath(projectRoot, query.path);
    return { body: { content: await readFile(file, 'utf8') } };
  } catch (err) {
    if (err instanceof PathTraversalError) {
      return { status: 403, body: { error: 'Forbidden' } };
    }
    throw err;
  }
}
```

## API

### `createStudioServer(options): Promise<StudioServerInstance>`

| Option | Type | Default | Notes |
|---|---|---|---|
| `name` | `string` | — | Required. Displayed in browser-open + embedded as `?name=` |
| `hostedUi` | `string` | — | Required. The hosted UI URL (path on a domain you control) |
| `allowOrigin` | `string \| string[]` | — | Required. CORS allowlist. Wildcard `*` is rejected |
| `endpoints` | `Record<'METHOD /path', EndpointHandler>` | — | Required. At least one endpoint |
| `port` | `number` | `0` | `0` = random free port |
| `open` | `boolean` | `true` | Open browser. Auto-disabled in CI |
| `studioHost` | `string` | `'localhost'` | Local-host name in the URL — change to `127.0.0.1` if your env doesn't resolve `localhost` |
| `onShutdown` | `() => Promise<void>` | — | Hook for cleanup, runs during `close()` |

### `StudioServerInstance`

```ts
interface StudioServerInstance {
  url: string;         // open this in a browser
  port: number;
  token: string;
  broadcast(event: string, data: unknown): void;
  close(): Promise<void>;  // idempotent
}
```

### `EndpointHandler`

```ts
type EndpointHandler = (ctx: EndpointContext) => EndpointResponse | undefined | Promise<...>;

interface EndpointContext {
  req: IncomingMessage;
  url: URL;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query: Record<string, string>;
  body<T>(): Promise<T>;     // lazy, JSON, 1MB cap
  sse(): SseChannel;          // hijacks the response into an SSE stream
}

interface EndpointResponse {
  status?: number;            // default 200
  headers?: Record<string, string>;
  body?: unknown;             // JSON-serialized unless string or Buffer
}
```

If a handler calls `ctx.sse()`, it MUST return `undefined`. The framework owns the response from that point.

## Security posture

- **Wildcard origins rejected** at config time.
- **Token in constant-time compare** via `crypto.timingSafeEqual`.
- **No information leaked on token mismatch** — 401 with empty body.
- **Body size capped at 1MB** to prevent DoS via huge POST bodies.
- **CORS preflight from a non-allowed origin returns 403**, not 200-with-no-headers (less ambiguous for security audits).
- **`Vary: Origin` always set** to prevent cache poisoning.
- **Errors include a stable `errorId`** that's logged to stderr, NOT the underlying stack trace.

Known v1 limitations (call them out before users hit them):

- Token is in the URL → visible in browser history. Mitigation in a future hardening pass: swap for a one-time-use cookie after first `/init` success.
- No rate limiting. Add Hono / Express in front if you need it; for a local-development tool the cost/benefit doesn't justify shipping our own.

## License

MIT
