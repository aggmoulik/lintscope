import type { Severity } from '@lintscope/schema';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { Icon, type IconName } from './icon';

const badgeStyles = cva(
  'inline-flex items-center gap-1.5 rounded-full py-[3px] pr-2.5 pl-[7px] font-semibold text-[11.5px] capitalize tracking-[0.01em]',
  {
    variants: {
      severity: {
        error: 'bg-error-bg text-error',
        warning: 'bg-warning-bg text-warning',
        info: 'bg-violet/12 text-violet',
      },
    },
    defaultVariants: { severity: 'warning' },
  },
);

const SEV_ICON: Record<Severity, IconName> = {
  error: 'errorMark',
  warning: 'warnMark',
  info: 'warnMark',
};

export interface SeverityBadgeProps extends VariantProps<typeof badgeStyles> {
  severity: Severity;
  className?: string;
  children?: React.ReactNode;
}

export function SeverityBadge({ severity, className, children }: SeverityBadgeProps) {
  return (
    <span className={cn(badgeStyles({ severity }), className)} data-severity={severity}>
      <Icon name={SEV_ICON[severity]} size={13} stroke={2} />
      {children ?? severity}
    </span>
  );
}
