import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  type Diagnostic,
  diagnosticId,
  type LintReport,
  LintReportSchema,
  SCHEMA_VERSION,
} from '@lintscope/schema';
import { resolveLinterBin, resolveLinterVersion } from '../resolve-bin';

/**
 * Subset of Biome's `--reporter=json` output that we depend on. Declared
 * structurally so the mapper survives minor format drift.
 *
 * Biome 2.x format quirks:
 *  - `location.path` can be either `string` or `{ file: string }`
 *  - `location.span` is byte offsets, not line/column — we derive those from
 *    `location.sourceCode`
 *  - `message` can be a structured rich-text tree OR a plain string; we fall
 *    back to `description` (which is always a plain string).
 */
export interface BiomeDiagnostic {
  category: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  description: string;
  message?: unknown;
  location?: {
    path?: string | { file?: string };
    sourceCode?: string;
    span?: [number, number];
  };
}

export interface BiomeReport {
  summary?: {
    errors?: number;
    warnings?: number;
  };
  diagnostics?: BiomeDiagnostic[];
}

export interface MapBiomeContext {
  cwd: string;
  biomeVersion: string;
  configPath?: string;
}

const BIOME_SEVERITY_MAP: Record<BiomeDiagnostic['severity'], Diagnostic['severity']> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
  hint: 'info',
};

/**
 * Map a Biome `--reporter=json` payload into a normalized LintReport.
 *
 * Pure function — does no I/O. Exported separately from `runBiome` so we can
 * test it against captured Biome output without spawning the binary.
 */
export function mapBiomeResults(payload: BiomeReport, ctx: MapBiomeContext): LintReport {
  const diagnostics: Diagnostic[] = [];
  const filesIndex = new Map<string, { errorCount: number; warningCount: number }>();
  const ruleFrequency: Record<string, number> = {};

  for (const d of payload.diagnostics ?? []) {
    const filePath = extractPath(d.location?.path);
    if (!filePath) continue;

    const absolute = path.resolve(ctx.cwd, filePath);
    const relativePath = path.relative(ctx.cwd, absolute) || path.basename(absolute);

    const span = d.location?.span;
    const source = d.location?.sourceCode ?? '';
    const { line, column } = span ? offsetToLineCol(source, span[0]) : { line: 1, column: 1 };
    const end = span ? offsetToLineCol(source, span[1]) : undefined;

    const severity = BIOME_SEVERITY_MAP[d.severity];
    const message = d.description || stringifyMessage(d.message) || d.category;
    const ruleId = d.category;
    ruleFrequency[ruleId] = (ruleFrequency[ruleId] ?? 0) + 1;

    const diagnostic: Diagnostic = {
      id: diagnosticId({ relativePath, line, column, ruleId, message }),
      filePath: absolute,
      relativePath,
      line,
      column,
      ruleId,
      severity,
      message,
      source: 'biome',
      category: ruleId,
    };
    if (end) {
      diagnostic.endLine = end.line;
      diagnostic.endColumn = end.column;
    }
    diagnostics.push(diagnostic);

    const bucket = filesIndex.get(absolute) ?? { errorCount: 0, warningCount: 0 };
    if (severity === 'error') bucket.errorCount += 1;
    else if (severity === 'warning') bucket.warningCount += 1;
    filesIndex.set(absolute, bucket);
  }

  const files: LintReport['files'] = [];
  for (const [absolute, counts] of filesIndex) {
    files.push({
      path: absolute,
      relativePath: path.relative(ctx.cwd, absolute) || path.basename(absolute),
      ...counts,
    });
  }

  const totalErrors = diagnostics.filter((d) => d.severity === 'error').length;
  const totalWarnings = diagnostics.filter((d) => d.severity === 'warning').length;

  const report: LintReport = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    projectRoot: ctx.cwd,
    linters: [
      ctx.configPath
        ? { name: 'biome', version: ctx.biomeVersion, configPath: ctx.configPath }
        : { name: 'biome', version: ctx.biomeVersion },
    ],
    files,
    diagnostics,
    summary: {
      errorCount: totalErrors,
      warningCount: totalWarnings,
      // Biome's JSON reporter doesn't expose per-diagnostic fixability; the
      // CLI uses --apply to fix in-place. We report 0 here and let consumers
      // run `biome check --apply` themselves.
      fixableCount: 0,
      fileCount: files.length,
      ruleFrequency,
    },
  };

  return LintReportSchema.parse(report);
}

