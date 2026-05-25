import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runEslint } from '@lintscope/core';
import type { LintReport } from '@lintscope/schema';

export interface ScanOptions {
  cwd: string;
  /** Output path. `'-'` (or omitted) prints to stdout. */
  out?: string;
}

/**
 * One-shot lint + emit JSON. Non-interactive — does not open a browser, does
 * not spawn a studio server. Used in CI / scripts.
 */
export async function runScan(options: ScanOptions): Promise<{
  report: LintReport;
  writtenTo: 'stdout' | string;
}> {
  const report = await runEslint({ cwd: options.cwd });
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
