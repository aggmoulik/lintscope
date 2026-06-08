import type { IncomingMessage } from 'node:http';
import type { SseChannel } from './sse';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type EndpointSpec = `${HttpMethod} ${string}`;

export interface EndpointContext {
  /** The raw Node request. Available for advanced needs (custom headers etc.). */
  req: IncomingMessage;
  /** Parsed URL with a fully qualified origin. */
  url: URL;
  /** HTTP method, uppercase. */
  method: HttpMethod;
  /** Shorthand for `url.searchParams` flattened to a plain object (last value wins on duplicates). */
  query: Record<string, string>;
  /**
   * Lazily parse the request body as JSON. Throws if Content-Type is not
   * application/json or if the body exceeds the 1MB cap. Caches the parsed
   * value across multiple calls.
   */
  body<T = unknown>(): Promise<T>;
  /**
   * Convert this request into an SSE stream. Returns the channel controller.
   * Once `sse()` is called, the framework owns the response; your handler
   * MUST return `undefined`.
   */
  sse(): SseChannel;
}

export interface EndpointResponse {
  status?: number;
  headers?: Record<string, string>;
  /** Plain values are JSON-serialized. Buffers / strings are sent as-is (set Content-Type via `headers`). */
  body?: unknown;
}

export type EndpointHandler = (
  ctx: EndpointContext,
) => EndpointResponse | undefined | Promise<EndpointResponse | undefined>;

export type EndpointRegistry = Record<EndpointSpec, EndpointHandler>;

export interface CreateStudioServerOptions {
  /**
   * Human-readable name. Used in console output and embedded in the `name` URL
   * parameter so the hosted UI can display "Connected to X".
   */
  name: string;
  /**
   * The hosted UI URL (e.g. `https://lintscope.dev/studio`). For a discovery
   * port the framework leaves it bare (`…/studio`); for an explicit/random port
   * it appends `?host=&port=`. The token and name are never in the URL — the
   * page fetches both via `GET /handshake`.
   */
  hostedUi: string;
  /**
   * Port to listen on:
   *  - a single `number` binds exactly that port (and puts host+port in the URL);
   *  - a `number[]` binds the first free candidate and OMITS host+port from the
   *    URL, expecting the page to probe the range (Drizzle-style clean URL);
   *  - omitted selects a random free port (host+port included in the URL).
   */
  port?: number | number[];
  /**
   * Allowed CORS origins. The wildcard `*` is rejected. Required — no insecure
   * default.
   */
  allowOrigin: string | string[];
  /** Endpoint handlers keyed by `"METHOD /path"`. */
  endpoints: EndpointRegistry;
  /** If true (default) open the browser to the hosted UI URL when start() resolves. */
  open?: boolean;
  /** Optional async hook run as part of `close()`, before the server socket closes. */
  onShutdown?: () => void | Promise<void>;
  /**
   * Optional override for the local host the studio URL points at. Defaults to
   * `localhost`. Set to `127.0.0.1` if your environment doesn't resolve `localhost`.
   */
  studioHost?: string;
}

export interface StudioServerInstance {
  /** Built URL — bare `…/studio` for a discovery port, else `…/studio?host=&port=`. No token/name. */
  url: string;
  /** Port the local HTTP server is bound to. */
  port: number;
  /** Per-session token. Served to the hosted UI via `GET /handshake`, not via `url`. */
  token: string;
  /** Push an SSE event to all currently-subscribed channels. */
  broadcast(eventName: string, data: unknown): void;
  /** Close the server, drain SSE clients, run `onShutdown`. Idempotent. */
  close(): Promise<void>;
}
