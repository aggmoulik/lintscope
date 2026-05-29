'use client';

import type { LintReport } from '@lintscope/schema';
import { useCallback, useMemo, useState } from 'react';
import {
  applyFilters,
  type DashboardFilters,
  EMPTY_FILTERS,
  hasActiveFilters,
} from '../lib/filters';
import { cn } from '../lib/utils';
import { CommandPalette, type CommandPaletteAction } from './command-palette';
import { DiagnosticList } from './diagnostic-list';
import { FileTree } from './file-tree';
import { RuleSummary } from './rule-summary';

export interface LintDashboardProps {
  report: LintReport;
  className?: string;
  /**
   * Async source fetcher forwarded to each `<DiagnosticCard />` for the
   * inline preview — green/red DiffViewer for ESLint autofixes, or a
   * <CodePreview /> with the error line highlighted for everything else.
   * The studio page passes `(p) => studioApi.file(connection, p)`.
   */
  onFetchSource?: (relativePath: string) => Promise<string>;
}

export function LintDashboard({ report, className, onFetchSource }: LintDashboardProps) {
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const filtered = useMemo(
    () => applyFilters(report.diagnostics, filters),
    [report.diagnostics, filters],
  );

  const handlePaletteAction = useCallback((action: CommandPaletteAction) => {
    switch (action.type) {
      case 'filter-rule':
        setFilters((f) => ({ ...f, ruleId: action.ruleId }));
        break;
      case 'filter-severity':
        setFilters((f) => ({ ...f, severity: action.severity }));
        break;
      case 'filter-file':
        setFilters((f) => ({ ...f, relativePath: action.relativePath }));
        break;
      case 'filter-linter':
        setFilters((f) => ({ ...f, source: action.source }));
        break;
      case 'open-rule-docs':
        if (typeof window !== 'undefined') window.open(action.url, '_blank', 'noopener,noreferrer');
        break;
      case 'clear-filters':
        setFilters(EMPTY_FILTERS);
        break;
    }
  }, []);

  const onSelectFile = useCallback((file: LintReport['files'][number]) => {
    setFilters((f) => ({
      ...f,
      relativePath: f.relativePath === file.relativePath ? null : file.relativePath,
    }));
  }, []);

  const onSelectRule = useCallback((ruleId: string | null) => {
    setFilters((f) => ({ ...f, ruleId: ruleId === f.ruleId ? null : ruleId }));
  }, []);

  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950',
        className,
      )}
      data-testid="lint-dashboard"
    >
      <DashboardHeader
        report={report}
        filteredCount={filtered.length}
        totalCount={report.diagnostics.length}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <FilterPills
        filters={filters}
        onClear={(key) => setFilters((f) => ({ ...f, [key]: null }))}
        onClearAll={() => setFilters(EMPTY_FILTERS)}
      />

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="flex flex-col gap-4">
          <FileTree
            files={report.files}
            selectedPath={filters.relativePath ?? undefined}
            onSelect={onSelectFile}
            className="max-h-[40vh]"
          />
          <RuleSummary
            diagnostics={report.diagnostics}
            selectedRule={filters.ruleId}
            onSelect={onSelectRule}
            className="max-h-[40vh]"
          />
        </aside>

        <div className="flex flex-col gap-4">
          <DiagnosticList
            diagnostics={filtered}
            {...(onFetchSource ? { onFetchSource } : {})}
            height={600}
            emptyState={
              hasActiveFilters(filters)
                ? 'No diagnostics match the current filters.'
                : 'No diagnostics. 🎉'
            }
          />
        </div>
      </div>

      <CommandPalette
        report={report}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onAction={handlePaletteAction}
      />
    </section>
  );
}

/* ---------- internal pieces ---------- */

function DashboardHeader({
  report,
  filteredCount,
  totalCount,
  onOpenPalette,
}: {
  report: LintReport;
  filteredCount: number;
  totalCount: number;
  onOpenPalette: () => void;
}) {
  const { summary, linters, files, generatedAt } = report;
  return (
    <header
      className="flex flex-wrap items-end justify-between gap-4"
      data-testid="dashboard-header"
    >
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Lint diagnostics</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          {linters.map((l) => `${l.name}@${l.version}`).join(', ')} ·{' '}
          <time dateTime={generatedAt}>{new Date(generatedAt).toLocaleString()}</time>
          {filteredCount !== totalCount && (
            <span className="ml-2 italic">
              showing {filteredCount} of {totalCount}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-end gap-4">
        <dl className="flex items-end gap-5 text-sm">
          <Stat label="errors" value={summary.errorCount} tone="error" />
          <Stat label="warnings" value={summary.warningCount} tone="warning" />
          <Stat label="fixable" value={summary.fixableCount} tone="info" />
          <Stat label="files" value={files.length} />
        </dl>
        <button
          type="button"
          onClick={onOpenPalette}
          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          data-testid="open-palette-button"
        >
          ⌘K
        </button>
      </div>
    </header>
  );
}

function FilterPills({
  filters,
  onClear,
  onClearAll,
}: {
  filters: DashboardFilters;
  onClear: (key: keyof DashboardFilters) => void;
  onClearAll: () => void;
}) {
  const items: Array<{ key: keyof DashboardFilters; label: string }> = [];
  if (filters.severity) items.push({ key: 'severity', label: `severity: ${filters.severity}` });
  if (filters.source) items.push({ key: 'source', label: `linter: ${filters.source}` });
  if (filters.ruleId) items.push({ key: 'ruleId', label: `rule: ${filters.ruleId}` });
  if (filters.relativePath)
    items.push({ key: 'relativePath', label: `file: ${filters.relativePath}` });

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="filter-pills">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onClear(item.key)}
          className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-1 font-mono text-[10px] text-zinc-100 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          data-pill={item.key}
        >
          <span>{item.label}</span>
          <span aria-hidden>×</span>
        </button>
      ))}
      {items.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          Clear all
        </button>
      )}
    </div>
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
