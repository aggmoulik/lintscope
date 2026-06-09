'use client';

import { useState } from 'react';

const COMMAND = 'npx lintscope studio';

export function ConnectionError({
  title,
  message,
  hint,
  showCommand = true,
}: {
  title: string;
  message: string;
  hint?: string;
  showCommand?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Some browsers refuse without https/user-gesture context; ignore silently.
    }
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 rounded-[14px] border border-error-line bg-error-bg p-6 text-sm">
      <div>
        <p className="text-base font-semibold text-error">{title}</p>
        <p className="mt-1 text-ink">{message}</p>
        {hint && <p className="mt-2 text-xs text-ink-muted">{hint}</p>}
      </div>
      {showCommand && (
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded bg-surface-3 px-3 py-2 font-mono text-xs text-ink">
            {COMMAND}
          </code>
          <button
            type="button"
            onClick={copyCommand}
            className="rounded-md border border-line bg-surface px-3 py-2 text-xs font-medium text-ink hover:bg-surface-2"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
