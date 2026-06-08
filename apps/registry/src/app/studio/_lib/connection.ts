import { z } from 'zod';

/**
 * Studio URL params — ALL optional now. The CLI omits `host`/`port` when it
 * binds a discovery-range port (the page probes for it) and never puts the
 * token in the URL (fetched via `/handshake`). Older links may still carry
 * `host`/`port`/`token`; we accept them. Only malformed *present* values error.
 */
const ParamsSchema = z.object({
  host: z.string().min(1).optional(),
  port: z
    .string()
    .regex(/^\d+$/, 'port must be a positive integer')
    .refine((s) => Number(s) > 0 && Number(s) < 65_536, 'port out of range')
    .optional(),
  token: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      'token must be a UUID v4',
    )
    .optional(),
  name: z.string().min(1).optional(),
});

export type ParsedStudioParams = z.infer<typeof ParamsSchema>;

/** A concrete local server address. */
export type StudioTarget = { host: string; port: string; name?: string };

/** A resolved connection: a target plus the session token (from URL or handshake). */
export type StudioConnection = StudioTarget & { token: string };

export type ConnectionParseResult =
  | { ok: true; params: ParsedStudioParams }
  | { ok: false; reason: string };

/**
 * Parse + validate the studio URL params. Everything is optional, so a bare
 * `…/studio` is valid (the page discovers host/port and handshakes for the
 * token). Returns an error only when a value that IS present is malformed.
 */
export function parseConnectionParams(
  params: URLSearchParams | ReadonlyURLSearchParams,
): ConnectionParseResult {
  const get = (k: string): string | undefined => params.get(k) || undefined;
  const parsed = ParamsSchema.safeParse({
    host: get('host'),
    port: get('port'),
    token: get('token'),
    name: get('name'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  return { ok: true, params: parsed.data };
}

/** Minimal subset of URLSearchParams we need; lets us accept Next's ReadonlyURLSearchParams. */
type ReadonlyURLSearchParams = {
  get(name: string): string | null;
};
