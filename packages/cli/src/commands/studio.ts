import path from 'node:path';
import { runEslint } from '@lintscope/core';
import { createStudioServer, type StudioServerInstance } from '@lintscope/studio-server';
import type { LintContext } from '../context';
import { handleFileRequest } from '../handlers/file';
import { buildInitPayload } from '../handlers/init';
import { buildReportPayload } from '../handlers/report';
import { handleScanRequest } from '../handlers/scan';
import { startWatcher, type Watcher } from '../watch';

export interface StudioOptions {
  cwd: string;
  /** Hosted UI URL. Defaults to lintscope.dev. */
  hostedUi?: string;
  /** CORS allowlist. Defaults to the hosted UI's origin. */
  allowOrigin?: string;
  /** Listen on this port. Defaults to 0 (random free). */
  port?: number;
  /** If false, don't open a browser. */
  open?: boolean;
  /** Enable file-watcher → SSE push. Default false. */
  watch?: boolean;
}

const DEFAULT_HOSTED_UI = 'https://lintscope.dev/studio';

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
  const hostedUi = options.hostedUi ?? DEFAULT_HOSTED_UI;
  const allowOrigin = options.allowOrigin ?? new URL(hostedUi).origin;
  const watchEnabled = options.watch === true;

  const initialReport = await runEslint({ cwd });

  const context: LintContext = {
    projectRoot: cwd,
    name: 'lintscope',
    linter: 'eslint',
    report: initialReport,
    rerun: () => runEslint({ cwd }),
  };

  const studio = await createStudioServer({
    name: context.name,
    hostedUi,
    allowOrigin,
    open: options.open ?? true,
    ...(options.port !== undefined ? { port: options.port } : {}),
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
