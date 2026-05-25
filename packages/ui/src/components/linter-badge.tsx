import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

/**
 * Compact pill identifying which linter produced a diagnostic. Sized to sit
 * alongside `<SeverityBadge />` in cards and toolbars. Visually distinct per
 * source so the eye can scan a mixed-linter report quickly.
 *
 * Accepts any string in `source` (matches the `Diagnostic.source` field which
 * is an open union for forward compat). Unknown sources get the neutral
 * `_unknown` variant.
 */

const badgeStyles = cva(
  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ring-1 ring-inset',
  {
    variants: {
      tone: {
        eslint:
          'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-400/30',
        biome:
          'bg-pink-50 text-pink-700 ring-pink-600/20 dark:bg-pink-950/40 dark:text-pink-300 dark:ring-pink-400/30',
        oxc: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-400/30',
        tsc: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-400/30',
        stylelint:
          'bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-400/30',
        _unknown:
          'bg-zinc-100 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-500/30',
      },
    },
    defaultVariants: { tone: '_unknown' },
  },
);

const KNOWN_SOURCES = ['eslint', 'biome', 'oxc', 'tsc', 'stylelint'] as const;
type KnownSource = (typeof KNOWN_SOURCES)[number];

function isKnownSource(value: string): value is KnownSource {
  return (KNOWN_SOURCES as readonly string[]).includes(value);
}

export type LinterBadgeTone = NonNullable<VariantProps<typeof badgeStyles>['tone']>;

export interface LinterBadgeProps {
  /** Linter source. Open string matching `Diagnostic.source`. */
  source: string;
  className?: string;
  /** Override the rendered label. Defaults to `source` uppercased. */
  children?: React.ReactNode;
}

export function LinterBadge({ source, className, children }: LinterBadgeProps) {
  const tone: LinterBadgeTone = isKnownSource(source) ? source : '_unknown';
  return (
    <span
      className={cn(badgeStyles({ tone }), className)}
      data-linter={source}
      title={`Source: ${source}`}
    >
      {children ?? source}
    </span>
  );
}
