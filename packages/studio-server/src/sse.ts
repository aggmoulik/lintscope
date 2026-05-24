import type { ServerResponse } from 'node:http';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no', // disable proxy buffering (nginx)
} as const;

const DEFAULT_HEARTBEAT_MS = 15_000;

/**
 * A single SSE subscriber's controller. Returned to endpoint handlers via the
 * `sse()` accessor on EndpointContext.
 */
export interface SseChannel {
  /** Send a named event with a JSON-serializable payload. */
  send(eventName: string, data: unknown): void;
  /** Close the stream gracefully. Sends a final `event: close` if you supply a reason. */
  close(reason?: string): void;
  /** True after `close()` has been called or the underlying socket has gone away. */
  readonly closed: boolean;
}

export interface SseBroadcaster {
  /** Push `event` with `data` to every currently-subscribed channel. */
  broadcast(eventName: string, data: unknown): void;
  /** Number of currently-active subscribers. Useful for metrics + tests. */
  readonly subscriberCount: number;
  /** Close every active channel. Used during graceful shutdown. */
  closeAll(reason?: string): void;
}

export interface CreateSseChannelOptions {
  /** Heartbeat interval in ms. Defaults to 15s — short enough for most proxy idle timeouts. */
  heartbeatMs?: number;
  /** Extra response headers to merge in (CORS headers, etc.). */
  extraHeaders?: Record<string, string>;
}

/**
 * Hijack a ServerResponse to become an SSE stream and return a controller.
 * Also returns a `register(broadcaster)` helper so the channel can be attached
 * to the global broadcaster registry.
 */
export function createSseChannel(
  res: ServerResponse,
  options: CreateSseChannelOptions = {},
): SseChannel {
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;

  res.writeHead(200, { ...SSE_HEADERS, ...options.extraHeaders });
  // Open the stream by sending a comment line. Some browsers buffer until the
  // first byte arrives.
  res.write(':ok\n\n');

  let closed = false;
  const heartbeat = setInterval(() => {
    if (closed) return;
    res.write(':heartbeat\n\n');
  }, heartbeatMs);
  // The heartbeat interval shouldn't keep Node alive on its own.
  heartbeat.unref?.();

  const finalize = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    try {
      res.end();
    } catch {
      // Already-destroyed socket; ignore.
    }
  };

  res.on('close', finalize);
  res.on('error', finalize);

  const channel: SseChannel = {
    send(eventName, data) {
      if (closed) return;
      // Per SSE spec: multiple `data:` lines for multi-line payloads.
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      const dataLines = payload
        .split('\n')
        .map((l) => `data: ${l}`)
        .join('\n');
      res.write(`event: ${eventName}\n${dataLines}\n\n`);
    },
    close(reason) {
      if (closed) return;
      if (reason) {
        try {
          res.write(`event: close\ndata: ${JSON.stringify({ reason })}\n\n`);
        } catch {
          // socket gone
        }
      }
      finalize();
    },
    get closed() {
      return closed;
    },
  };

  return channel;
}

/**
 * Create a broadcaster registry. The server holds one of these for the
 * lifetime of the process; each SSE handler registers its channel into it.
 */
export function createSseBroadcaster(): SseBroadcaster & {
  /** Internal: register a channel. Used by the server's SSE handler wrapper. */
  register(channel: SseChannel): void;
} {
  const channels = new Set<SseChannel>();

  return {
    register(channel) {
      channels.add(channel);
      // Auto-unregister when the channel closes. We poll via a microtask after
      // each send since SseChannel doesn't expose an `onClose`; instead we
      // sweep on each broadcast.
      const sweep = () => {
        for (const c of channels) {
          if (c.closed) channels.delete(c);
        }
      };
      // Also sweep eagerly on the next tick to clean up sockets that closed
      // mid-handshake.
      setImmediate(sweep);
    },
    broadcast(eventName, data) {
      for (const c of channels) {
        if (c.closed) {
          channels.delete(c);
          continue;
        }
        c.send(eventName, data);
      }
    },
    closeAll(reason) {
      for (const c of channels) {
        c.close(reason);
      }
      channels.clear();
    },
    get subscriberCount() {
      return channels.size;
    },
  };
}
