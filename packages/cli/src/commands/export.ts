import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveLintScope, runLinters } from '@lintscope/core';
import type { LintReport } from '@lintscope/schema';
import { warnSkippedLinters } from '../warn-skipped';

export interface ExportOptions {
  cwd: string;
  /** Output path. `'-'` (or omitted) prints to stdout. */
  out?: string;
  /** Lint targets (positional CLI paths), relative to `cwd`. */
  targets?: string[];
}

/**
 * One-shot lint + emit JSON. Non-interactive — does not open a browser, does
 * not spawn a studio server. Used in CI / scripts that want to consume the
 * report programmatically.
 */
export async function runExport(options: ExportOptions): Promise<{
  report: LintReport;
  writtenTo: 'stdout' | string;
}> {
  const scope = resolveLintScope({
    cwd: path.resolve(options.cwd),
    ...(options.targets && options.targets.length > 0 ? { targets: options.targets } : {}),
  });
  const { report, skipped } = await runLinters({
    cwd: scope.projectRoot,
    ...(scope.patterns ? { patterns: scope.patterns } : {}),
  });
  warnSkippedLinters(skipped);
  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (!options.out || options.out === '-') {
    process.stdout.write(json);
    return { report, writtenTo: 'stdout' };
  }

  const target = path.resolve(options.cwd, options.out);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, json, 'utf8');
  return { report, writtenTo: target };
}
