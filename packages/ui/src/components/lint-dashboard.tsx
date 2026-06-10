'use client';

import type { Diagnostic, LintReport } from '@lintscope/schema';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { deriveLinterMeta, type ResolvedLinterMeta, resolveLinterMeta } from '../lib/linter-meta';
import { cn } from '../lib/utils';
import { CommandPalette, type CommandPaletteAction } from './command-palette';
import { DiagnosticCard } from './diagnostic-card';
import { FileTree } from './file-tree';
import { Icon, type IconName } from './icon';
import { LinterLogo } from './linter-logo';
import { SeverityBadge } from './severity-badge';

type GroupBy = 'file' | 'rule' | 'severity';

export interface LintDashboardProps {
  report: LintReport;
  className?: string;
  /**
   * Async source fetcher forwarded to each `<DiagnosticCard />` for the inline
   * preview. The studio page passes `(p) => studioApi.file(connection, p)`.
   */
  onFetchSource?: (relativePath: string) => Promise<string>;
}

// Auto-fixable ONLY when the linter reports a real autofix (ESLint inline
// `fix`, Biome's `fixable` tag) — same semantics as the DiagnosticCard badge.
// ESLint `suggestions` are manual-choice hints that `--fix` does NOT apply,
// so they must not inflate this count.
const isFixable = (d: Diagnostic): boolean => Boolean(d.fix) || d.fixable === true;

function projectName(root: string): string {
  const segs = root.split(/[\\/]/).filter(Boolean);
  return segs[segs.length - 1] ?? root;
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i + 1);
}
function baseOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? path : path.slice(i + 1);
}

export function LintDashboard({ report, className, onFetchSource }: LintDashboardProps) {
  const [query, setQuery] = useState('');
  const [showError, setShowError] = useState(true);
  const [showWarning, setShowWarning] = useState(true);
  const [linterFilter, setLinterFilter] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('file');
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Resolve ALL per-linter display meta once, at the boundary — components
  // below this point take complete meta as required props, never optionals.
  const linterMeta = useMemo(() => resolveLinterMeta(report), [report]);

  const counts = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    let fixable = 0;
    const byLinter: Record<string, number> = {};
    const files = new Set<string>();
    for (const d of report.diagnostics) {
      if (d.severity === 'error') errors++;
      else if (d.severity === 'warning') warnings++;
      if (isFixable(d)) fixable++;
      byLinter[d.source] = (byLinter[d.source] ?? 0) + 1;
      files.add(d.relativePath);
    }
    return { errors, warnings, fixable, files: files.size, byLinter };
  }, [report.diagnostics]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return report.diagnostics.filter((d) => {
      if (d.severity === 'error' && !showError) return false;
      if (d.severity === 'warning' && !showWarning) return false;
      if (linterFilter && d.source !== linterFilter) return false;
      if (selectedPath && d.relativePath !== selectedPath) return false;
      if (
        q &&
        !(
          d.relativePath.toLowerCase().includes(q) ||
          (d.ruleId ?? '').toLowerCase().includes(q) ||
          d.message.toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      return true;
    });
  }, [report.diagnostics, query, showError, showWarning, linterFilter, selectedPath]);

  const groups = useMemo(() => {
    const keyOf =
      groupBy === 'file'
        ? (d: Diagnostic) => d.relativePath
        : groupBy === 'rule'
          ? (d: Diagnostic) => d.ruleId ?? '(parser error)'
          : (d: Diagnostic) => d.severity;
    const map = new Map<string, Diagnostic[]>();
    for (const d of filtered) {
      const k = keyOf(d);
      const arr = map.get(k);
      if (arr) arr.push(d);
      else map.set(k, [d]);
    }
    return [...map.entries()].map(([key, items]) => ({ key, label: key, items }));
  }, [filtered, groupBy]);

  const handlePaletteAction = useCallback((action: CommandPaletteAction) => {
    switch (action.type) {
      case 'filter-rule':
        setQuery(action.ruleId);
        break;
      case 'filter-severity':
        setShowError(action.severity === 'error');
        setShowWarning(action.severity === 'warning');
        break;
      case 'filter-file':
        setSelectedPath(action.relativePath);
        break;
      case 'filter-linter':
        setLinterFilter(action.source);
        break;
      case 'open-rule-docs':
        if (typeof window !== 'undefined') window.open(action.url, '_blank', 'noopener,noreferrer');
        break;
      case 'clear-filters':
        setShowError(true);
        setShowWarning(true);
        setLinterFilter(null);
        setSelectedPath(null);
        setQuery('');
        break;
    }
  }, []);

  const resetFilters = useCallback(() => {
    setShowError(true);
    setShowWarning(true);
    setLinterFilter(null);
    setSelectedPath(null);
    setQuery('');
  }, []);

  return (
    <section className={cn('flex flex-col', className)} data-testid="lint-dashboard">
      <TopBar report={report} onOpenPalette={() => setPaletteOpen(true)} />

      <div
        className="grid items-start gap-5 px-1 pt-5 lg:grid-cols-[var(--rail)_minmax(0,1fr)]"
        style={{ '--rail': '296px' } as React.CSSProperties}
      >
        <Sidebar
          report={report}
          linterMeta={linterMeta}
          counts={counts}
          query={query}
          setQuery={setQuery}
          linterFilter={linterFilter}
          setLinterFilter={setLinterFilter}
          selectedPath={selectedPath}
          setSelectedPath={setSelectedPath}
        />

        <Feed
          linterMeta={linterMeta}
          filteredCount={filtered.length}
          total={report.diagnostics.length}
          selectedPath={selectedPath}
          setSelectedPath={setSelectedPath}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          groups={groups}
          allClear={report.diagnostics.length === 0}
          onReset={resetFilters}
          {...(onFetchSource ? { onFetchSource } : {})}
        />
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

/* ---------------------------------- top bar -------------------------------- */

function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    setDark(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className="rounded-[9px] border border-line bg-surface-2 p-2 text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      <Icon name={dark ? 'sun' : 'moon'} size={15} />
    </button>
  );
}

