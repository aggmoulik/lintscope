'use client';

import { cn, Icon } from '@lintscope/ui';
import { useState } from 'react';

export interface CommandChipProps {
  /** The exact text copied to the clipboard. */
  command: string;
  /** Dimmed leading glyph (shell prompt). Pass an empty string to hide it. */
  prefix?: string;
  className?: string;
}

/**
 * A warm code chip with a copy button. Used for every install/run command on
 * the landing page so they all behave (and look) identically.
 */
export function CommandChip({ command, prefix = '$', className }: CommandChipProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (insecure context / denied) — fail quietly.
    }
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-line bg-code px-3.5 py-2.5 font-mono text-sm shadow-card',
        className,
      )}
    >
      {prefix ? (
        <span aria-hidden className="select-none text-accent">
          {prefix}
        </span>
      ) : null}
      <code className="flex-1 overflow-x-auto whitespace-nowrap text-ink [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy command'}
        className="-mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Icon name={copied ? 'check' : 'copy'} size={15} className={copied ? 'text-ok' : ''} />
      </button>
    </div>
  );
}
