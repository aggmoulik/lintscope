import { cva } from 'class-variance-authority';
import type { ResolvedLinterMeta } from '../lib/linter-meta';
import { cn } from '../lib/utils';

/**
 * Compact pill identifying which linter produced a diagnostic. Sized to sit
 * alongside `<SeverityBadge />` in cards and toolbars. Color comes from the
 * resolved meta tone, so any linter — including ones this package has never
 * heard of — renders distinctly with zero per-linter code here.
 */

const badgeStyles = cva(
  'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider',
  {
    variants: {
      tone: {
        violet: 'bg-violet/12 text-violet',
        ok: 'bg-ok-bg text-ok',
        accent: 'bg-accent-soft text-accent',
        neutral: 'bg-surface-3 text-ink-muted',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface LinterBadgeProps {
  /** Linter source. Open string matching `Diagnostic.source`. */
  source: string;
  /** Resolved display meta — from `resolveLinterMeta(report)[source]` or `deriveLinterMeta(source)`. */
  meta: ResolvedLinterMeta;
  className?: string;
  /** Override the rendered label. Defaults to the meta label. */
  children?: React.ReactNode;
}

export function LinterBadge({ source, meta, className, children }: LinterBadgeProps) {
  return (
    <span
      className={cn(badgeStyles({ tone: meta.tone }), className)}
      data-linter={source}
      title={`Source: ${source}`}
    >
      {children ?? meta.label}
    </span>
  );
}
