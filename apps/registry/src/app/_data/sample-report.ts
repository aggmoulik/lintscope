import type { Diagnostic, LintReport } from '@lintscope/schema';
import { SCHEMA_VERSION } from '@lintscope/schema';

/**
 * Static sample data that powers the landing-page demos. It deliberately spans
 * two linters (ESLint + Biome) and a handful of files so the live dashboard
 * looks like a real project rather than a single contrived row.
 *
 * The fixed `generatedAt` keeps server/client render identical (no hydration
 * mismatch from a live clock).
 */

const ROOT = '/Users/you/acme-web';

function abs(relativePath: string): string {
  return `${ROOT}/${relativePath}`;
}

export const sampleDiagnostic: Diagnostic = {
  id: 'sample-no-unused-vars',
  filePath: abs('src/lib/api.ts'),
  relativePath: 'src/lib/api.ts',
  line: 14,
  column: 7,
  endLine: 14,
  endColumn: 18,
  ruleId: 'no-unused-vars',
  severity: 'warning',
  message: "'transformer' is assigned a value but never used.",
  source: 'eslint',
  url: 'https://eslint.org/docs/latest/rules/no-unused-vars',
};

const diagnostics: Diagnostic[] = [
  sampleDiagnostic,
  {
    id: 'sample-no-console',
    filePath: abs('src/lib/api.ts'),
    relativePath: 'src/lib/api.ts',
    line: 38,
    column: 5,
    endLine: 38,
    endColumn: 32,
    ruleId: 'no-console',
    severity: 'error',
    message: 'Unexpected console statement.',
    source: 'eslint',
    url: 'https://eslint.org/docs/latest/rules/no-console',
  },
  {
    id: 'sample-eqeqeq',
    filePath: abs('src/lib/api.ts'),
    relativePath: 'src/lib/api.ts',
    line: 52,
    column: 9,
    endLine: 52,
    endColumn: 21,
    ruleId: 'eqeqeq',
    severity: 'error',
    message: "Expected '===' and instead saw '=='.",
    source: 'eslint',
    url: 'https://eslint.org/docs/latest/rules/eqeqeq',
    fixable: true,
    fix: { range: [1284, 1296], text: 'status === 200' },
  },
  {
    id: 'sample-no-explicit-any',
    filePath: abs('src/components/Button.tsx'),
    relativePath: 'src/components/Button.tsx',
    line: 9,
    column: 22,
    endLine: 9,
    endColumn: 25,
    ruleId: 'lint/suspicious/noExplicitAny',
    severity: 'warning',
    message: 'Unexpected any. Specify a different type.',
    source: 'biome',
    url: 'https://biomejs.dev/linter/rules/no-explicit-any',
  },
  {
    id: 'sample-no-debugger',
    filePath: abs('src/components/Button.tsx'),
    relativePath: 'src/components/Button.tsx',
    line: 27,
    column: 5,
    endLine: 27,
    endColumn: 13,
    ruleId: 'no-debugger',
    severity: 'error',
    message: "Unexpected 'debugger' statement.",
    source: 'eslint',
    url: 'https://eslint.org/docs/latest/rules/no-debugger',
    fixable: true,
    fix: { range: [612, 621], text: '' },
  },
  {
    id: 'sample-exhaustive-deps',
    filePath: abs('src/hooks/use-user.ts'),
    relativePath: 'src/hooks/use-user.ts',
    line: 23,
    column: 6,
    endLine: 23,
    endColumn: 8,
    ruleId: 'react-hooks/exhaustive-deps',
    severity: 'warning',
    message: "React Hook useEffect has a missing dependency: 'userId'.",
    source: 'eslint',
  },
  {
    id: 'sample-no-unused-variables',
    filePath: abs('src/hooks/use-user.ts'),
    relativePath: 'src/hooks/use-user.ts',
    line: 5,
    column: 10,
    endLine: 5,
    endColumn: 18,
    ruleId: 'lint/correctness/noUnusedVariables',
    severity: 'warning',
    message: "This variable 'fallback' is unused.",
    source: 'biome',
    url: 'https://biomejs.dev/linter/rules/no-unused-variables',
    fixable: true,
    fix: { range: [120, 152], text: '' },
  },
  {
    id: 'sample-use-const',
    filePath: abs('src/index.ts'),
    relativePath: 'src/index.ts',
    line: 3,
    column: 1,
    endLine: 3,
    endColumn: 4,
    ruleId: 'lint/style/useConst',
    severity: 'warning',
    message: "This 'let' is never reassigned. Use 'const' instead.",
    source: 'biome',
    url: 'https://biomejs.dev/linter/rules/use-const',
    fixable: true,
    fix: { range: [40, 43], text: 'const' },
  },
];

export const sampleReport: LintReport = {
  schemaVersion: SCHEMA_VERSION,
  generatedAt: '2026-06-09T10:00:00.000Z',
  projectRoot: ROOT,
  linters: [
    { name: 'eslint', version: '9.15.0' },
    { name: 'biome', version: '1.9.4' },
  ],
  files: [
    {
      path: abs('src/components/Button.tsx'),
      relativePath: 'src/components/Button.tsx',
      errorCount: 1,
      warningCount: 1,
    },
    {
      path: abs('src/lib/api.ts'),
      relativePath: 'src/lib/api.ts',
      errorCount: 2,
      warningCount: 1,
    },
    {
      path: abs('src/hooks/use-user.ts'),
      relativePath: 'src/hooks/use-user.ts',
      errorCount: 0,
      warningCount: 2,
    },
    {
      path: abs('src/index.ts'),
      relativePath: 'src/index.ts',
      errorCount: 0,
      warningCount: 1,
    },
  ],
  diagnostics,
  summary: {
    errorCount: 3,
    warningCount: 5,
    fixableCount: 4,
    fileCount: 4,
    ruleFrequency: {
      'no-unused-vars': 1,
      'no-console': 1,
      eqeqeq: 1,
      'lint/suspicious/noExplicitAny': 1,
      'no-debugger': 1,
      'react-hooks/exhaustive-deps': 1,
      'lint/correctness/noUnusedVariables': 1,
      'lint/style/useConst': 1,
    },
  },
};
