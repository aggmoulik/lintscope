import path from 'node:path';
import {
  type DiagnosticsDeltaEvent,
  type ReportUpdatedEvent,
  SSE_EVENT_NAMES,
} from '@lintscope/api-schema';
import type { LintReport } from '@lintscope/schema';
import chokidar, { type FSWatcher } from 'chokidar';
import type { LintContext } from './context';
import { diffDiagnostics } from './diff';

export interface WatcherOptions {
  /** Wait this long after the last file change before re-running. */
  debounceMs?: number;
  /** Additional ignored globs (on top of the defaults). */
  ignored?: string[];
  /** Log function. Defaults to console.error. */
  log?: (line: string) => void;
}

export interface WatcherBroadcaster {
  broadcast(event: string, data: unknown): void;
}

export interface Watcher {
  /** Number of times the lint cycle has run (counting the initial scan as 0). */
  readonly cycleCount: number;
  /** Stop watching and release the chokidar instance. */
  close(): Promise<void>;
}

const DEFAULT_DEBOUNCE_MS = 250;

const DEFAULT_IGNORED = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/.DS_Store',
];

/**
 * Watch the project for source-file changes, re-run the linter on a debounce,
 * compute the diff against the previous report, and push two SSE events:
 *
 *   - `report.updated` — small payload, signals "fetch /report again".
 *   - `diagnostics.delta` — added/removed, for clients that want to skip the
 *     refetch round-trip.
 *
 * Returns a controller so the CLI can shut the watcher down cleanly.
 */
export function startWatcher(
  context: LintContext,
  broadcaster: WatcherBroadcaster,
  options: WatcherOptions = {},
): Watcher {
  // Watch mode is meaningless without a way to re-run the linter; the caller
  // (the `studio` command) always provides one, but `view` mode does not.
  if (!context.rerun) {
    throw new Error('startWatcher requires a LintContext.rerun function');
  }
  const rerun = context.rerun;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const log = options.log ?? ((line: string) => console.error(line));
  const ignored = [...DEFAULT_IGNORED, ...(options.ignored ?? [])];

  const watcher: FSWatcher = chokidar.watch(context.projectRoot, {
    ignored,
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
  });

  let cycleCount = 0;
  let pendingTimeout: ReturnType<typeof setTimeout> | undefined;
  let scanning = false;
  let scanQueued = false;
  let closed = false;

  const runScan = async () => {
    if (scanning) {
      scanQueued = true;
      return;
    }
    scanning = true;
    const previousDiagnostics = context.report.diagnostics;
    try {
      const fresh = await rerun();
      if (closed) return;
      context.report = fresh;
      cycleCount += 1;

      const updated: ReportUpdatedEvent = {
        type: 'report.updated',
        generatedAt: fresh.generatedAt,
      };
      broadcaster.broadcast(SSE_EVENT_NAMES.reportUpdated, updated);

      const diff = diffDiagnostics(previousDiagnostics, fresh.diagnostics);
      if (diff.added.length > 0 || diff.removed.length > 0) {
        const delta: DiagnosticsDeltaEvent = {
          type: 'diagnostics.delta',
          added: diff.added,
          removed: diff.removed,
        };
        broadcaster.broadcast(SSE_EVENT_NAMES.diagnosticsDelta, delta);
      }

      log(
        `  watch: +${diff.added.length} -${diff.removed.length} · ${fresh.summary.errorCount} errors, ${fresh.summary.warningCount} warnings`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`  watch: lint failed — ${message}`);
    } finally {
      scanning = false;
      if (scanQueued && !closed) {
        scanQueued = false;
        // Schedule the queued scan after a microtask so we don't recurse.
        setImmediate(runScan);
      }
    }
  };

  const onChange = (filePath: string) => {
    if (closed) return;
    const relative = path.relative(context.projectRoot, filePath);
    log(`  watch: change ${relative}`);
    if (pendingTimeout) clearTimeout(pendingTimeout);
    pendingTimeout = setTimeout(runScan, debounceMs);
  };

  watcher.on('add', onChange);
  watcher.on('change', onChange);
  watcher.on('unlink', onChange);
  watcher.on('error', (err) => {
    const message = err instanceof Error ? err.message : String(err);
    log(`  watch: ${message}`);
  });

  return {
    get cycleCount() {
      return cycleCount;
    },
    async close() {
      if (closed) return;
      closed = true;
      if (pendingTimeout) clearTimeout(pendingTimeout);
      await watcher.close();
    },
  };
}

/**
 * Compute the same delta the watcher would emit, without actually running the
 * linter. Exposed for tests + the future `lintscope diff <old> <new>` command.
 */
export function buildDeltaPayload(
  previous: LintReport,
  next: LintReport,
): DiagnosticsDeltaEvent | null {
  const diff = diffDiagnostics(previous.diagnostics, next.diagnostics);
  if (diff.added.length === 0 && diff.removed.length === 0) return null;
  return {
    type: 'diagnostics.delta',
    added: diff.added,
    removed: diff.removed,
  };
}
