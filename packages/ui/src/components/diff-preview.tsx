import type { Diagnostic, Fix } from '@lintscope/schema';
import { useMemo } from 'react';
import { cn } from '../lib/utils';

/* ---------- pure diff math ---------- */

export type DiffRowKind = 'context' | 'removed' | 'added';

export interface DiffRow {
  kind: DiffRowKind;
  /** Line content WITHOUT trailing newline. May be empty. */
  text: string;
  /** 1-indexed line number in the BEFORE document. Set on context + removed rows. */
  oldLineNumber?: number;
  /** 1-indexed line number in the AFTER document. Set on context + added rows. */
  newLineNumber?: number;
}

export interface BuiltDiff {
  rows: DiffRow[];
  /** Whether the fix actually changed anything (range non-empty OR text non-empty). */
  empty: boolean;
}

/** 0-indexed line containing this byte offset. */
function offsetToLineIndex(source: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, source.length));
  let line = 0;
  for (let i = 0; i < clamped; i++) {
    if (source.charCodeAt(i) === 0x0a /* \n */) line += 1;
  }
  return line;
}

/** Byte offset of the start of the given 0-indexed line. */
function startOfLine(source: string, lineIndex: number): number {
  if (lineIndex <= 0) return 0;
  let line = 0;
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 0x0a) {
      line += 1;
      if (line === lineIndex) return i + 1;
    }
  }
  return source.length;
}

/** Byte offset of the line break (or EOF) ending the line that contains `offset`. */
function endOfLine(source: string, offset: number): number {
  const idx = source.indexOf('\n', Math.max(0, Math.min(offset, source.length)));
  return idx === -1 ? source.length : idx;
}

/**
 * Build a unified-diff representation of applying `fix` to `source`.
 *
 * The algorithm:
 *   1. Find the line range the fix covers in the BEFORE source.
 *   2. Compute the affected text (a contiguous slice of the before source),
 *      apply the fix to get the affected-after text.
 *   3. Emit `removed` rows for the before lines, `added` rows for the after
 *      lines, and `context` rows from `contextLines` before + after.
 *
 * Pure — exported separately from the component for easy testing.
 */
export function buildDiff(source: string, fix: Fix, contextLines = 3): BuiltDiff {
  const [start, end] = fix.range;
  const startClamped = Math.max(0, Math.min(start, source.length));
  const endClamped = Math.max(startClamped, Math.min(end, source.length));

  const startLine = offsetToLineIndex(source, startClamped);
  const endLine = offsetToLineIndex(source, endClamped);

  const lineStart = startOfLine(source, startLine);
  const lineEnd = endOfLine(source, endClamped);

  const beforeAffected = source.slice(lineStart, lineEnd);
  const afterAffected =
    source.slice(lineStart, startClamped) + fix.text + source.slice(endClamped, lineEnd);

  const beforeLines = beforeAffected.split('\n');
  const afterLines = afterAffected.split('\n');

  // Walk context BEFORE
  const allBeforeLines = source.split('\n');
  const contextBeforeStart = Math.max(0, startLine - contextLines);
  const contextBefore = allBeforeLines.slice(contextBeforeStart, startLine);

  // Walk context AFTER (from after the affected range in the BEFORE source —
  // by definition unchanged on both sides, so we can take it from either)
  const contextAfter = allBeforeLines.slice(endLine + 1, endLine + 1 + contextLines);

  const rows: DiffRow[] = [];
  let oldLineCursor = contextBeforeStart + 1; // 1-indexed
  let newLineCursor = contextBeforeStart + 1;

  for (const text of contextBefore) {
    rows.push({
      kind: 'context',
      text,
      oldLineNumber: oldLineCursor,
      newLineNumber: newLineCursor,
    });
    oldLineCursor += 1;
    newLineCursor += 1;
  }

  for (const text of beforeLines) {
    rows.push({ kind: 'removed', text, oldLineNumber: oldLineCursor });
    oldLineCursor += 1;
  }
  for (const text of afterLines) {
    rows.push({ kind: 'added', text, newLineNumber: newLineCursor });
    newLineCursor += 1;
  }

  for (const text of contextAfter) {
    rows.push({
      kind: 'context',
      text,
      oldLineNumber: oldLineCursor,
      newLineNumber: newLineCursor,
    });
    oldLineCursor += 1;
    newLineCursor += 1;
  }

  const isEmptyFix = startClamped === endClamped && fix.text.length === 0;
  return { rows, empty: isEmptyFix };
}

/* ---------- component ---------- */

export interface DiffPreviewProps {
  diagnostic: Diagnostic;
  /** The full source text of `diagnostic.filePath`. Caller fetches via /file. */
  source: string;
  /** Number of unchanged context lines around the change. Defaults to 3. */
  contextLines?: number;
  /**
   * Optional per-line highlighter. Receives the raw line + its kind and
   * returns React content (e.g. Shiki-rendered HTML). When omitted the row
   * renders plain text in monospace.
   */
  highlight?: (line: string, kind: DiffRowKind) => React.ReactNode;
  className?: string;
  /** Override the no-fix-available empty state. */
  emptyState?: React.ReactNode;
}

const rowBgClass: Record<DiffRowKind, string> = {
  context: '',
  removed: 'bg-red-50 dark:bg-red-950/40',
  added: 'bg-emerald-50 dark:bg-emerald-950/40',
};

const rowTextClass: Record<DiffRowKind, string> = {
  context: 'text-zinc-700 dark:text-zinc-300',
  removed: 'text-red-900 dark:text-red-200',
  added: 'text-emerald-900 dark:text-emerald-200',
};

const rowPrefix: Record<DiffRowKind, string> = {
  context: ' ',
  removed: '-',
  added: '+',
};

export function DiffPreview({
  diagnostic,
  source,
  contextLines = 3,
  highlight,
  className,
  emptyState,
}: DiffPreviewProps) {
  const diff = useMemo(() => {
    if (!diagnostic.fix) return null;
    return buildDiff(source, diagnostic.fix, contextLines);
  }, [diagnostic.fix, source, contextLines]);

  if (!diff || diff.empty) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500',
          className,
        )}
      >
        {emptyState ?? 'No autofix available for this diagnostic.'}
      </div>
    );
  }

  return (
    <pre
      className={cn(
        'overflow-x-auto rounded-lg border border-zinc-200 bg-white font-mono text-xs leading-relaxed dark:border-zinc-800 dark:bg-zinc-950',
        className,
      )}
      data-testid="diff-preview"
      data-rule-id={diagnostic.ruleId ?? ''}
    >
      <code className="block">
        {diff.rows.map((row, i) => (
          <div
            // Index keys are fine here: rows are stable for the lifetime of
            // the (memoized) diff. If `source` changes, the whole array
            // recomputes anyway.
            // biome-ignore lint/suspicious/noArrayIndexKey: stable across renders
            key={i}
            className={cn('flex gap-2 px-3', rowBgClass[row.kind], rowTextClass[row.kind])}
            data-diff-kind={row.kind}
          >
            <span
              aria-hidden
              className="w-8 shrink-0 select-none text-right text-zinc-400 dark:text-zinc-600"
            >
              {row.kind === 'added' ? (row.newLineNumber ?? '') : (row.oldLineNumber ?? '')}
            </span>
            <span aria-hidden className="w-3 shrink-0 select-none">
              {rowPrefix[row.kind]}
            </span>
            <span className="flex-1 whitespace-pre">
              {highlight ? highlight(row.text, row.kind) : row.text || ' '}
            </span>
          </div>
        ))}
      </code>
    </pre>
  );
}
