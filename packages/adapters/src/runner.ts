import { spawn as nodeSpawn } from 'node:child_process';
import type { LintReport } from '@lintscope/schema';
import { resolveLinterBin, resolveLinterVersion } from './resolve-bin';
import type { LinterAdapter, RunAdapterOptions } from './types';

/**
 * The slice of `node:child_process.spawn` the runner uses — injectable so
 * exit-code policy, ENOENT handling, and output caps are testable without
 * spawning real binaries.
 */
export type SpawnLike = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: ['ignore', 'pipe', 'pipe']; shell: boolean },
) => {
  stdout?: { on(event: 'data', listener: (chunk: Buffer) => void): unknown } | null;
  stderr?: { on(event: 'data', listener: (chunk: Buffer) => void): unknown } | null;
  on(event: 'error', listener: (err: Error) => void): unknown;
  once(event: 'close', listener: (code: number | null) => void): unknown;
};

/** Injectable collaborators — production defaults, fakes in tests. */
export interface RunnerDeps {
  spawn?: SpawnLike;
  resolveBin?: typeof resolveLinterBin;
  resolveVersion?: typeof resolveLinterVersion;
  /** Hard cap on combined stdout/stderr buffering. Default 16MB. */
  maxOutputBytes?: number;
}

const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const DEFAULT_OK_EXIT_CODES = [0, 1];

/**
 * Run one adapter end to end: resolve the project-local binary, spawn it,
 * enforce the exit-code policy, parse stdout, and hand the payload to the
 * adapter's pure `map()`. This is the composition root every adapter shares —
 * adapters supply only `detect` / `buildArgs` / `parse?` / `map`.
 */
export async function runAdapter<Payload>(
  adapter: LinterAdapter<Payload>,
  options: RunAdapterOptions,
  deps: RunnerDeps = {},
): Promise<LintReport> {
  const spawn = deps.spawn ?? (nodeSpawn as unknown as SpawnLike);
  const resolveBin = deps.resolveBin ?? resolveLinterBin;
  const resolveVersion = deps.resolveVersion ?? resolveLinterVersion;
  const maxOutputBytes = deps.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

  const patterns = options.patterns ?? adapter.defaultPatterns;
  const { command: binary, resolvedFrom } = resolveBin({
    projectRoot: options.cwd,
    name: adapter.bin,
    ...(options.binary ? { override: options.binary } : {}),
  });
  const args = adapter.buildArgs({
    patterns,
    ...(options.configPath ? { configPath: options.configPath } : {}),
  });

  const child = spawn(binary, args, {
    cwd: options.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    // A local `.bin` shim on Windows is a `.cmd`, which Node refuses to spawn
    // without a shell (CVE-2024-27980). PATH/override stay shell-free.
    shell: resolvedFrom === 'local' && /\.(cmd|bat)$/i.test(binary),
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let bufferedBytes = 0;
  let overflow = false;
  const collect = (sink: Buffer[]) => (chunk: Buffer) => {
    bufferedBytes += chunk.byteLength;
    if (bufferedBytes > maxOutputBytes) {
      overflow = true;
      return;
    }
    sink.push(chunk);
  };
  child.stdout?.on('data', collect(stdoutChunks));
  child.stderr?.on('data', collect(stderrChunks));

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
        `Could not find \`${binary}\`. Install it (\`${adapter.installHint}\`) or pass an explicit binary.`,
      );
    }
    throw spawnError;
  }

  if (overflow) {
    throw new Error(
      `${adapter.bin} output exceeded ${maxOutputBytes} bytes — refusing to buffer further`,
    );
  }

  const stdout = Buffer.concat(stdoutChunks).toString('utf8');
  const stderr = Buffer.concat(stderrChunks).toString('utf8');

  const okExitCodes = adapter.okExitCodes ?? DEFAULT_OK_EXIT_CODES;
  if (exitCode !== null && !okExitCodes.includes(exitCode)) {
    throw new Error(
      `${adapter.bin} exited with code ${exitCode}: ${stderr.trim() || stdout.trim() || 'no output'}`,
    );
  }

  const channel = adapter.readFrom ?? 'stdout';
  const raw = channel === 'stderr' ? stderr : stdout;
  const other = channel === 'stderr' ? stdout : stderr;
  if (!raw.trim()) {
    throw new Error(
      `${adapter.bin} produced no output on ${channel} (${channel === 'stderr' ? 'stdout' : 'stderr'}: ${other.trim() || 'empty'})`,
    );
  }

  let payload: Payload;
  try {
    payload = adapter.parse ? adapter.parse(raw) : (JSON.parse(raw) as Payload);
  } catch (err) {
    throw new Error(
      `${adapter.bin} output was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const version = adapter.pkgName ? resolveVersion(options.cwd, adapter.pkgName) : 'unknown';

  return adapter.map(payload, {
    cwd: options.cwd,
    binaryPath: binary,
    version,
    ...(options.configPath ? { configPath: options.configPath } : {}),
  });
}
