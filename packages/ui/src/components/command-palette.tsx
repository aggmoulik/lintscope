'use client';

import type { Diagnostic, LintReport, Severity } from '@lintscope/schema';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { useEffect, useMemo } from 'react';
import { cn } from '../lib/utils';
import { Icon } from './icon';

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
  error: 'bg-error',
  warning: 'bg-warning',
  info: 'bg-violet',
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-label="Command palette"
          data-testid="command-palette"
          className={cn(
            'fixed top-[14vh] left-1/2 z-50 w-[min(560px,92vw)] -translate-x-1/2 overflow-hidden rounded-[14px] border border-line-strong bg-surface font-sans shadow-2xl',
            className,
          )}
        >
          {/* cmdk's Command.Dialog never renders a Radix DialogTitle, which
              trips Radix's accessibility check. Compose the Dialog ourselves
              with a visually-hidden title + description so screen readers get
              a name and the dev-time warning goes away. */}
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Filter diagnostics by severity, rule, file, or linter.
          </Dialog.Description>
          <Command label="Command palette">
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Icon name="search" size={16} className="text-ink-faint" />
              <Command.Input
                placeholder="Jump to a file, rule, or message…"
                className="flex-1 bg-transparent py-3.5 text-[15px] text-ink outline-none placeholder:text-ink-faint"
              />
              <kbd className="rounded-[5px] border border-line-strong bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                esc
              </kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto px-2 py-2 text-sm">
              <Command.Empty className="px-3 py-6 text-center text-ink-faint">
                No matches.
              </Command.Empty>

              <Command.Group
                heading="Actions"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-ink-faint"
              >
                <PaletteItem
                  value="clear-all-filters"
                  onSelect={() => run({ type: 'clear-filters' })}
                >
                  Clear all filters
                </PaletteItem>
              </Command.Group>

              {groups.severities.length > 0 && (
                <Command.Group
                  heading="Filter by severity"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-ink-faint"
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
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-ink-faint"
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
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-ink-faint"
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
                          className="ml-1 rounded p-0.5 text-ink-faint hover:bg-surface-3 hover:text-ink"
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
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-ink-faint"
                >
                  {groups.files.map((f) => (
                    <PaletteItem
                      key={`file:${f.relativePath}`}
                      value={`file ${f.relativePath}`}
                      onSelect={() => run({ type: 'filter-file', relativePath: f.relativePath })}
                    >
                      <span className="truncate font-mono text-xs">{f.relativePath}</span>
                      {f.errorCount > 0 && <CountBadge tone="error">{f.errorCount}</CountBadge>}
                      {f.warningCount > 0 && (
                        <CountBadge tone="warning">{f.warningCount}</CountBadge>
                      )}
                    </PaletteItem>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
      className="flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[13px] text-ink-muted aria-selected:bg-surface-2 aria-selected:text-ink"
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
          ? 'bg-error-bg text-error'
          : tone === 'warning'
            ? 'bg-warning-bg text-warning'
            : 'bg-surface-3 text-ink-muted',
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
