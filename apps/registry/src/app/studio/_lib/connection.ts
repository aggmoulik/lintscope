import { z } from 'zod';

/**
 * URL parameters the CLI passes when opening the studio. The CLI builds the
 * URL via `createStudioServer`'s `url` property; the studio page parses it
 * back via this schema.
 */
const ConnectionParamsSchema = z.object({
  host: z.string().min(1),
  port: z
    .string()
    .regex(/^\d+$/, 'port must be a positive integer')
    .refine((s) => Number(s) > 0 && Number(s) < 65_536, 'port out of range'),
  token: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      'token must be a UUID v4',
    ),
  /** Optional human name the CLI included (e.g. "lintscope"). */
  name: z.string().min(1).optional(),
});

export type StudioConnection = z.infer<typeof ConnectionParamsSchema>;

export type ConnectionParseResult =
  | { ok: true; connection: StudioConnection }
  | { ok: false; missing: string[]; reason: string };

/**
 * Parse + validate the studio's URL params. Returns a discriminated result so
 * the page can render a precise error UI when the URL is malformed (typo,
 * truncation, hand-edit, etc.) rather than dying mid-fetch.
 */
export function parseConnectionParams(
  params: URLSearchParams | ReadonlyURLSearchParams,
): ConnectionParseResult {
  const raw = {
    host: params.get('host') ?? '',
    port: params.get('port') ?? '',
    token: params.get('token') ?? '',
    ...(params.get('name') ? { name: params.get('name') ?? '' } : {}),
  };

  const missing: string[] = [];
  for (const key of ['host', 'port', 'token'] as const) {
    if (!raw[key]) missing.push(key);
  }
  if (missing.length > 0) {
    return { ok: false, missing, reason: `Missing required URL params: ${missing.join(', ')}` };
  }

  const parsed = ConnectionParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      missing: [],
      reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  return { ok: true, connection: parsed.data };
}

/** Minimal subset of URLSearchParams we need; lets us accept Next's ReadonlyURLSearchParams. */
type ReadonlyURLSearchParams = {
  get(name: string): string | null;
};
