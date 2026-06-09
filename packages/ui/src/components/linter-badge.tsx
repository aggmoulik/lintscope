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
  'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider',
  {
    variants: {
      tone: {
        eslint: 'bg-violet/12 text-violet',
        biome: 'bg-ok-bg text-ok',
        oxc: 'bg-accent-soft text-accent',
        tsc: 'bg-violet/12 text-violet',
        stylelint: 'bg-ok-bg text-ok',
        _unknown: 'bg-surface-3 text-ink-muted',
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