function TopBar({ report, onOpenPalette }: { report: LintReport; onOpenPalette: () => void }) {
  return (
    <header
      className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-canvas/80 px-5 py-3.5 backdrop-blur-md"
      data-testid="dashboard-topbar"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="relative size-[19px] rounded-[6px] bg-gradient-to-br from-accent to-accent/55 shadow-[0_4px_12px_-3px_var(--color-accent)] ring-1 ring-accent-line"
          >
            <span className="absolute inset-[5px] rounded-[2px] bg-canvas opacity-85" />
          </span>
          <span className="font-semibold text-[16px] tracking-[-0.02em] text-ink">lintscope</span>
        </span>
        <span aria-hidden className="h-5 w-px bg-line-strong" />
        <span className="flex min-w-0 items-center gap-2 font-mono text-[13px] text-ink-muted">
          <Icon name="branch" size={13} className="opacity-55" />
          <span className="truncate">{projectName(report.projectRoot)}</span>
        </span>
      </div>

      <div className="flex items-center gap-3.5">
        <span className="hidden items-center gap-1.5 text-[12.5px] text-ink-faint sm:flex">
          <Icon name="clock" size={13} className="opacity-50" />
          Scanned {new Date(report.generatedAt).toLocaleString()}
        </span>
        <ThemeToggle />
        <button
          type="button"
          onClick={onOpenPalette}
          data-testid="open-palette-button"
          className="flex items-center gap-2 rounded-[9px] border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          <Icon name="search" size={14} className="opacity-60" />
          Search
          <kbd className="inline-flex items-center gap-0.5 rounded-[5px] border border-line-strong bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
            <Icon name="command" size={11} stroke={1.6} />K
          </kbd>
        </button>
      </div>
    </header>
  );
}

/* --------------------------------- sidebar -------------------------------- */

type Counts = {
  errors: number;
  warnings: number;
  fixable: number;
  files: number;
  byLinter: Record<string, number>;
};

