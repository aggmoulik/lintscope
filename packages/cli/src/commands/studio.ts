import path from 'node:path';
import { runEslint } from '@lintscope/core';
import { createStudioServer, type StudioServerInstance } from '@lintscope/studio-server';
import type { LintContext } from '../context';
import { handleFileRequest } from '../handlers/file';
import { buildInitPayload } from '../handlers/init';
import { buildReportPayload } from '../handlers/report';
import { handleScanRequest } from '../handlers/scan';

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
}

const DEFAULT_HOSTED_UI = 'https://lintscope.dev/studio';

/**
 * The main user-facing command. Lints the project, spins up the studio HTTP
 * server, opens the browser, returns the instance so callers can shut down.
 *
 * Callers usually want to wait on a SIGINT handler before resolving the close
 * promise — see the bin entry for the standard pattern.
 */
export async function runStudio(options: StudioOptions): Promise<StudioServerInstance> {
  const cwd = path.resolve(options.cwd);
  const hostedUi = options.hostedUi ?? DEFAULT_HOSTED_UI;
  const allowOrigin = options.allowOrigin ?? new URL(hostedUi).origin;

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
      'GET /init': () => ({ body: buildInitPayload(context) }),
      'GET /report': () => ({ body: buildReportPayload(context) }),
      'GET /file': async ({ query }) => {
        const result = await handleFileRequest(context, query);
        return { status: result.status, body: result.body };
      },
      'POST /scan': async () => ({ body: await handleScanRequest(context) }),
    },
  });

  return studio;
}
