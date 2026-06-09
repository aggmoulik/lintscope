import path from 'node:path';
import { STUDIO_DISCOVERY_PORTS } from '@lintscope/api-schema';
import { resolveLintScope, runLinters } from '@lintscope/core';
import { createStudioServer, type StudioServerInstance } from '@lintscope/studio-server';
import type { LintContext } from '../context';
import { handleFileRequest } from '../handlers/file';
import { buildInitPayload } from '../handlers/init';
import { buildReportPayload } from '../handlers/report';
import { handleScanRequest } from '../handlers/scan';
import { type HostedUiOptions, resolveHostedUi } from '../hosted-ui';
import { warnSkippedLinters } from '../warn-skipped';
import { startWatcher, type Watcher } from '../watch';

export interface StudioOptions extends HostedUiOptions {
  cwd: string;
  /** Listen on this port. Defaults to 0 (random free). */
  port?: number;
  /** If false, don't open a browser. */
  open?: boolean;
  /** Enable file-watcher → SSE push. Default false. */
  watch?: boolean;
  /**
   * Lint targets (positional CLI paths), relative to `cwd`. Scopes the file set
   * to a sub-package while the linter config is still found by walking up.
   */
  targets?: string[];
}

export interface StudioHandle {
  studio: StudioServerInstance;
  /** Set when --watch was passed. close() shuts the watcher down too. */
  watcher: Watcher | undefined;
}

/**
 * The main user-facing command. Lints the project, spins up the studio HTTP
 * server, opens the browser, optionally attaches a file watcher.
 *
 * Returns both the studio server and (when watching) the watcher so the
 * caller can shut everything down via the SIGINT handler in bin/.
 */
export async function runStudio(options: StudioOptions): Promise<StudioHandle> {
  const cwd = path.resolve(options.cwd);
  const { hostedUi, allowOrigin } = resolveHostedUi(options);
  const watchEnabled = options.watch === true;

  // Find the config dir (walking up from cwd) + scope the file set to any
  // positional targets / the sub-package we're in, then run EVERY linter
  // configured there. Throws "No linter detected" if no supported config exists.
  const scope = resolveLintScope({
    cwd,
    ...(options.targets && options.targets.length > 0 ? { targets: options.targets } : {}),
  });
  const runArgs = {
    cwd: scope.projectRoot,
    ...(scope.patterns ? { patterns: scope.patterns } : {}),
  };
  const { report: initialReport, skipped } = await runLinters(runArgs);
  warnSkippedLinters(skipped);

  const context: LintContext = {
    projectRoot: scope.projectRoot,
    name: 'lintscope',
    report: initialReport,
    rerun: async () => (await runLinters(runArgs)).report,
  };

  const studio = await createStudioServer({
    name: context.name,
    hostedUi,
    allowOrigin,
    open: options.open ?? true,
    // No --port → bind a discovery-range port and keep it out of the URL (the
    // page probes for it). An explicit --port is used verbatim and stays in the URL.
    port: options.port ?? [...STUDIO_DISCOVERY_PORTS],
    endpoints: {
      'GET /init': () => ({
        body: buildInitPayload(context, {
          scan: true,
          watch: watchEnabled,
          file: true,
        }),
      }),
      'GET /report': () => ({ body: buildReportPayload(context) }),
      'GET /file': async ({ query }) => {
        const result = await handleFileRequest(context, query);
        return { status: result.status, body: result.body };
      },
      'POST /scan': async () => ({ body: await handleScanRequest(context) }),
      'GET /events': ({ sse }) => {
        sse();
        return undefined;
      },
    },
  });

  const watcher = watchEnabled
    ? startWatcher(context, { broadcast: studio.broadcast.bind(studio) })
    : undefined;

  return { studio, watcher };
}