function Sidebar({
  report,
  linterMeta,
  counts,
  query,
  setQuery,
  linterFilter,
  setLinterFilter,
  selectedPath,
  setSelectedPath,
}: {
  report: LintReport;
  linterMeta: Record<string, ResolvedLinterMeta>;
  counts: Counts;
  query: string;
  setQuery: (v: string) => void;
  linterFilter: string | null;
  setLinterFilter: (v: string | null) => void;
  selectedPath: string | null;
  setSelectedPath: (v: string | null) => void;
}) {
  return (
    <aside className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2.5" data-testid="stat-tiles">
        <StatTile label="Errors" value={counts.errors} tone="error" />
        <StatTile label="Warnings" value={counts.warnings} tone="warning" />
        <StatTile label="Auto-fixable" value={counts.fixable} tone="ok" />
        <StatTile label="Files affected" value={counts.files} tone="neutral" />
      </dl>

      <div className="flex h-[38px] items-center gap-2 rounded-[9px] border border-line bg-surface px-3 focus-within:border-accent-line">
        <SearchIcon />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter files & rules…"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-faint"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-ink-faint hover:text-ink"
          >
            ×
          </button>
        )}
      </div>

      {report.linters.length > 1 && (
        <div data-testid="linter-filter">
          <Eyebrow>Linters</Eyebrow>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.linters.map((l) => {
              const active = linterFilter === l.name;
              return (
                <button
                  key={l.name}
                  type="button"
                  data-linter-filter={l.name}
                  aria-pressed={active}
                  onClick={() => setLinterFilter(active ? null : l.name)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-[6px] border px-2.5 py-1.5 text-[12.5px] font-medium transition',
                    active
                      ? 'border-line-strong bg-surface-3 text-ink'
                      : 'border-line bg-surface text-ink-muted hover:text-ink',
                  )}
                >
                  <LinterLogo meta={linterMeta[l.name] ?? deriveLinterMeta(l.name)} size={14} />
                  {(linterMeta[l.name] ?? deriveLinterMeta(l.name)).label}
                  <span className="rounded-full bg-surface-3 px-1.5 py-px text-[11px] text-ink-faint">
                    {counts.byLinter[l.name] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Eyebrow>Project</Eyebrow>
          {selectedPath && (
            <button
              type="button"
              onClick={() => setSelectedPath(null)}
              className="text-[11.5px] font-medium text-accent"
            >
              Clear
            </button>
          )}
        </div>
        <FileTree
          files={report.files}
          selectedPath={selectedPath ?? undefined}
          onSelect={(f) => setSelectedPath(selectedPath === f.relativePath ? null : f.relativePath)}
          searchable={false}
          className="max-h-[clamp(220px,calc(100vh-360px),560px)]"
        />
      </div>
    </aside>
  );
}

/* ----------------------------------- feed --------------------------------- */

function Feed({
  linterMeta,
  filteredCount,
  total,
  selectedPath,
  setSelectedPath,
  groupBy,
  setGroupBy,
  groups,
  allClear,
  onReset,
  onFetchSource,
}: {
  linterMeta: Record<string, ResolvedLinterMeta>;
  filteredCount: number;
  total: number;
  selectedPath: string | null;
  setSelectedPath: (v: string | null) => void;
  groupBy: GroupBy;
  setGroupBy: (g: GroupBy) => void;
  groups: Array<{ key: string; label: string | null; items: Diagnostic[] }>;
  allClear: boolean;
  onReset: () => void;
  onFetchSource?: (relativePath: string) => Promise<string>;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4" data-testid="diagnostic-feed">
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              Diagnostics
            </p>
            <p className="mt-0.5 whitespace-nowrap font-semibold text-[30px] leading-none tracking-tight tabular-nums">
              {filteredCount}
              <span className="text-sm font-normal text-ink-faint"> of {total} shown</span>
            </p>
          </div>
        </div>

        {selectedPath && (
          <div
            className="inline-flex w-fit items-center gap-2 rounded-full border border-accent-line bg-accent-soft px-3 py-1.5 text-[12.5px] text-ink-muted"
            data-testid="scope-pill"
          >
            Filtered to
            <span className="font-mono text-[12px] text-accent">{selectedPath}</span>
            <button
              type="button"
              onClick={() => setSelectedPath(null)}
              aria-label="Clear file filter"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-faint">Group by</span>
          <div className="inline-flex gap-0.5 rounded-[9px] border border-line bg-surface p-0.5">
            {(['file', 'rule', 'severity'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                data-groupby={g}
                aria-pressed={groupBy === g}
                className={cn(
                  'rounded-[6px] px-3 py-1.5 text-[12.5px] font-medium capitalize transition',
                  groupBy === g
                    ? 'bg-surface-3 text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {allClear ? (
        <AllClear />
      ) : filteredCount === 0 ? (
        <NoResults onReset={onReset} />
      ) : (
        <div className="flex flex-col gap-7">
          {groups.map((g) => (
            <div key={g.key}>
              {g.label != null && (
                <GroupHeader groupBy={groupBy} label={g.label} count={g.items.length} />
              )}
              <div className="flex flex-col gap-3.5">
                {g.items.map((d) => (
                  <DiagnosticCard
                    key={d.id}
                    diagnostic={d}
                    meta={linterMeta[d.source] ?? deriveLinterMeta(d.source)}
                    {...(onFetchSource ? { onFetchSource } : {})}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function GroupHeader({
  groupBy,
  label,
  count,
}: {
  groupBy: GroupBy;
  label: string;
  count: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 pl-0.5">
      {groupBy === 'file' ? (
        <span className="font-mono text-[12.5px]">
          <span className="text-ink-faint">{dirOf(label)}</span>
          <span className="font-medium text-ink">{baseOf(label)}</span>
        </span>
      ) : groupBy === 'severity' ? (
        <SeverityBadge severity={label as Diagnostic['severity']} />
      ) : (
        <span className="font-mono text-[12.5px] font-medium text-ink">{label}</span>
      )}
      <span className="rounded-full bg-surface-3 px-2 py-0.5 font-semibold text-[11px] text-ink-muted">
        {count}
      </span>
    </div>
  );
}

/* ------------------------------- empty states ----------------------------- */

function AllClear() {
  return (
    <div className="flex flex-col items-center gap-2.5 py-20 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-ok-bg text-ok">✓</span>
      <h3 className="font-semibold text-lg tracking-tight text-ink">No problems found</h3>
      <p className="max-w-[38ch] text-sm text-ink-faint">
        All linters passed. lintscope is watching for changes.
      </p>
    </div>
  );
}

function NoResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2.5 py-20 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-surface-2 text-ink-faint">
        <SearchIcon />
      </span>
      <h3 className="font-semibold text-lg tracking-tight text-ink">
        Nothing matches your filters
      </h3>
      <p className="max-w-[38ch] text-sm text-ink-faint">
        Try clearing the search or filters to see all diagnostics.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-2 rounded-[9px] border border-line-strong bg-surface-3 px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-surface-2"
      >
        Reset filters
      </button>
    </div>
  );
}

/* -------------------------------- primitives ------------------------------ */

const STAT_TONE = {
  error: { bar: 'bg-error', value: 'text-error', icon: 'errorMark', color: 'text-error' },
  warning: { bar: 'bg-warning', value: 'text-warning', icon: 'warnMark', color: 'text-warning' },
  ok: { bar: 'bg-ok', value: 'text-ok', icon: 'zap', color: 'text-ok' },
  neutral: { bar: 'bg-line-strong', value: 'text-ink', icon: 'file', color: 'text-ink-faint' },
} as const satisfies Record<string, { bar: string; value: string; icon: IconName; color: string }>;

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof STAT_TONE;
}) {
  const t = STAT_TONE[tone];
  return (
    <div className="relative flex flex-col gap-0.5 overflow-hidden rounded-[9px] border border-line bg-surface px-3.5 py-3">
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', t.bar)} />
      <Icon
        name={t.icon}
        size={15}
        stroke={1.9}
        className={cn('absolute top-3 right-3', t.color)}
      />
      <dd
        className={cn(
          'font-semibold text-[27px] leading-none tabular-nums tracking-tight',
          t.value,
        )}
      >
        {value}
      </dd>
      <dt className="text-[11.5px] font-medium text-ink-faint">{label}</dt>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-faint">
      {children}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-ink-faint"
    >
      <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3" />
    </svg>
  );
}
