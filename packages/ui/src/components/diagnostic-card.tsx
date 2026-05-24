import type { Diagnostic } from '@lintscope/schema';
import { cn } from '../lib/utils';
import { SeverityBadge } from './severity-badge';

export interface DiagnosticCardProps {
  diagnostic: Diagnostic;
  className?: string;
  onClick?: (diagnostic: Diagnostic) => void;
}

export function DiagnosticCard({ diagnostic, className, onClick }: DiagnosticCardProps) {
  const hasFix = Boolean(diagnostic.fix);
  const hasSuggestions = Boolean(diagnostic.suggestions?.length);

  return (
    <article
      data-diagnostic-id={diagnostic.id}
      data-severity={diagnostic.severity}
      onClick={onClick ? () => onClick(diagnostic) : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(diagnostic);
              }
            }
          : undefined
      }
      tabIndex={onClick ? 0 : -1}
      role={onClick ? 'button' : undefined}
      className={cn(
        'group flex w-full flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 transition-colors dark:border-zinc-800 dark:bg-zinc-950',
        onClick &&
          'cursor-pointer hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:hover:border-zinc-700 dark:hover:bg-zinc-900',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={diagnostic.severity} />
          {diagnostic.ruleId ? (
            diagnostic.url ? (
              <a
                href={diagnostic.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-sm text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
              >
                {diagnostic.ruleId}
              </a>
            ) : (
              <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
                {diagnostic.ruleId}
              </span>
            )
          ) : (
            <span className="font-mono text-sm text-zinc-500 italic dark:text-zinc-500">
              parser-error
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasFix && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/30">
              fixable
            </span>
          )}
          {!hasFix && hasSuggestions && (
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700 ring-1 ring-inset ring-indigo-600/20 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-400/30">
              suggested
            </span>
          )}
        </div>
      </header>

      <p className="text-sm leading-relaxed text-zinc-900 dark:text-zinc-100">
        {diagnostic.message}
      </p>

      <footer className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
        <span className="font-mono">
          {diagnostic.relativePath}
          <span className="text-zinc-400">
            :{diagnostic.line}:{diagnostic.column}
          </span>
        </span>
        <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
          ·
        </span>
        <span className="font-mono uppercase tracking-wider">{diagnostic.source}</span>
      </footer>
    </article>
  );
}
