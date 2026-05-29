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
  className?: string;
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
  className,
}: CodePreviewProps) {
  const lines = selectLines(source, line, endLine ?? line, contextLines);

  return (
    <div
      data-testid="code-preview"
      data-error-line={line}
      className={cn(
        'overflow-hidden rounded-lg border border-zinc-200 bg-white font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950',
        className,
      )}
    >
      {fileName && (
        <div className="border-b border-zinc-200 bg-zinc-100 px-3 py-1.5 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {fileName}:{line}
        </div>
      )}
      <div className="overflow-x-auto">
        {lines.map(({ number, text, isError }) => (
          <div
            key={number}
            data-line-number={number}
            data-error={isError || undefined}
            className={cn('flex', isError && 'bg-red-500/10')}
          >
            <span
              className={cn(
                'w-10 shrink-0 select-none px-2 text-end',
                isError ? 'text-red-700 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-500',
              )}
            >
              {number}
            </span>
            <span
              aria-hidden
              className={cn(
                'w-4 shrink-0 select-none text-center',
                isError && 'text-red-700 dark:text-red-400',
              )}
            >
              {isError ? '✕' : ' '}
            </span>
            <span
              className={cn(
                'flex-1 whitespace-pre-wrap break-all',
                isError && 'text-red-700 dark:text-red-400',
              )}
            >
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
