import type { LintReport } from '@lintscope/schema';
import { describe, expect, it } from 'vitest';
import type { DetectedLinter } from '../src/detect-config';
import { runLinters } from '../src/run-linter';

function report(linterName: string): LintReport {
  return {
    schemaVersion: '1.0',
    generatedAt: '2026-01-01T00:00:00.000Z',
    projectRoot: '/repo',
    linters: [{ name: linterName, version: 'x' }],
    files: [],
    diagnostics: [],
    summary: { errorCount: 0, warningCount: 0, fixableCount: 0, fileCount: 0, ruleFrequency: {} },
  };
}

const oxcD: DetectedLinter = { linter: 'oxc', config: { path: '/repo/.oxlintrc.json' } };
const biomeD: DetectedLinter = { linter: 'biome', config: { path: '/repo/biome.json' } };

describe('runLinters', () => {
  it('runs all given linters in parallel and merges their reports', async () => {
    const { report: merged, skipped } = await runLinters(
      { cwd: '/repo', linters: [oxcD, biomeD] },
      (d) => Promise.resolve(report(d.linter)),
    );
    expect(merged.linters.map((l) => l.name)).toEqual(['oxc', 'biome']);
    expect(skipped).toEqual([]);
  });

  it('skips a linter that fails (e.g. not installed), records it, keeps the rest', async () => {
    const { report: merged, skipped } = await runLinters(
      { cwd: '/repo', linters: [oxcD, biomeD] },
      (d) => {
        if (d.linter === 'biome') return Promise.reject(new Error('Could not find `biome`'));
        return Promise.resolve(report(d.linter));
      },
    );
    expect(merged.linters.map((l) => l.name)).toEqual(['oxc']);
    expect(skipped).toEqual([{ linter: 'biome', reason: 'Could not find `biome`' }]);
  });

  it('throws when no linter is detected', async () => {
    await expect(runLinters({ cwd: '/repo', linters: [] })).rejects.toThrow(/No linter detected/);
  });

  it('throws when every detected linter fails', async () => {
    await expect(
      runLinters({ cwd: '/repo', linters: [oxcD, biomeD] }, () =>
        Promise.reject(new Error('boom')),
      ),
    ).rejects.toThrow(/All .*failed/);
  });
});
