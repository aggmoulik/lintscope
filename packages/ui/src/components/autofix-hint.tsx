import { cn } from '../lib/utils';

export interface AutofixHintProps {
  /** Linter source — picks the autofix command shown in the hint. */
  source: 'eslint' | 'biome' | 'oxc';
  className?: string;
}

const FIX_COMMAND: Record<AutofixHintProps['source'], string> = {
  eslint: 'eslint --fix',
  biome: 'biome lint --write',
  oxc: 'oxlint --fix',
};

/**
 * A subtle hint badge for Biome / OXC diagnostics — their JSON output
 * doesn't surface per-diagnostic fix data, so we can't render an inline
 * green/red diff. Instead, point the user at the right CLI command.
 *
 * For ESLint, prefer rendering the real diff (`<DiagnosticCard />` has the
 * autofix preview inline when `onFetchSource` is provided); the hint is the
 * fallback when no source fetcher is available.
 */
export function AutofixHint({ source, className }: AutofixHintProps) {
  return (
    <span
      data-testid="autofix-hint"
      title={`This rule may be autofixable. Run \`${FIX_COMMAND[source]}\` to apply.`}
      className={cn(
        'inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-400/20',
        className,
      )}
    >
      <span aria-hidden>↻</span>
      <span>{FIX_COMMAND[source]}</span>
    </span>
  );
}
