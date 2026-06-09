'use client';

import { cn } from '../lib/utils';

export interface CodePreviewProps {
  /** Full file source (UTF-8). */
  source: string;
  /** 1-based line number where the diagnostic starts. */
  line: number;
  /** 1-based line number where the diagnostic ends. Defaults to `line`. */
  endLine?: number;
  /** Lines of surrounding context to render above and below. Defaults to 4. */
  contextLines?: number;
  /** Optional file name rendered in the header. */
  fileName?: string;
  /** 1-based column of the diagnostic — shown in the header next to the line. */
  column?: number;
  className?: string;
}

const LANG_BY_EXT: Record<string, string> = {
  ts: 'TS',
  tsx: 'TSX',
  mts: 'TS',
  cts: 'TS',
  js: 'JS',
  jsx: 'JSX',
  mjs: 'JS',
  cjs: 'JS',
  json: 'JSON',
  css: 'CSS',
  scss: 'SCSS',
  html: 'HTML',
  md: 'MD',
  mdx: 'MDX',
  vue: 'VUE',
  svelte: 'SV',
};

function langFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return LANG_BY_EXT[ext] ?? (ext ? ext.toUpperCase() : 'TXT');
}

interface RenderLine {
  number: number;
  text: string;
  isError: boolean;
}

function selectLines(
  source: string,
  startLine: number,
  endLine: number,
  contextLines: number,
): RenderLine[] {
  const allLines = source.split('\n');
  const totalLines = allLines.length;
  const fromLine = Math.max(1, startLine - contextLines);
  const toLine = Math.min(totalLines, endLine + contextLines);
  const out: RenderLine[] = [];
  for (let n = fromLine; n <= toLine; n++) {
    out.push({
      number: n,
      text: allLines[n - 1] ?? '',
      isError: n >= startLine && n <= endLine,
    });
  }
  return out;
}

/**
 * Render a small slice of source code around a diagnostic, with the offending
 * line(s) highlighted in red. Used by `<DiagnosticCard />` when a diagnostic
 * has no autofix data — we still want the user to *see* the problem.
 *
 * Pure presentational: takes source + a 1-based line number; doesn't fetch.
 */
export function CodePreview({
  source,
  line,
  endLine,
  contextLines = 4,
  fileName,
  column,
  className,
}: CodePreviewProps) {
  const lines = selectLines(source, line, endLine ?? line, contextLines);

  return (
    <div
      data-testid="code-preview"
      data-error-line={line}
      className={cn(
        'overflow-hidden rounded-[9px] border border-line bg-code font-mono text-xs text-ink',
        className,
      )}
    >
      {fileName && (
        <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-1.5">
          <span className="truncate text-ink-muted">
            {fileName}
            <span className="text-accent">
              :{line}
              {column !== undefined && `:${column}`}
            </span>
          </span>
          <span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-faint">
            {langFromName(fileName)}
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        {lines.map(({ number, text, isError }) => (
          <div
            key={number}
            data-line-number={number}
            data-error={isError || undefined}
            className={cn(
              'flex',
              isError && 'bg-error-bg shadow-[inset_2px_0_0_var(--color-error)]',
            )}
          >
            <span
              className={cn(
                'w-10 shrink-0 select-none px-2 text-end',
                isError ? 'text-error' : 'text-ink-faint',
              )}
            >
              {number}
            </span>
            <span
              aria-hidden
              className={cn(
                'w-4 shrink-0 select-none text-center font-bold',
                isError && 'text-error',
              )}
            >
              {isError ? '›' : ' '}
            </span>
            <span className="flex-1 whitespace-pre-wrap break-all">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
