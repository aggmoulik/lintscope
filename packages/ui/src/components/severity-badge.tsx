import type { Severity } from '@lintscope/schema';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const badgeStyles = cva(
  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium text-xs uppercase tracking-wide ring-1 ring-inset',
  {
    variants: {
      severity: {
        error:
          'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-400/30',
        warning:
          'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-400/30',
        info: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-400/30',
      },
    },
    defaultVariants: { severity: 'warning' },
  },
);

export interface SeverityBadgeProps extends VariantProps<typeof badgeStyles> {
  severity: Severity;
  className?: string;
  children?: React.ReactNode;
}

export function SeverityBadge({ severity, className, children }: SeverityBadgeProps) {
  return (
    <span className={cn(badgeStyles({ severity }), className)} data-severity={severity}>
      {children ?? severity}
    </span>
  );
}
