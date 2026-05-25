/**
 * Tiny dev-only studio server. Lets you develop the /studio page end-to-end
 * without needing the real lintscope CLI built yet.
 *
 * Usage:
 *   pnpm --filter @lintscope/registry mock-studio
 *
 * Then visit the URL it prints. Adjust HOSTED_UI to your dev origin.
 *
 * Pushes a `report.updated` SSE event every 10 seconds so you can verify
 * watch-mode reconnect / refetch behaviour.
 */

import { API_VERSION, type InitResponse, SSE_EVENT_NAMES } from '@lintscope/api-schema';
import { type Diagnostic, diagnosticId, type LintReport, SCHEMA_VERSION } from '@lintscope/schema';
import { createStudioServer } from '@lintscope/studio-server';

const HOSTED_UI = process.env.HOSTED_UI ?? 'http://localhost:3000/studio';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN ?? 'http://localhost:3000';

function makeReport(): LintReport {
  const diagnostics: Diagnostic[] = [
    {
      id: diagnosticId({
        relativePath: 'src/example.ts',
        line: 12,
        column: 3,
        ruleId: 'no-unused-vars',
        message: "'foo' is defined but never used.",
      }),
      filePath: '/mock/repo/src/example.ts',
      relativePath: 'src/example.ts',
      line: 12,
      column: 3,
      ruleId: 'no-unused-vars',
      severity: 'warning',
      message: "'foo' is defined but never used.",
      source: 'eslint',
      url: 'https://eslint.org/docs/rules/no-unused-vars',
    },
    {
      id: diagnosticId({
        relativePath: 'src/handler.ts',
        line: 24,
        column: 1,
        ruleId: 'no-console',
        message: 'Unexpected console statement.',
      }),
      filePath: '/mock/repo/src/handler.ts',
      relativePath: 'src/handler.ts',
      line: 24,
      column: 1,
      ruleId: 'no-console',
      severity: 'error',
      message: 'Unexpected console statement.',
      source: 'eslint',
      url: 'https://eslint.org/docs/rules/no-console',
      fix: { range: [320, 348], text: '' },
    },
  ];
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    projectRoot: '/mock/repo',
    linters: [{ name: 'eslint', version: '9.15.0' }],
    files: [
      {
        path: '/mock/repo/src/example.ts',
        relativePath: 'src/example.ts',
        errorCount: 0,
        warningCount: 1,
      },
      {
        path: '/mock/repo/src/handler.ts',
        relativePath: 'src/handler.ts',
        errorCount: 1,
        warningCount: 0,
      },
    ],
    diagnostics,
    summary: {
      errorCount: 1,
      warningCount: 1,
      fixableCount: 1,
      fileCount: 2,
      ruleFrequency: { 'no-unused-vars': 1, 'no-console': 1 },
    },
  };
}

const initPayload: InitResponse = {
  apiVersion: API_VERSION,
  schemaVersion: SCHEMA_VERSION,
  name: 'lintscope-mock',
  linters: [{ name: 'eslint', version: '9.15.0' }],
  capabilities: { scan: true, watch: true, file: false },
};

const studio = await createStudioServer({
  name: 'lintscope-mock',
  hostedUi: HOSTED_UI,
  allowOrigin: ALLOW_ORIGIN,
  open: false,
  endpoints: {
    'GET /init': () => ({ body: initPayload }),
    'GET /report': () => ({ body: makeReport() }),
    'POST /scan': () => ({ body: makeReport() }),
    'GET /events': ({ sse }) => {
      sse();
      return undefined;
    },
  },
});

console.log(`✓ mock studio server up`);
console.log(`  local: http://localhost:${studio.port}`);
console.log(`  open : ${studio.url}`);

const heartbeat = setInterval(() => {
  studio.broadcast(SSE_EVENT_NAMES.reportUpdated, {
    type: SSE_EVENT_NAMES.reportUpdated,
    generatedAt: new Date().toISOString(),
  });
}, 10_000);
heartbeat.unref();

process.on('SIGINT', async () => {
  clearInterval(heartbeat);
  await studio.close();
  process.exit(0);
});
