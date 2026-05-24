/**
 * CORS allowlist + header builder for the studio HTTP server.
 *
 * Design choices:
 *  - **No wildcard.** `*` is explicitly rejected. The studio server always
 *    knows which origin should be allowed (the hosted UI URL), and a wildcard
 *    would let any page on the internet probe the local server.
 *  - **Exact origin match only.** No suffix matching, no protocol-relative
 *    matching — those have been the source of subtle CORS bypasses.
 *  - **`Vary: Origin` is always set** so caches don't poison cross-origin
 *    responses across different requesting origins.
 */

const PREFLIGHT_MAX_AGE_SECONDS = 600; // 10 minutes

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = ['Content-Type', 'Authorization'];

export type AllowOrigin = string | string[];

/**
 * Validate + normalize the user-supplied `allowOrigin` config. Returns a list
 * of allowed origins. Throws on misconfiguration (wildcard, non-http schemes,
 * empty list).
 */
export function normalizeAllowOrigin(value: AllowOrigin): string[] {
  const arr = Array.isArray(value) ? value : [value];

  if (arr.length === 0) {
    throw new Error('allowOrigin must include at least one origin');
  }

  for (const origin of arr) {
    if (origin === '*') {
      throw new Error(
        'allowOrigin does not accept the wildcard "*"; specify the exact hosted UI origin',
      );
    }
    if (typeof origin !== 'string' || !/^https?:\/\//.test(origin)) {
      throw new Error(`allowOrigin entries must be http or https URLs; got: ${String(origin)}`);
    }
  }

  return arr;
}

/**
 * Does the request `Origin` header match any entry in our allowlist?
 *
 * Uses strict equality — no suffix matching, no scheme/port flexibility. This
 * is deliberate: subdomain-suffix matching is a classic CORS bypass vector
 * (`evil-lintscope.dev` matching a suffix on `lintscope.dev`).
 */
export function isOriginAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (typeof origin !== 'string' || origin.length === 0) return false;
  return allowed.includes(origin);
}

export interface BuildCorsHeadersInput {
  origin: string | undefined;
  allowed: string[];
}

/**
 * Build the headers to attach to a response (preflight OR actual). Returns
 * `Access-Control-Allow-Origin` ONLY if the requesting origin matches the
 * allowlist; otherwise the header is omitted (the browser will block the
 * response on the client side).
 */
export function buildCorsHeaders({
  origin,
  allowed,
}: BuildCorsHeadersInput): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
    'Access-Control-Allow-Headers': ALLOWED_HEADERS.join(', '),
    'Access-Control-Max-Age': String(PREFLIGHT_MAX_AGE_SECONDS),
  };

  if (isOriginAllowed(origin, allowed)) {
    // We know origin is a string here (isOriginAllowed checked).
    headers['Access-Control-Allow-Origin'] = origin as string;
  }

  return headers;
}