function extractPath(
  p: BiomeDiagnostic['location'] extends { path?: infer P } ? P : unknown,
): string | undefined {
  if (typeof p === 'string') return p;
  if (
    p &&
    typeof p === 'object' &&
    'file' in p &&
    typeof (p as { file?: unknown }).file === 'string'
  ) {
    return (p as { file: string }).file;
  }
  return undefined;
}

function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  if (!source || offset <= 0) return { line: 1, column: 1 };
  let line = 1;
  let column = 1;
  const limit = Math.min(offset, source.length);
  for (let i = 0; i < limit; i++) {
    if (source.charCodeAt(i) === 0x0a /* \n */) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function stringifyMessage(message: unknown): string {
  if (typeof message === 'string') return message;
  // Biome's structured message is a tree of { content: Array<{ Slice: string } | string> }.
  // Walk it shallowly and concatenate any string slices we find.
  if (message && typeof message === 'object') {
    const node = message as { content?: unknown };
    if (Array.isArray(node.content)) {
      return node.content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && 'Slice' in part) {
            const slice = (part as { Slice?: unknown }).Slice;
            return typeof slice === 'string' ? slice : '';
          }
          return '';
        })
        .join('');
    }
  }
  return '';
}

export interface RunBiomeOptions {
  cwd: string;
  /** Globs / paths to lint. Defaults to `['.']` so Biome's own config drives the file set. */
  patterns?: string[];
  /**
   * Explicit biome binary path (override). When omitted, the project-local
   * `node_modules/.bin/biome` is preferred, falling back to `biome` on PATH.
   */
  binary?: string;
}

/**
 * Spawn `biome check --reporter=json` and normalize the output into a
 * LintReport. Exits with a clear error if Biome is not installed.
 */
export async function runBiome(options: RunBiomeOptions): Promise<LintReport> {
  const patterns = options.patterns ?? ['.'];
  const { command: binary, resolvedFrom } = resolveLinterBin({
    projectRoot: options.cwd,
    name: 'biome',
    ...(options.binary ? { override: options.binary } : {}),
  });
  const args = ['check', '--reporter=json', ...patterns];

  const child = spawn(binary, args, {
    cwd: options.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    // A local `.bin` shim on Windows is a `.cmd`, which Node refuses to spawn
    // without a shell (CVE-2024-27980). PATH/override stay shell-free.
    // NOTE: shell mode doesn't quote a binary path containing spaces — tracked
    // as a Phase D Windows follow-up (adopt cross-spawn if it bites).
    shell: resolvedFrom === 'local' && /\.(cmd|bat)$/i.test(binary),
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
  child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

  let spawnError: NodeJS.ErrnoException | undefined;
  child.on('error', (err) => {
    spawnError = err as NodeJS.ErrnoException;
  });

  const exitCode: number | null = await new Promise((resolve) => {
    child.once('close', resolve);
  });

  if (spawnError) {
    if (spawnError.code === 'ENOENT') {
      throw new Error(
        `Could not find \`${binary}\` on PATH. Install Biome (\`pnpm add -D @biomejs/biome\`) or pass --binary.`,
      );
    }
    throw spawnError;
  }

  const stdout = Buffer.concat(stdoutChunks).toString('utf8');
  const stderr = Buffer.concat(stderrChunks).toString('utf8');

  // Biome exits 1 when there are lint findings — that's normal.
  // Exits 2+ signal a real error (config invalid, binary crashed, etc.).
  if (exitCode !== null && exitCode > 1) {
    throw new Error(
      `biome exited with code ${exitCode}: ${stderr.trim() || stdout.trim() || 'no output'}`,
    );
  }

  if (!stdout.trim()) {
    throw new Error(`biome produced no stdout (stderr: ${stderr.trim() || 'empty'})`);
  }

  let payload: BiomeReport;
  try {
    payload = JSON.parse(stdout) as BiomeReport;
  } catch (err) {
    throw new Error(
      `biome --reporter=json output was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return mapBiomeResults(payload, {
    cwd: options.cwd,
    biomeVersion: resolveLinterVersion(options.cwd, '@biomejs/biome'),
  });
}
