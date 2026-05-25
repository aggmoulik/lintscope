import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type LintReport, SCHEMA_VERSION } from '@lintscope/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LintContext } from '../src/context';
import { handleFileRequest } from '../src/handlers/file';
import { buildInitPayload } from '../src/handlers/init';
import { buildReportPayload } from '../src/handlers/report';
import { handleScanRequest } from '../src/handlers/scan';

function makeReport(overrides: Partial<LintReport> = {}): LintReport {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: '2026-05-26T10:00:00.000Z',
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
    ...overrides,
  };
}

function makeContext(report: LintReport, projectRoot = '/repo'): LintContext {
  return {
    projectRoot,
    name: 'lintscope',
    linter: 'eslint',
    report,
    rerun: () => Promise.resolve(report),
  };
}

describe('buildInitPayload', () => {
  const caps = { scan: true, watch: false, file: true };

  it('returns a schema-valid InitResponse', () => {
    const payload = buildInitPayload(makeContext(makeReport()), caps);
    expect(payload.apiVersion).toBe('1');
    expect(payload.schemaVersion).toBe(SCHEMA_VERSION);
    expect(payload.name).toBe('lintscope');
    expect(payload.linters).toEqual([{ name: 'eslint', version: '9.15.0' }]);
  });

  it('passes capabilities through from the caller', () => {
    expect(buildInitPayload(makeContext(makeReport()), caps).capabilities).toEqual(caps);
    const watchOn = buildInitPayload(makeContext(makeReport()), {
      scan: true,
      watch: true,
      file: true,
    });
    expect(watchOn.capabilities.watch).toBe(true);
  });
});

describe('buildReportPayload', () => {
  it('returns the schema-validated report unchanged', () => {
    const report = makeReport({
      summary: {
        errorCount: 2,
        warningCount: 1,
        fixableCount: 1,
        fileCount: 3,
        ruleFrequency: { 'no-console': 2 },
      },
    });
    const payload = buildReportPayload(makeContext(report));
    expect(payload.summary.errorCount).toBe(2);
    expect(payload.summary.ruleFrequency).toEqual({ 'no-console': 2 });
  });
});

describe('handleScanRequest', () => {
  it('calls rerun, updates context.report, and returns the fresh report', async () => {
    const original = makeReport();
    const fresh = makeReport({
      summary: { errorCount: 5, warningCount: 0, fixableCount: 0, fileCount: 1, ruleFrequency: {} },
    });
    const ctx = makeContext(original);
    ctx.rerun = () => Promise.resolve(fresh);

    const result = await handleScanRequest(ctx);
    expect(result.summary.errorCount).toBe(5);
    expect(ctx.report).toBe(fresh);
  });
});

describe('handleFileRequest', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'lintscope-cli-file-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns 200 + content for a valid file', async () => {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(path.join(dir, 'src'), { recursive: true });
    writeFileSync(path.join(dir, 'src', 'foo.ts'), 'export const x = 1;\n', 'utf8');
    const ctx = makeContext(makeReport({ projectRoot: dir }), dir);

    const result = await handleFileRequest(ctx, { path: 'src/foo.ts' });
    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.body.content).toBe('export const x = 1;\n');
      expect(result.body.relativePath).toBe('src/foo.ts');
      expect(result.body.size).toBe(20);
    }
  });

  it('returns 400 when the query is malformed', async () => {
    const ctx = makeContext(makeReport({ projectRoot: dir }), dir);
    const result = await handleFileRequest(ctx, { path: '' });
    expect(result.status).toBe(400);
  });

  it('returns 403 for path-traversal attempts', async () => {
    const ctx = makeContext(makeReport({ projectRoot: dir }), dir);
    const result = await handleFileRequest(ctx, { path: '../etc/passwd' });
    expect(result.status).toBe(403);
  });

  it('returns 404 for a file that does not exist inside the root', async () => {
    const ctx = makeContext(makeReport({ projectRoot: dir }), dir);
    const result = await handleFileRequest(ctx, { path: 'does-not-exist.ts' });
    expect(result.status).toBe(404);
  });
});
