import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { STUDIO_DISCOVERY_PORTS } from '@lintscope/api-schema';
import { createStudioServer, type StudioServerInstance } from '@lintscope/studio-server';
import type { LintContext } from '../context';
import { handleFileRequest } from '../handlers/file';
import { buildInitPayload } from '../handlers/init';
import { buildReportPayload } from '../handlers/report';
import { type LinterFormat, loadReport } from '../load-report';
import { readStdin } from '../read-stdin';

export interface ViewOptions {
  cwd: string;
  /** Which raw linter JSON format the input is. */
  from: LinterFormat;
  /** Path to a file containing the JSON. Omit to read from stdin. */
  file?: string;
  /** Studio flags — same defaults as `runStudio`. */
  hostedUi?: string;
  allowOrigin?: string;
  port?: number;
  open?: boolean;
}

// Default hosted UI — open the studio's final origin directly (a redirect would
// change the page Origin and break the local CORS handshake). TODO: swap to
// https://lintscope.dev/studio once that custom domain is attached.
const DEFAULT_HOSTED_UI = 'https://lintscope.vercel.app/studio';

export interface ViewHandle {
  studio: StudioServerInstance;
}

/**
 * Render an existing linter JSON payload in the studio dashboard. Never
 * spawns a linter; `/scan` and `/events` are not registered. Reads input
 * from `options.file` if given, else from stdin.
 *
 * Returns once the studio server is listening — the caller (the `bin`) is
 * responsible for wiring SIGINT/SIGTERM to `studio.close()`.
 */
export async function runView(options: ViewOptions): Promise<ViewHandle> {
  const cwd = path.resolve(options.cwd);
  const raw = await readInput(options);
  const report = loadReport(options.from, raw, cwd);

  const hostedUi = options.hostedUi ?? process.env.LINTSCOPE_HOSTED_UI ?? DEFAULT_HOSTED_UI;
  const allowOrigin =
    options.allowOrigin ?? process.env.LINTSCOPE_ALLOW_ORIGIN ?? new URL(hostedUi).origin;

  const context: LintContext = {
    projectRoot: cwd,
    name: 'lintscope',
    report,
  };

  const studio = await createStudioServer({
    name: context.name,
    hostedUi,
    allowOrigin,
    open: options.open ?? true,
    // No --port → discovery-range port, kept out of the URL (page probes for it).
    port: options.port ?? [...STUDIO_DISCOVERY_PORTS],
    endpoints: {
      'GET /init': () => ({
        body: buildInitPayload(context, {
          scan: false,
          watch: false,
          file: true,
        }),
      }),
      'GET /report': () => ({ body: buildReportPayload(context) }),
      'GET /file': async ({ query }) => {
        const result = await handleFileRequest(context, query);
        return { status: result.status, body: result.body };
      },
    },
  });

  return { studio };
}

async function readInput(options: ViewOptions): Promise<string> {
  if (options.file) {
    return readFile(path.resolve(options.cwd, options.file), 'utf8');
  }
  // No file → must be a pipe. Reject when running interactively so users get
  // a clear hint instead of a hang on stdin.
  if (process.stdin.isTTY) {
    throw new Error(
      `No input. Pipe linter JSON (e.g. \`eslint -f json . | lintscope view --from ${options.from}\`) or pass a file as the last argument.`,
    );
  }
  return readStdin(process.stdin);
}
