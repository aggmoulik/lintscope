import type { Diagnostic, LintReport } from '@lintscope/schema';
import { SCHEMA_VERSION } from '@lintscope/schema';
import { DiagnosticCard, LintDashboard, SeverityBadge } from '@lintscope/ui';

const sampleDiagnostic: Diagnostic = {
  id: 'preview-1',
  filePath: '/repo/src/example.ts',
  relativePath: 'src/example.ts',
  line: 12,
  column: 7,
  endLine: 12,
  endColumn: 10,
  ruleId: 'no-unused-vars',
  severity: 'warning',
  message: "'foo' is defined but never used.",
  source: 'eslint',
  url: 'https://eslint.org/docs/rules/no-unused-vars',
};

const sampleReport: LintReport = {
  schemaVersion: SCHEMA_VERSION,
  generatedAt: new Date('2026-05-23T10:00:00.000Z').toISOString(),
  projectRoot: '/repo',
  linters: [{ name: 'eslint', version: '9.15.0' }],
  files: [
    {
      path: '/repo/src/example.ts',
      relativePath: 'src/example.ts',
      errorCount: 0,
      warningCount: 1,
    },
  ],
  diagnostics: [
    sampleDiagnostic,
    {
      ...sampleDiagnostic,
      id: 'preview-2',
      relativePath: 'src/handler.ts',
      filePath: '/repo/src/handler.ts',
      line: 24,
      column: 1,
      ruleId: 'no-console',
      severity: 'error',
      message: 'Unexpected console statement.',
      url: 'https://eslint.org/docs/rules/no-console',
      fix: { range: [320, 348], text: '' },
    },
  ],
  summary: {
    errorCount: 1,
    warningCount: 1,
    fixableCount: 1,
    fileCount: 2,
    ruleFrequency: { 'no-unused-vars': 1, 'no-console': 1 },
  },
};

const components = [
  {
    name: 'severity-badge',
    title: 'SeverityBadge',
    description: 'A compact pill for error / warning / info severity.',
    install: 'npx shadcn add https://lintscope.dev/r/severity-badge.json',
  },
  {
    name: 'diagnostic-card',
    title: 'DiagnosticCard',
    description: 'A single lint diagnostic with rule link, location, and fixability indicator.',
    install: 'npx shadcn add https://lintscope.dev/r/diagnostic-card.json',
  },
  {
    name: 'diagnostic-list',
    title: 'DiagnosticList',
    description: 'A virtualized list — performs at 60fps with 100k+ diagnostics.',
    install: 'npx shadcn add https://lintscope.dev/r/diagnostic-list.json',
  },
  {
    name: 'lint-dashboard',
    title: 'LintDashboard',
    description: 'Top-level layout: header stats + virtualized list. Drop in a LintReport, done.',
    install: 'npx shadcn add https://lintscope.dev/r/lint-dashboard.json',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">
          v0.0.0 · pre-alpha
        </p>
        <h1 className="text-5xl font-semibold tracking-tight">lintscope</h1>
        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          A polished UI for your linter's output. Copy-paste React components and a CLI that opens a
          local dashboard for browsing ESLint, Biome, and OXC diagnostics — without the terminal.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 font-mono text-sm">
          <code className="rounded-md bg-zinc-900 px-3 py-1.5 text-zinc-100 dark:bg-zinc-800">
            npx lintscope scan
          </code>
          <code className="rounded-md bg-zinc-200 px-3 py-1.5 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300">
            npx shadcn add https://lintscope.dev/r/lint-dashboard.json
          </code>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Live preview</h2>
        <LintDashboard report={sampleReport} height={320} />
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Components</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {components.map((c) => (
            <li
              key={c.name}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm font-semibold">{c.title}</h3>
                <SeverityBadge severity="info">v0.1</SeverityBadge>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{c.description}</p>
              <code className="overflow-x-auto rounded bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                {c.install}
              </code>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Single diagnostic, up close</h2>
        <DiagnosticCard diagnostic={sampleDiagnostic} />
      </section>

      <footer className="border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800">
        MIT licensed ·{' '}
        <a
          href="https://github.com/aggmoulik/lintscope"
          className="underline-offset-2 hover:underline"
        >
          github.com/aggmoulik/lintscope
        </a>
      </footer>
    </main>
  );
}
