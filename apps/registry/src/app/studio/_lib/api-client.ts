import {
  FileResponseSchema,
  HTTP_ENDPOINTS,
  type InitResponse,
  InitResponseSchema,
  type ReportResponse,
  ReportResponseSchema,
  type ScanResponse,
  ScanResponseSchema,
} from '@lintscope/api-schema';
import type { z } from 'zod';
import type { StudioConnection } from './connection';

/** Thrown when the server returned 401 — wrong token or token omitted. */
export class StudioAuthError extends Error {
  constructor() {
    super('Studio server rejected the token');
    this.name = 'StudioAuthError';
  }
}

/** Thrown when the fetch itself failed (network down, CLI exited, etc.). */
export class StudioConnectionError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'StudioConnectionError';
  }
}

/** Thrown when the response was 4xx/5xx other than 401. */
export class StudioHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'StudioHttpError';
  }
}

/** Thrown when the response JSON failed Zod validation — server / client schema drift. */
export class StudioSchemaError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly zodMessage: string,
  ) {
    super(`Response shape mismatch on ${endpoint}: ${zodMessage}`);
    this.name = 'StudioSchemaError';
  }
}

function baseUrl({ host, port }: StudioConnection): string {
  return `http://${host}:${port}`;
}

/**
 * Append `?token=` to the path. Used for both fetch and EventSource — the
 * latter cannot set custom headers, so we standardize on the query parameter.
 */
export function authedUrl(
  connection: StudioConnection,
  path: string,
  query?: Record<string, string>,
): string {
  const url = new URL(`${baseUrl(connection)}${path}`);
  url.searchParams.set('token', connection.token);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  return url.toString();
}

async function authedFetch<T>(
  connection: StudioConnection,
  endpoint: { method: string; path: string },
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(authedUrl(connection, endpoint.path), {
      ...init,
      method: endpoint.method,
      cache: 'no-store',
    });
  } catch (err) {
    throw new StudioConnectionError(
      `Could not reach studio server at ${baseUrl(connection)} — is the CLI still running?`,
      err,
    );
  }

  if (res.status === 401) throw new StudioAuthError();
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new StudioHttpError(res.status, text || res.statusText);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    throw new StudioConnectionError(`Studio server returned non-JSON on ${endpoint.path}`, err);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new StudioSchemaError(
      endpoint.path,
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  return parsed.data;
}

export const studioApi = {
  init(connection: StudioConnection): Promise<InitResponse> {
    return authedFetch(connection, HTTP_ENDPOINTS.init, InitResponseSchema);
  },
  report(connection: StudioConnection): Promise<ReportResponse> {
    return authedFetch(connection, HTTP_ENDPOINTS.report, ReportResponseSchema);
  },
  scan(connection: StudioConnection): Promise<ScanResponse> {
    return authedFetch(connection, HTTP_ENDPOINTS.scan, ScanResponseSchema);
  },
  /**
   * Fetch source for one file by its `relativePath` (relative to projectRoot).
   * Returns just the UTF-8 content — the caller is the autofix preview, which
   * doesn't care about the path echo. The server enforces `safePath`
   * containment, so a malicious path is a 4xx, not a leak.
   */
  async file(connection: StudioConnection, relativePath: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(authedUrl(connection, HTTP_ENDPOINTS.file.path, { path: relativePath }), {
        method: HTTP_ENDPOINTS.file.method,
        cache: 'no-store',
      });
    } catch (err) {
      throw new StudioConnectionError(
        `Could not reach studio server at ${baseUrl(connection)} — is the CLI still running?`,
        err,
      );
    }
    if (res.status === 401) throw new StudioAuthError();
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new StudioHttpError(res.status, text || res.statusText);
    }
    const json: unknown = await res.json();
    const parsed = FileResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new StudioSchemaError(
        HTTP_ENDPOINTS.file.path,
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }
    return parsed.data.content;
  },
};
