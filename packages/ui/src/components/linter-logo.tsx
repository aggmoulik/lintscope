'use client';

import { useState } from 'react';
import type { LinterTone, ResolvedLinterMeta } from '../lib/linter-meta';
import { cn } from '../lib/utils';

const TONE_BG: Record<LinterTone, string> = {
  violet: 'bg-violet',
  ok: 'bg-ok',
  accent: 'bg-accent',
  neutral: 'bg-ink-faint',
};

export interface LinterLogoProps {
  /** Resolved display meta — from `resolveLinterMeta(report)[source]` or `deriveLinterMeta(source)`. */
  meta: ResolvedLinterMeta;
  size?: number;
  className?: string;
}

/**
 * The linter's brand logo, loaded from logos.lndev.me. Falls back to a tinted
 * square (the linter's tone) when there's no logo slug or the load fails.
 *
 * NOTE: this is the studio's one intentional third-party request — a static
 * brand logo (no code or diagnostics ever leave the machine). Self-host the
 * SVGs if you need a zero-egress build.
 */
export function LinterLogo({ meta, size = 14, className }: LinterLogoProps) {
  const [failed, setFailed] = useState(false);

  if (meta.logoSlug && !failed) {
    return (
      <img
        src={`https://logos.lndev.me/logos/${meta.logoSlug}.svg`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-[2px] object-contain', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn('shrink-0 rounded-[2px]', TONE_BG[meta.tone], className)}
      style={{ width: size, height: size }}
    />
  );
}
