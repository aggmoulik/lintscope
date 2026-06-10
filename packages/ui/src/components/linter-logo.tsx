'use client';

import { useState } from 'react';
import { cn } from '../lib/utils';

/**
 * Per-linter display metadata: the brand-cased name (as the authors write it)
 * + the logo slug served by logos.lndev.me, with a tinted-square fallback color.
 */
const LINTER_META: Record<string, { label: string; slug?: string; color: string }> = {
  eslint: { label: 'ESLint', slug: 'eslint', color: 'bg-violet' },
  biome: { label: 'Biome', slug: 'biome', color: 'bg-ok' },
  oxc: { label: 'OXC', slug: 'oxc', color: 'bg-accent' },
  tsc: { label: 'tsc', slug: 'typescript', color: 'bg-violet' },
  stylelint: { label: 'Stylelint', slug: 'stylelint', color: 'bg-ok' },
};

/** Brand-cased linter name (falls back to the raw source). */
export function linterLabel(source: string): string {
  return LINTER_META[source]?.label ?? source;
}

export interface LinterLogoProps {
  source: string;
  size?: number;
  className?: string;
}

/**
 * The linter's brand logo, loaded from logos.lndev.me. Falls back to a tinted
 * square (the linter's hue) for unknown sources or if the logo fails to load.
 *
 * NOTE: this is the studio's one intentional third-party request — a static
 * brand logo (no code or diagnostics ever leave the machine). Self-host the
 * SVGs if you need a zero-egress build.
 */
export function LinterLogo({ source, size = 14, className }: LinterLogoProps) {
  const meta = LINTER_META[source];
  const [failed, setFailed] = useState(false);

  if (meta?.slug && !failed) {
    return (
      <img
        src={`https://logos.lndev.me/logos/${meta.slug}.svg`}
        alt=""
        aria-hidden
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-[2px] object-contain', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn('shrink-0 rounded-[2px]', meta?.color ?? 'bg-ink-faint', className)}
      style={{ width: size, height: size }}
    />
  );
}
