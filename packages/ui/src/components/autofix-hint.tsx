'use client';

import { useState } from 'react';
import { cn } from '../lib/utils';
import { Icon } from './icon';

export interface AutofixHintProps {
  /** The linter's CLI autofix invocation, e.g. 'stylelint --fix'. */
  command: string;
  className?: string;
}

/**
 * Copy-to-clipboard pill for a linter's autofix command — for linters that
 * don't surface per-diagnostic fix data, instead of an inline diff we hand
 * the user the exact CLI command to run. Click to copy. The command comes
 * from the adapter's meta (via the report), never from a per-linter map here.
 */
export function AutofixHint({ command, className }: AutofixHintProps) {
  const [copied, setCopied] = useState(false);

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(command).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={copy}
      data-testid="autofix-hint"
      title={`Copy: ${command}`}
      className={cn(
        'inline-flex max-w-[220px] items-center gap-1.5 rounded-[6px] border border-line bg-surface-2 px-2 py-1 font-mono text-[11.5px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink',
        className,
      )}
    >
      <Icon name={copied ? 'check' : 'copy'} size={13} stroke={1.8} />
      <span className="truncate">{copied ? 'Copied' : command}</span>
    </button>
  );
}
