import type { Diagnostic, LintReport, Severity } from '@lintscope/schema';
import { Command } from 'cmdk';
import { useEffect, useMemo } from 'react';
import { cn } from '../lib/utils';

/* ---------- action types ---------- */

export type CommandPaletteAction =
  | { type: 'filter-rule'; ruleId: string }
  | { type: 'filter-severity'; severity: Severity }
  | { type: 'filter-file'; relativePath: string }
  | { type: 'filter-linter'; source: string }
  | { type: 'open-rule-docs'; url: string }
  | { type: 'clear-filters' };

/* ---------- props ---------- */

export interface CommandPaletteProps {
  report: LintReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: CommandPaletteAction) => void;
  /** Max entries per group. Defaults to 10. */
  maxPerGroup?: number;
  /** If true (default), binds cmd+k / ctrl+k to toggle the palette. */
  bindShortcut?: boolean;
  className?: string;
}

/* ---------- groups built from the report ---------- */

interface SeverityEntry {
  severity: Severity;
  label: string;
  count: number;
}

interface RuleEntry {
  ruleId: string;
  count: number;
  dominantSeverity: Severity;
  url?: string;
}

interface FileEntry {
  relativePath: string;
  errorCount: number;
  warningCount: number;
}

interface LinterEntry {
  source: string;
  count: number;
}

interface GroupedActions {
  severities: SeverityEntry[];
  rules: RuleEntry[];
  files: FileEntry[];
  linters: LinterEntry[];
}

function pickDominant(counts: Record<Severity, number>): Severity {
  if (counts.error > 0) return 'error';
  if (counts.warning > 0) return 'warning';
  return 'info';
}

function buildGroups(report: LintReport, maxPerGroup: number): GroupedActions {
  const severityCounts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  const ruleMap = new Map<
    string,
    { count: number; severityCounts: Record<Severity, number>; url?: string }
  >();
  const linterCounts = new Map<string, number>();

  for (const d of report.diagnostics) {
    severityCounts[d.severity] += 1;
    if (d.ruleId) {
      let entry = ruleMap.get(d.ruleId);
      if (!entry) {
        entry = { count: 0, severityCounts: { error: 0, warning: 0, info: 0 } };
        if (d.url) entry.url = d.url;
        ruleMap.set(d.ruleId, entry);
      }
      entry.count += 1;
      entry.severityCounts[d.severity] += 1;
      if (!entry.url && d.url) entry.url = d.url;
    }
    linterCounts.set(d.source, (linterCounts.get(d.source) ?? 0) + 1);
  }

  const severities: SeverityEntry[] = (['error', 'warning', 'info'] as const)
    .filter((s) => severityCounts[s] > 0)
    .map((s) => ({ severity: s, label: s, count: severityCounts[s] }));

  const rules: RuleEntry[] = [...ruleMap.entries()]
    .map(([ruleId, info]) => ({
      ruleId,
      count: info.count,
      dominantSeverity: pickDominant(info.severityCounts),
      ...(info.url ? { url: info.url } : {}),
    }))
    .sort((a, b) => b.count - a.count || a.ruleId.localeCompare(b.ruleId))
    .slice(0, maxPerGroup);

  const files: FileEntry[] = [...report.files]
    .map((f) => ({
      relativePath: f.relativePath,
      errorCount: f.errorCount,
      warningCount: f.warningCount,
    }))
    .sort(
      (a, b) =>
        b.errorCount + b.warningCount - (a.errorCount + a.warningCount) ||
        a.relativePath.localeCompare(b.relativePath),
    )
    .slice(0, maxPerGroup);

  const linters: LinterEntry[] = [...linterCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

  return { severities, rules, files, linters };
}

/* ---------- shortcut binding ---------- */

function useToggleShortcut(enabled: boolean, toggle: () => void): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isModK) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, toggle]);
}

/* ---------- component ---------- */

