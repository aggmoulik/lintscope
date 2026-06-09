import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { type BiomeReport, mapBiomeResults } from '../src/adapters/biome';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/biome-results.json'), 'utf8'),
) as BiomeReport;

// Captured from a real `biome lint --reporter=json` run: a fixable rule
// (useConst → `tags: ["fixable"]`) alongside a non-fixable one (noForEach).
const FIXABLE = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/biome-fixable.json'), 'utf8'),
) as BiomeReport;

describe('mapBiomeResults', () => {
  const ctx = { cwd: '/repo', biomeVersion: '1.9.4' };

  it('produces a schema-valid LintReport with source=biome', () => {
    const report = mapBiomeResults(FIXTURE, ctx);
    expect(report.schemaVersion).toBe('1.0');
    expect(report.linters[0]?.name).toBe('biome');
    expect(report.diagnostics.every((d) => d.source === 'biome')).toBe(true);
  });

  it('counts errors and warnings from the diagnostic severities (not the summary)', () => {
    // We re-derive these from the actual diagnostic list so we ignore any
    // drift in Biome's summary field shape.
    const report = mapBiomeResults(FIXTURE, ctx);
    expect(report.summary.errorCount).toBe(2);
    expect(report.summary.warningCount).toBe(1);
    expect(report.summary.fileCount).toBe(3);
  });

  it('records per-rule frequency by category', () => {
    const report = mapBiomeResults(FIXTURE, ctx);
    expect(report.summary.ruleFrequency).toEqual({
      'lint/suspicious/noExplicitAny': 1,
      'lint/suspicious/noDebugger': 1,
      'lint/style/useConst': 1,
    });
  });

  it('maps severity hint → info', () => {
    const synthetic: BiomeReport = {
      diagnostics: [
        {
          category: 'lint/style/useConst',
          severity: 'hint',
          description: 'A hint.',
          location: { path: { file: 'a.ts' }, sourceCode: '', span: [0, 1] },
        },
      ],
    };
    const report = mapBiomeResults(synthetic, ctx);
    expect(report.diagnostics[0]?.severity).toBe('info');
  });

  it('accepts both string and { file } path shapes', () => {
    const report = mapBiomeResults(FIXTURE, ctx);
    const noDebugger = report.diagnostics.find((d) => d.ruleId === 'lint/suspicious/noDebugger');
    expect(noDebugger?.relativePath).toBe('src/util.ts');
    const noAny = report.diagnostics.find((d) => d.ruleId === 'lint/suspicious/noExplicitAny');
    expect(noAny?.relativePath).toBe('src/handler.ts');
  });

  it('derives line / column from byte offset + sourceCode', () => {
    const report = mapBiomeResults(FIXTURE, ctx);
    const noAny = report.diagnostics.find((d) => d.ruleId === 'lint/suspicious/noExplicitAny');
    // sourceCode: "export function handler(x: any) {\n  console.log(x);\n  return x;\n}\n"
    // span [27, 30] → byte 27 is the 'a' in "any" on line 1
    expect(noAny?.line).toBe(1);
    expect(noAny?.column).toBe(28);
    expect(noAny?.endLine).toBe(1);
    expect(noAny?.endColumn).toBe(31);
  });

  it('correctly counts lines across newlines', () => {
    const report = mapBiomeResults(FIXTURE, ctx);
    const noDebugger = report.diagnostics.find((d) => d.ruleId === 'lint/suspicious/noDebugger');
    // sourceCode: "function foo() {\n  debugger;\n  return 1;\n}\n"
    // span [19, 28] → byte 19 is the 'd' in "debugger" on line 2 column 3
    expect(noDebugger?.line).toBe(2);
    expect(noDebugger?.column).toBe(3);
  });

  it('falls back to message tree → string when description is empty', () => {
    const synthetic: BiomeReport = {
      diagnostics: [
        {
          category: 'lint/x/y',
          severity: 'error',
          description: '',
          message: { content: [{ Slice: 'concat ' }, { Slice: 'me' }] },
          location: { path: 'a.ts', sourceCode: 'x\n', span: [0, 1] },
        },
      ],
    };
    const report = mapBiomeResults(synthetic, ctx);
    expect(report.diagnostics[0]?.message).toBe('concat me');
  });

  it('falls back to category when neither description nor message yields a string', () => {
    const synthetic: BiomeReport = {
      diagnostics: [
        {
          category: 'lint/x/y',
          severity: 'error',
          description: '',
          location: { path: 'a.ts', sourceCode: '', span: [0, 0] },
        },
      ],
    };
    const report = mapBiomeResults(synthetic, ctx);
    expect(report.diagnostics[0]?.message).toBe('lint/x/y');
  });

  it('skips diagnostics with no resolvable path', () => {
    const synthetic: BiomeReport = {
      diagnostics: [
        {
          category: 'lint/x/y',
          severity: 'error',
          description: 'orphan',
          location: { span: [0, 1] },
        },
      ],
    };
    const report = mapBiomeResults(synthetic, ctx);
    expect(report.diagnostics).toHaveLength(0);
  });

  it('handles an empty payload', () => {
    const report = mapBiomeResults({}, ctx);
    expect(report.diagnostics).toEqual([]);
    expect(report.summary.fileCount).toBe(0);
  });

  it('passes configPath through to the linter info', () => {
    const report = mapBiomeResults(FIXTURE, { ...ctx, configPath: '/repo/biome.json' });
    expect(report.linters[0]?.configPath).toBe('/repo/biome.json');
  });
});

describe('mapBiomeResults — fixability', () => {
  const ctx = { cwd: '/repo', biomeVersion: '1.8.3' };

  it('marks diagnostics with a Biome `fixable` tag as fixable', () => {
    const report = mapBiomeResults(FIXABLE, ctx);
    const useConst = report.diagnostics.find((d) => d.ruleId === 'lint/style/useConst');
    const noForEach = report.diagnostics.find((d) => d.ruleId === 'lint/complexity/noForEach');
    expect(useConst?.fixable).toBe(true);
    expect(noForEach?.fixable).toBeUndefined();
  });

  it('counts only the fixable diagnostics in the summary', () => {
    const report = mapBiomeResults(FIXABLE, ctx);
    expect(report.summary.fixableCount).toBe(1);
  });
});
