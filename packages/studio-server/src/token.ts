import { randomUUID, timingSafeEqual } from 'node:crypto';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Generate a per-session token. UUID v4 — 122 bits of entropy, more than enough
 * to prevent guessing across the lifetime of a single CLI session.
 */
export function generateToken(): string {
  return randomUUID();
}

/**
 * Cheap structural check for a token-shaped string. Use this for fast rejection
 * of malformed input BEFORE attempting a constant-time compare against a secret.
 */
export function isValidToken(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_RE.test(value);
}

/**
 * Constant-time comparison of two tokens. Returns false on length mismatch
 * without entering the constant-time path (string length is not the secret).
 *
 * Use this anywhere you compare a presented token against the expected one.
 * Never use plain `===` on a secret.
 */
export function tokensMatch(presented: string, expected: string): boolean {
  if (typeof presented !== 'string' || typeof expected !== 'string') return false;
  if (presented.length !== expected.length) return false;
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // After the length guard above this is safe to call.
  return timingSafeEqual(a, b);
}
