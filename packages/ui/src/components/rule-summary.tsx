'use client';

import type { Diagnostic, Severity } from '@lintscope/schema';
import { useMemo } from 'react';
import { cn } from '../lib/utils';

const PARSER_ERROR_KEY = '__parser_error__';
const PARSER_ERROR_LABEL = '(parser error)';

interface RuleStat {
  /** null for parser errors (Diagnostic.ruleId can be null). */
  ruleId: string | null;
  /** Stable key for React + selection. */
  key: string;
  count: number;
  /** Most-severe severity present in this rule's diagnostics. */
  dominantSeverity: Severity;
  /** First non-empty docs URL we saw — used to link the rule label. */
  url?: string;
}

const SEVERITY_RANK: Record<Severity, number> = { error: 2, warning: 1, info: 0 };

function pickDominantSeverity(counts: Record<Severity, number>): Severity {
  if (counts.error > 0) return 'error';
  if (counts.warning > 0) return 'warning';
  return 'info';
}

/**
 * Aggregate diagnostics by ruleId. Exposed for tests + future filter UI; the
 * component memoizes its own call so consumers rarely need it directly.
 */
export function summarizeByRule(diagnostics: Diagnostic[]): RuleStat[] {
  const map = new Map<string, RuleStat & { severityCounts: Record<Severity, number> }>();

  for (const d of diagnostics) {
    const key = d.ruleId ?? PARSER_ERROR_KEY;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        ruleId: d.ruleId,
        key,
        count: 0,
        dominantSeverity: 'info',
        severityCounts: { error: 0, warning: 0, info: 0 },
      };
      if (d.url) entry.url = d.url;
      map.set(key, entry);
    }
    entry.count += 1;
    entry.severityCounts[d.severity] += 1;
    if (!entry.url && d.url) entry.url = d.url;
  }

  const stats: RuleStat[] = [];
  for (const entry of map.values()) {
    stats.push({
      ruleId: entry.ruleId,
      key: entry.key,
      count: entry.count,
      dominantSeverity: pickDominantSeverity(entry.severityCounts),
      ...(entry.url ? { url: entry.url } : {}),
    });
  }

  // Sort: parser errors first, then by count desc, then by severity desc, then alpha.
  stats.sort((a, b) => {
    if (a.key === PARSER_ERROR_KEY && b.key !== PARSER_ERROR_KEY) return -1;
    if (b.key === PARSER_ERROR_KEY && a.key !== PARSER_ERROR_KEY) return 1;
    if (a.count !== b.count) return b.count - a.count;
    const rank = SEVERITY_RANK[b.dominantSeverity] - SEVERITY_RANK[a.dominantSeverity];
    if (rank !== 0) return rank;
    return (a.ruleId ?? '').localeCompare(b.ruleId ?? '');
  });

  return stats;
}

export interface RuleSummaryProps {
  diagnostics: Diagnostic[];
  /** Currently filtered rule. Pass null/undefined for "no filter". */
  selectedRule?: string | null;
  /**
   * Called when the user clicks a row. Receives the rule id, or null when
   * clicking the parser-error bucket. Click on the currently-selected rule
   * clears it (the caller receives `null`).
   */
  onSelect?: (ruleId: string | null) => void;
  className?: string;
  emptyState?: React.ReactNode;
}

const severityDotClass: Record<Severity, string> = {
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

export function RuleSummary({
  diagnostics,
  selectedRule,
  onSelect,
  className,
  emptyState,
}: RuleSummaryProps) {
  const stats = useMemo(() => summarizeByRule(diagnostics), [diagnostics]);

  if (stats.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500',
          className,
        )}
      >
        {emptyState ?? 'No diagnostics to summarize.'}
      </div>
    );
  }

  return (
    <section
      aria-label="Rules"
      className={cn(
        'overflow-auto rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950',
        className,
      )}
      data-testid="rule-summary"
    >
      <ul className="flex flex-col">
        {stats.map((stat) => {
          const selected =
            stat.ruleId !== null &&
            selectedRule !== null &&
            selectedRule !== undefined &&
            selectedRule === stat.ruleId;
          const label = stat.ruleId ?? PARSER_ERROR_LABEL;
          const handleClick = () => {
            if (!onSelect) return;
            // Clicking the already-selected row clears the filter.
            onSelect(selected ? null : stat.ruleId);
          };
          return (
            <li key={stat.key}>
              <button
                type="button"
                onClick={handleClick}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900',
                  selected
                    ? 'bg-zinc-900 text-zinc-100 hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-100'
                    : 'text-zinc-800 dark:text-zinc-200',
                )}
                data-rule-id={stat.ruleId ?? ''}
                data-severity={stat.dominantSeverity}
                aria-current={selected ? 'true' : undefined}
              >
                <span
                  aria-hidden
                  className={cn(
                    'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                    severityDotClass[stat.dominantSeverity],
                  )}
                />
                <span
                  className={cn(
                    'truncate font-mono',
                    stat.ruleId === null ? 'italic text-zinc-500' : '',
                  )}
                >
                  {label}
                </span>
                <span
                  className={cn(
                    'ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums',
                    selected
                      ? 'bg-current/15'
                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                  )}
                >
                  {stat.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
