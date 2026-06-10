import path from 'node:path';
import { diagnosticId, type LintReport, LintReportSchema, SCHEMA_VERSION } from '@lintscope/schema';
import { describeAdapterContract } from '../src/testing';
import type { AdapterRunContext, LinterAdapter } from '../src/types';

/**
 * A toy adapter exercising the contract harness itself. Its payload format is
 * `[[relPath, severity, message], …]` — just enough to produce a real report.
 */
type ToyPayload = Array<[string, 'error' | 'warning', string]>;

const ROOT = path.resolve('/toy-proj');

const toyAdapter: LinterAdapter<ToyPayload> = {
  name: 'toylint',
  meta: { label: 'ToyLint' },
  priority: 99,
  bin: 'toylint',
  defaultPatterns: ['.'],
  installHint: 'pnpm add -D toylint',
  detect: () => null,
  buildArgs: ({ patterns }) => ['--json', ...patterns],
  map(payload, ctx: AdapterRunContext): LintReport {
    const diagnostics = payload.map(([relativePath, severity, message]) => {
      const base = { relativePath, line: 1, column: 1, ruleId: 'toy/rule', message };
      return {
        id: diagnosticId(base),
        filePath: path.join(ctx.cwd, relativePath),
        ...base,
        severity,
        source: 'toylint',
      };
    });
    const files = [...new Set(payload.map(([rel]) => rel))].map((rel) => ({
      path: path.join(ctx.cwd, rel),
      relativePath: rel,
      errorCount: diagnostics.filter((d) => d.relativePath === rel && d.severity === 'error')
        .length,
      warningCount: diagnostics.filter((d) => d.relativePath === rel && d.severity === 'warning')
        .length,
    }));
    return LintReportSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      generatedAt: '2026-06-10T10:00:00.000Z',
      projectRoot: ctx.cwd,
      linters: [{ name: 'toylint', version: ctx.version }],
      files,
      diagnostics,
      summary: {
        errorCount: diagnostics.filter((d) => d.severity === 'error').length,
        warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
        fixableCount: 0,
        fileCount: files.length,
        ruleFrequency: { 'toy/rule': diagnostics.length },
      },
    });
  },
};

describeAdapterContract(toyAdapter, {
  fixtures: [
    {
      name: 'two files with mixed severities',
      payload: [
        ['src/a.ts', 'error', 'broken'],
        ['src/a.ts', 'warning', 'iffy'],
        ['src/b.ts', 'error', 'also broken'],
      ],
      context: { cwd: ROOT, binaryPath: 'toylint', version: '1.0.0' },
    },
    {
      name: 'clean run',
      payload: [],
      context: { cwd: ROOT, binaryPath: 'toylint', version: '1.0.0' },
    },
  ],
});
