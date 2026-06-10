import { EventEmitter } from 'node:events';
import path from 'node:path';
import { type LintReport, SCHEMA_VERSION } from '@lintscope/schema';
import { describe, expect, it } from 'vitest';
import { runAdapter, type SpawnLike } from '../src/runner';
import type { AdapterRunContext, LinterAdapter } from '../src/types';

const ROOT = path.resolve('/proj');

/** Minimal fake of a spawned child process the runner can drive. */
function fakeSpawn(script: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  spawnErrorCode?: string;
}): { spawn: SpawnLike; calls: Array<{ command: string; args: string[] }> } {
  const calls: Array<{ command: string; args: string[] }> = [];
  const spawn: SpawnLike = (command, args) => {
    calls.push({ command, args });
    const child = new EventEmitter() as ReturnType<SpawnLike>;
    child.stdout = new EventEmitter() as never;
    child.stderr = new EventEmitter() as never;
    queueMicrotask(() => {
      if (script.spawnErrorCode) {
        const err = new Error(script.spawnErrorCode) as NodeJS.ErrnoException;
        err.code = script.spawnErrorCode;
        child.emit('error', err);
        child.emit('close', null);
        return;
      }
      if (script.stdout) child.stdout?.emit('data', Buffer.from(script.stdout));
      if (script.stderr) child.stderr?.emit('data', Buffer.from(script.stderr));
      child.emit('close', script.exitCode ?? 0);
    });
    return child;
  };
  return { spawn, calls };
}

function report(version: string): LintReport {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: '2026-06-10T10:00:00.000Z',
    projectRoot: ROOT,
    linters: [{ name: 'fake', version }],
    files: [],
    diagnostics: [],
    summary: { errorCount: 0, warningCount: 0, fixableCount: 0, fileCount: 0, ruleFrequency: {} },
  };
}

function makeAdapter(overrides: Partial<LinterAdapter<unknown>> = {}): LinterAdapter<unknown> {
  return {
    name: 'fake',
    meta: { label: 'Fake' },
    priority: 10,
    bin: 'fakelint',
    defaultPatterns: ['.'],
    installHint: 'pnpm add -D fakelint',
    detect: () => null,
    buildArgs: ({ patterns, configPath }) => [
      '--json',
      ...(configPath ? ['--config', configPath] : []),
      ...patterns,
    ],
    map: (_payload, ctx: AdapterRunContext) => report(ctx.version),
    ...overrides,
  };
}

describe('runAdapter', () => {
  it('spawns the adapter bin with composed args and maps the parsed payload', async () => {
    const { spawn, calls } = fakeSpawn({ stdout: '{"ok":true}', exitCode: 0 });
    const result = await runAdapter(makeAdapter(), { cwd: ROOT }, { spawn });
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args).toEqual(['--json', '.']);
  });

  it('passes explicit patterns and configPath through buildArgs', async () => {
    const { spawn, calls } = fakeSpawn({ stdout: '[]', exitCode: 0 });
    await runAdapter(
      makeAdapter(),
      { cwd: ROOT, patterns: ['src'], configPath: '/proj/cfg.json' },
      { spawn },
    );
    expect(calls[0]?.args).toEqual(['--json', '--config', '/proj/cfg.json', 'src']);
  });

  it('treats exit code 1 (findings) as a normal run by default', async () => {
    const { spawn } = fakeSpawn({ stdout: '[]', exitCode: 1 });
    await expect(runAdapter(makeAdapter(), { cwd: ROOT }, { spawn })).resolves.toBeDefined();
  });

  it('throws on exit codes outside okExitCodes, including stderr in the message', async () => {
    const { spawn } = fakeSpawn({ stderr: 'config exploded', exitCode: 2 });
    await expect(runAdapter(makeAdapter(), { cwd: ROOT }, { spawn })).rejects.toThrow(
      /fakelint exited with code 2.*config exploded/s,
    );
  });

  it('honors a custom okExitCodes (e.g. Stylelint exits 2 on findings)', async () => {
    const { spawn } = fakeSpawn({ stdout: '[]', exitCode: 2 });
    const adapter = makeAdapter({ okExitCodes: [0, 2] });
    await expect(runAdapter(adapter, { cwd: ROOT }, { spawn })).resolves.toBeDefined();
  });

  it('turns ENOENT into a friendly install-hint error', async () => {
    const { spawn } = fakeSpawn({ spawnErrorCode: 'ENOENT' });
    await expect(runAdapter(makeAdapter(), { cwd: ROOT }, { spawn })).rejects.toThrow(
      /Could not find.*pnpm add -D fakelint/s,
    );
  });

  it('throws when stdout is empty on an OK exit', async () => {
    const { spawn } = fakeSpawn({ stdout: '', stderr: 'warning noise', exitCode: 0 });
    await expect(runAdapter(makeAdapter(), { cwd: ROOT }, { spawn })).rejects.toThrow(
      /produced no output on stdout/,
    );
  });

  it('wraps JSON parse failures with the adapter bin name', async () => {
    const { spawn } = fakeSpawn({ stdout: 'not json', exitCode: 0 });
    await expect(runAdapter(makeAdapter(), { cwd: ROOT }, { spawn })).rejects.toThrow(
      /fakelint output was not valid JSON/,
    );
  });

  it('uses a custom parse() when the adapter provides one', async () => {
    const { spawn } = fakeSpawn({ stdout: 'line1\nline2', exitCode: 0 });
    const seen: unknown[] = [];
    const adapter = makeAdapter({
      parse: (stdout) => stdout.split('\n'),
      map: (payload, ctx) => {
        seen.push(payload);
        return report(ctx.version);
      },
    });
    await runAdapter(adapter, { cwd: ROOT }, { spawn });
    expect(seen).toEqual([['line1', 'line2']]);
  });

  it('reports the version resolved from the project install in the run context', async () => {
    const { spawn } = fakeSpawn({ stdout: '[]', exitCode: 0 });
    const result = await runAdapter(
      makeAdapter({ pkgName: 'fakelint' }),
      { cwd: ROOT },
      { spawn, resolveVersion: () => '9.9.9' },
    );
    expect(result.linters[0]?.version).toBe('9.9.9');
  });

  it('reads the payload from stderr when the adapter declares readFrom: stderr', async () => {
    // stylelint 16 prints its report to stderr; stdout is empty.
    const { spawn } = fakeSpawn({ stdout: '', stderr: '{"ok":true}', exitCode: 2 });
    const adapter = makeAdapter({ readFrom: 'stderr', okExitCodes: [0, 2] });
    await expect(runAdapter(adapter, { cwd: ROOT }, { spawn })).resolves.toBeDefined();
  });

  it('reports the declared channel when it is empty', async () => {
    const { spawn } = fakeSpawn({ stdout: 'noise', stderr: '', exitCode: 0 });
    const adapter = makeAdapter({ readFrom: 'stderr' });
    await expect(runAdapter(adapter, { cwd: ROOT }, { spawn })).rejects.toThrow(
      /produced no output on stderr/,
    );
  });

  it('rejects output past the size cap instead of buffering unbounded', async () => {
    const { spawn } = fakeSpawn({ stdout: 'x'.repeat(64), exitCode: 0 });
    await expect(
      runAdapter(makeAdapter(), { cwd: ROOT }, { spawn, maxOutputBytes: 16 }),
    ).rejects.toThrow(/output exceeded/);
  });
});
