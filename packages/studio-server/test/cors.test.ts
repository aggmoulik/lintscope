import { describe, expect, it } from 'vitest';
import { buildCorsHeaders, isOriginAllowed, normalizeAllowOrigin } from '../src/cors';

describe('normalizeAllowOrigin', () => {
  it('accepts a single string and returns a 1-element array', () => {
    expect(normalizeAllowOrigin('https://lintscope.dev')).toEqual(['https://lintscope.dev']);
  });

  it('accepts an array and returns it as-is', () => {
    const arr = ['https://a.dev', 'https://b.dev'];
    expect(normalizeAllowOrigin(arr)).toEqual(arr);
  });

  it('throws when given the wildcard "*"', () => {
    expect(() => normalizeAllowOrigin('*')).toThrowError(/wildcard/i);
    expect(() => normalizeAllowOrigin(['*'])).toThrowError(/wildcard/i);
  });

  it('throws when given an empty array', () => {
    expect(() => normalizeAllowOrigin([])).toThrowError(/at least one/i);
  });

  it('throws for entries that are not http(s) URLs', () => {
    expect(() => normalizeAllowOrigin('ftp://x.dev')).toThrowError(/http/i);
    expect(() => normalizeAllowOrigin('not-a-url')).toThrowError(/http/i);
  });
});

describe('isOriginAllowed', () => {
  const allowed = ['https://lintscope.dev', 'http://localhost:3000'];

  it('returns true for an exact match', () => {
    expect(isOriginAllowed('https://lintscope.dev', allowed)).toBe(true);
    expect(isOriginAllowed('http://localhost:3000', allowed)).toBe(true);
  });

  it('returns false for a different scheme', () => {
    expect(isOriginAllowed('http://lintscope.dev', allowed)).toBe(false);
  });

  it('returns false for a different host', () => {
    expect(isOriginAllowed('https://evil.dev', allowed)).toBe(false);
  });

  it('returns false for a missing / undefined origin', () => {
    expect(isOriginAllowed(undefined, allowed)).toBe(false);
    expect(isOriginAllowed('', allowed)).toBe(false);
  });

  it('does NOT match by suffix (subdomain protection)', () => {
    expect(isOriginAllowed('https://attacker-lintscope.dev', allowed)).toBe(false);
    expect(isOriginAllowed('https://lintscope.dev.attacker.com', allowed)).toBe(false);
  });
});

describe('buildCorsHeaders', () => {
  it('returns full CORS headers for an allowed origin', () => {
    const h = buildCorsHeaders({
      origin: 'https://lintscope.dev',
      allowed: ['https://lintscope.dev'],
    });
    expect(h['Access-Control-Allow-Origin']).toBe('https://lintscope.dev');
    expect(h.Vary).toBe('Origin');
    expect(h['Access-Control-Allow-Methods']).toContain('GET');
    expect(h['Access-Control-Allow-Methods']).toContain('POST');
    expect(h['Access-Control-Allow-Methods']).toContain('OPTIONS');
    expect(h['Access-Control-Allow-Headers']).toContain('Content-Type');
    expect(h['Access-Control-Allow-Headers']).toContain('Authorization');
  });

  it('omits Access-Control-Allow-Origin when origin is not allowed', () => {
    const h = buildCorsHeaders({ origin: 'https://evil.dev', allowed: ['https://lintscope.dev'] });
    expect(h['Access-Control-Allow-Origin']).toBeUndefined();
    // Vary is still set so caches don't poison
    expect(h.Vary).toBe('Origin');
  });

  it('omits Access-Control-Allow-Origin when origin is undefined', () => {
    const h = buildCorsHeaders({ origin: undefined, allowed: ['https://lintscope.dev'] });
    expect(h['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('includes Max-Age for preflight caching', () => {
    const h = buildCorsHeaders({
      origin: 'https://lintscope.dev',
      allowed: ['https://lintscope.dev'],
    });
    expect(Number(h['Access-Control-Max-Age'])).toBeGreaterThan(0);
  });
});
