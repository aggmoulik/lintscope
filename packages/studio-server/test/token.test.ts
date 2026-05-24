import { describe, expect, it } from 'vitest';
import { generateToken, isValidToken, tokensMatch } from '../src/token';

describe('generateToken', () => {
  it('returns a 36-char UUID v4-shaped string', () => {
    const t = generateToken();
    expect(t).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('returns a different token on every call', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateToken()));
    expect(tokens.size).toBe(50);
  });
});

describe('isValidToken', () => {
  it('accepts a freshly generated token', () => {
    expect(isValidToken(generateToken())).toBe(true);
  });

  it('rejects empty string, undefined, null', () => {
    expect(isValidToken('')).toBe(false);
    // @ts-expect-error — runtime guard for untyped callers
    expect(isValidToken(undefined)).toBe(false);
    // @ts-expect-error
    expect(isValidToken(null)).toBe(false);
  });

  it('rejects non-UUID strings', () => {
    expect(isValidToken('not-a-uuid')).toBe(false);
    expect(isValidToken('0'.repeat(36))).toBe(false);
    expect(isValidToken('zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz')).toBe(false);
  });
});

describe('tokensMatch', () => {
  it('returns true for the same string', () => {
    const t = generateToken();
    expect(tokensMatch(t, t)).toBe(true);
  });

  it('returns false for different tokens', () => {
    expect(tokensMatch(generateToken(), generateToken())).toBe(false);
  });

  it('returns false when lengths differ (constant-time path requires same length)', () => {
    expect(tokensMatch('short', generateToken())).toBe(false);
    expect(tokensMatch(generateToken(), '')).toBe(false);
  });

  it('handles all-equal-but-one mismatches without leaking via fast-path', () => {
    const a = generateToken();
    // Flip the last character to something definitely different
    const lastChar = a[a.length - 1];
    const flipped = lastChar === 'a' ? 'b' : 'a';
    const b = `${a.slice(0, -1)}${flipped}`;
    expect(tokensMatch(a, b)).toBe(false);
  });
});