const severityDot: Record<Severity, string> = {
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

export function CommandPalette({
  report,
  open,
  onOpenChange,
  onAction,
  maxPerGroup = 10,
  bindShortcut = true,
  className,
}: CommandPaletteProps) {
  const groups = useMemo(() => buildGroups(report, maxPerGroup), [report, maxPerGroup]);

  useToggleShortcut(bindShortcut, () => onOpenChange(!open));

  const run = (action: CommandPaletteAction) => {
    onAction(action);
    onOpenChange(false);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      className={cn(
        'fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[18vh] backdrop-blur-sm',
        '[&_[cmdk-overlay]]:fixed [&_[cmdk-overlay]]:inset-0 [&_[cmdk-overlay]]:bg-black/40',
        className,
      )}
      data-testid="command-palette"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <Command.Input
          placeholder="Filter or jump…"
          className="w-full border-b border-zinc-200 bg-transparent px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <Command.List className="max-h-[60vh] overflow-y-auto px-2 py-2 text-sm">
          <Command.Empty className="px-3 py-6 text-center text-zinc-500">No matches.</Command.Empty>

          <Command.Group
            heading="Actions"
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-zinc-500"
          >
            <PaletteItem value="clear-all-filters" onSelect={() => run({ type: 'clear-filters' })}>
              Clear all filters
            </PaletteItem>
          </Command.Group>

          {groups.severities.length > 0 && (
            <Command.Group
              heading="Filter by severity"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-zinc-500"
            >
              {groups.severities.map((s) => (
                <PaletteItem
                  key={`sev:${s.severity}`}
                  value={`severity ${s.severity}`}
                  onSelect={() => run({ type: 'filter-severity', severity: s.severity })}
                >
                  <span
                    aria-hidden
                    className={cn('h-1.5 w-1.5 shrink-0 rounded-full', severityDot[s.severity])}
                  />
                  <span className="capitalize">{s.label}</span>
                  <CountBadge>{s.count}</CountBadge>
                </PaletteItem>
              ))}
            </Command.Group>
          )}

          {groups.linters.length > 1 && (
            <Command.Group
              heading="Filter by linter"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-zinc-500"
            >
              {groups.linters.map((l) => (
                <PaletteItem
                  key={`linter:${l.source}`}
                  value={`linter ${l.source}`}
                  onSelect={() => run({ type: 'filter-linter', source: l.source })}
                >
                  <span className="font-mono uppercase tracking-wider">{l.source}</span>
                  <CountBadge>{l.count}</CountBadge>
                </PaletteItem>
              ))}
            </Command.Group>
          )}

          {groups.rules.length > 0 && (
            <Command.Group
              heading="Filter by rule"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-zinc-500"
            >
              {groups.rules.map((r) => (
                <PaletteItem
                  key={`rule:${r.ruleId}`}
                  value={`rule ${r.ruleId}`}
                  onSelect={() => run({ type: 'filter-rule', ruleId: r.ruleId })}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      severityDot[r.dominantSeverity],
                    )}
                  />
                  <span className="truncate font-mono">{r.ruleId}</span>
                  <CountBadge>{r.count}</CountBadge>
                  {r.url && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (r.url) run({ type: 'open-rule-docs', url: r.url });
                      }}
                      className="ml-1 rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      aria-label={`Open docs for ${r.ruleId}`}
                      data-testid="open-docs-button"
                    >
                      ↗
                    </button>
                  )}
                </PaletteItem>
              ))}
            </Command.Group>
          )}

          {groups.files.length > 0 && (
            <Command.Group
              heading="Jump to file"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-zinc-500"
            >
              {groups.files.map((f) => (
                <PaletteItem
                  key={`file:${f.relativePath}`}
                  value={`file ${f.relativePath}`}
                  onSelect={() => run({ type: 'filter-file', relativePath: f.relativePath })}
                >
                  <span className="truncate font-mono text-xs">{f.relativePath}</span>
                  {f.errorCount > 0 && <CountBadge tone="error">{f.errorCount}</CountBadge>}
                  {f.warningCount > 0 && <CountBadge tone="warning">{f.warningCount}</CountBadge>}
                </PaletteItem>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}

/* ---------- item primitive ---------- */

function PaletteItem({
  value,
  onSelect,
  children,
}: {
  value: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-zinc-800 aria-selected:bg-zinc-900 aria-selected:text-zinc-100 dark:text-zinc-200 dark:aria-selected:bg-zinc-100 dark:aria-selected:text-zinc-900"
      data-palette-value={value}
    >
      {children}
    </Command.Item>
  );
}

function CountBadge({ children, tone }: { children: React.ReactNode; tone?: 'error' | 'warning' }) {
  return (
    <span
      className={cn(
        'ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums',
        tone === 'error'
          ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
          : tone === 'warning'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
            : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
      )}
    >
      {children}
    </span>
  );
}

/* ---------- exported helpers ---------- */

/** Type guard for the action discriminator. */
export function isCommandPaletteAction(value: unknown): value is CommandPaletteAction {
  if (!value || typeof value !== 'object' || !('type' in value)) return false;
  const t = (value as { type: unknown }).type;
  return (
    t === 'filter-rule' ||
    t === 'filter-severity' ||
    t === 'filter-file' ||
    t === 'filter-linter' ||
    t === 'open-rule-docs' ||
    t === 'clear-filters'
  );
}

/** Exposed for tests + future filter UIs. Builds groups WITHOUT the cap. */
export function summarizeForPalette(report: LintReport): {
  severityCounts: Record<Severity, number>;
  uniqueRules: string[];
  uniqueLinters: string[];
} {
  const severityCounts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  const rules = new Set<string>();
  const linters = new Set<string>();
  for (const d of report.diagnostics as Diagnostic[]) {
    severityCounts[d.severity] += 1;
    if (d.ruleId) rules.add(d.ruleId);
    linters.add(d.source);
  }
  return {
    severityCounts,
    uniqueRules: [...rules].sort(),
    uniqueLinters: [...linters].sort(),
  };
}
