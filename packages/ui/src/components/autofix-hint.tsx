'use client';

import { useState } from 'react';
import { cn } from '../lib/utils';
import { Icon } from './icon';

export interface AutofixHintProps {
  /** Linter source — picks the autofix command. */
  source: 'eslint' | 'biome' | 'oxc';
  className?: string;
}

const FIX_COMMAND: Record<AutofixHintProps['source'], string> = {
  eslint: 'eslint --fix',
  biome: 'biome lint --write',
  oxc: 'oxlint --fix',
};

/**
 * Copy-to-clipboard pill for a linter's autofix command — Biome / OXC don't
 * surface per-diagnostic fix data, so instead of an inline diff we hand the
 * user the exact CLI command to run. Click to copy.
 */
export function AutofixHint({ source, className }: AutofixHintProps) {
  const cmd = FIX_COMMAND[source];
  const [copied, setCopied] = useState(false);

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(cmd).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={copy}
      data-testid="autofix-hint"
      title={`Copy: ${cmd}`}
      className={cn(
        'inline-flex max-w-[220px] items-center gap-1.5 rounded-[6px] border border-line bg-surface-2 px-2 py-1 font-mono text-[11.5px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink',
        className,
      )}
    >
      <Icon name={copied ? 'check' : 'copy'} size={13} stroke={1.8} />
      <span className="truncate">{copied ? 'Copied' : cmd}</span>
    </button>
  );
}
