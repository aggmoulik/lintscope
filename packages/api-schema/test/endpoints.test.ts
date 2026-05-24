import { SCHEMA_VERSION } from '@lintscope/schema';
import { describe, expect, it } from 'vitest';
import {
  ErrorResponseSchema,
  FileQuerySchema,
  FileResponseSchema,
  HTTP_ENDPOINTS,
  InitResponseSchema,
  ReportResponseSchema,
  ScanRequestSchema,
  ScanResponseSchema,
} from '../src/endpoints';
import { API_VERSION } from '../src/version';

describe('HTTP_ENDPOINTS constants', () => {
  it('lists all five endpoints with the expected method+path pairs', () => {
    expect(HTTP_ENDPOINTS).toEqual({
      init: { method: 'GET', path: '/init' },
      report: { method: 'GET', path: '/report' },
      file: { method: 'GET', path: '/file' },
      scan: { method: 'POST', path: '/scan' },
      events: { method: 'GET', path: '/events' },
    });
  });
});

describe('InitResponseSchema', () => {
  const validInit = {
    apiVersion: API_VERSION,
    schemaVersion: SCHEMA_VERSION,
    name: 'lintscope',
    linters: [{ name: 'eslint', version: '9.15.0' }],
    capabilities: { scan: true, watch: true, file: true },
  };

  it('accepts a well-formed response', () => {
    expect(() => InitResponseSchema.parse(validInit)).not.toThrow();
  });

  it('rejects a wrong apiVersion literal', () => {
    expect(() => InitResponseSchema.parse({ ...validInit, apiVersion: '2' })).toThrow();
    expect(() => InitResponseSchema.parse({ ...validInit, apiVersion: 1 })).toThrow();
  });

  it('rejects a wrong schemaVersion literal', () => {
    expect(() => InitResponseSchema.parse({ ...validInit, schemaVersion: '0.9' })).toThrow();
  });

  it('accepts an empty linters array (server still starting up)', () => {
    expect(() => InitResponseSchema.parse({ ...validInit, linters: [] })).not.toThrow();
  });

  it('requires all three capability fields', () => {
    expect(() =>
      InitResponseSchema.parse({
        ...validInit,
        capabilities: { scan: true, watch: true },
      }),
    ).toThrow();
  });

  it('rejects non-string name', () => {
    expect(() => InitResponseSchema.parse({ ...validInit, name: 42 })).toThrow();
    expect(() => InitResponseSchema.parse({ ...validInit, name: '' })).toThrow();
  });
});

describe('ReportResponseSchema / ScanResponseSchema', () => {
  const reportFixture = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: '2026-05-25T10:00:00.000Z',
    projectRoot: '/repo',
    linters: [{ name: 'eslint', version: '9.15.0' }],
    files: [],
    diagnostics: [],
    summary: {
      errorCount: 0,
      warningCount: 0,
      fixableCount: 0,
      fileCount: 0,
      ruleFrequency: {},
    },
  };

  it('re-exports LintReportSchema unchanged', () => {
    expect(() => ReportResponseSchema.parse(reportFixture)).not.toThrow();
    expect(() => ScanResponseSchema.parse(reportFixture)).not.toThrow();
  });
});

describe('FileQuerySchema / FileResponseSchema', () => {
  it('accepts a non-empty path', () => {
    expect(FileQuerySchema.parse({ path: 'src/foo.ts' }).path).toBe('src/foo.ts');
  });

  it('rejects empty path', () => {
    expect(() => FileQuerySchema.parse({ path: '' })).toThrow();
  });

  it('rejects missing path', () => {
    expect(() => FileQuerySchema.parse({})).toThrow();
  });

  it('accepts a well-formed file response', () => {
    expect(() =>
      FileResponseSchema.parse({
        path: '/repo/src/foo.ts',
        relativePath: 'src/foo.ts',
        content: 'export const x = 1;\n',
        size: 21,
      }),
    ).not.toThrow();
  });

  it('rejects negative size', () => {
    expect(() =>
      FileResponseSchema.parse({
        path: '/repo/src/foo.ts',
        relativePath: 'src/foo.ts',
        content: '',
        size: -1,
      }),
    ).toThrow();
  });
});

describe('ScanRequestSchema', () => {
  it('accepts an empty body', () => {
    expect(() => ScanRequestSchema.parse({})).not.toThrow();
  });

  it('accepts a paths array (reserved field)', () => {
    expect(() => ScanRequestSchema.parse({ paths: ['src/foo.ts'] })).not.toThrow();
  });

  it('rejects a non-array paths field', () => {
    expect(() => ScanRequestSchema.parse({ paths: 'src/foo.ts' })).toThrow();
  });
});

describe('ErrorResponseSchema', () => {
  it('accepts a minimal error', () => {
    expect(() => ErrorResponseSchema.parse({ error: 'Not found' })).not.toThrow();
  });

  it('accepts an error with errorId + message', () => {
    expect(() =>
      ErrorResponseSchema.parse({
        error: 'Internal server error',
        errorId: 'abc-123',
        message: 'kaboom',
      }),
    ).not.toThrow();
  });

  it('rejects an empty error string', () => {
    expect(() => ErrorResponseSchema.parse({ error: '' })).toThrow();
  });
});
