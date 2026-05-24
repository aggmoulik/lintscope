import type { LintReport } from '@lintscope/schema';
import { cn } from '../lib/utils';
import { DiagnosticList } from './diagnostic-list';

export interface LintDashboardProps {
  report: LintReport;
  className?: string;
  /** Container height passed through to the virtualized list. */
  height?: number | string;
}

export function LintDashboard({ report, className, height = 640 }: LintDashboardProps) {
  const { summary, diagnostics, linters, files, generatedAt } = report;

  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950',
        className,
      )}
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Lint diagnostics
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            {linters.map((l) => `${l.name}@${l.version}`).join(', ')} ·{' '}
            <time dateTime={generatedAt}>{new Date(generatedAt).toLocaleString()}</time>
          </p>
        </div>
        <dl className="flex items-end gap-6 text-sm">
          <Stat label="errors" value={summary.errorCount} tone="error" />
          <Stat label="warnings" value={summary.warningCount} tone="warning" />
          <Stat label="fixable" value={summary.fixableCount} tone="info" />
          <Stat label="files" value={files.length} />
        </dl>
      </header>
      <DiagnosticList diagnostics={diagnostics} height={height} />
    </section>
  );
}

interface StatProps {
  label: string;
  value: number;
  tone?: 'error' | 'warning' | 'info' | 'neutral';
}

function Stat({ label, value, tone = 'neutral' }: StatProps) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <dt
        className={cn(
          'text-[10px] font-medium uppercase tracking-wider',
          tone === 'error' && 'text-red-700 dark:text-red-300',
          tone === 'warning' && 'text-amber-700 dark:text-amber-300',
          tone === 'info' && 'text-blue-700 dark:text-blue-300',
          tone === 'neutral' && 'text-zinc-500 dark:text-zinc-500',
        )}
      >
        {label}
      </dt>
      <dd className="font-mono text-2xl tabular-nums text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}
