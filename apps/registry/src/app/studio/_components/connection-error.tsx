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
    <div className="mx-auto flex max-w-xl flex-col gap-4 rounded-lg border border-red-200 bg-red-50 p-6 text-sm dark:border-red-900/40 dark:bg-red-950/40">
      <div>
        <p className="text-base font-semibold text-red-900 dark:text-red-200">{title}</p>
        <p className="mt-1 text-red-800 dark:text-red-300">{message}</p>
        {hint && <p className="mt-2 text-xs text-red-700/80 dark:text-red-300/70">{hint}</p>}
      </div>
      {showCommand && (
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100">
            {COMMAND}
          </code>
          <button
            type="button"
            onClick={copyCommand}
            className="rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-900 hover:bg-red-100 dark:border-red-900/40 dark:bg-zinc-900 dark:text-red-200 dark:hover:bg-red-950/40"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
