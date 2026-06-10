import type { LintReport } from '@lintscope/schema';

/** Color tone tokens the theme defines pairings for. */
export type LinterTone = 'violet' | 'ok' | 'accent' | 'neutral';

/**
 * Fully-resolved display metadata for one linter. Components take this as a
 * REQUIRED prop — all optionality is resolved here, at the dashboard boundary,
 * never inside the component tree.
 */
export interface ResolvedLinterMeta {
  /** Always present: brand-cased name, or the raw source for unknowns. */
  label: string;
  /** Always present: color tone token. Deterministic for unknown linters. */
  tone: LinterTone;
  /** Logo slug on logos.lndev.me, or null for a tinted-square fallback. */
  logoSlug: string | null;
  /** Linter docs URL, or null. */
  docsUrl: string | null;
  /** CLI autofix invocation, or null when the linter has no autofix. */
  fixCommand: string | null;
}

/**
 * Built-in fallbacks for reports produced before adapters stamped meta into
 * `linters[]` (schema ≤ 1.0 without the additive `meta` field). New linters
 * do NOT get added here — their adapters carry the meta.
 */
const BUILTIN_META: Record<string, Omit<ResolvedLinterMeta, 'docsUrl'>> = {
  eslint: { label: 'ESLint', tone: 'violet', logoSlug: 'eslint', fixCommand: 'eslint --fix' },
  biome: { label: 'Biome', tone: 'ok', logoSlug: 'biome', fixCommand: 'biome lint --write' },
  oxc: { label: 'OXC', tone: 'accent', logoSlug: 'oxc', fixCommand: 'oxlint --fix' },
  tsc: { label: 'tsc', tone: 'violet', logoSlug: 'typescript', fixCommand: null },
  stylelint: {
    label: 'Stylelint',
    tone: 'ok',
    logoSlug: 'stylelint',
    fixCommand: 'stylelint --fix',
  },
};

const TONE_PALETTE: LinterTone[] = ['violet', 'ok', 'accent'];

/** Deterministic tone for a source name — unknown linters get a stable color. */
function toneFor(source: string): LinterTone {
  let hash = 5381;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 33) ^ source.charCodeAt(i);
  }
  return TONE_PALETTE[Math.abs(hash) % TONE_PALETTE.length] ?? 'neutral';
}

/**
 * Complete meta for a source with no report-borne meta: built-in fallback
 * first, otherwise derived (raw label + deterministic tone). Never returns
 * partial data.
 */
export function deriveLinterMeta(source: string): ResolvedLinterMeta {
  const builtin = BUILTIN_META[source];
  if (builtin) return { ...builtin, docsUrl: null };
  return { label: source, tone: toneFor(source), logoSlug: null, docsUrl: null, fixCommand: null };
}

/**
 * Resolve display meta for every linter in a report, keyed by source name.
 * Precedence: report-borne meta (stamped by the adapter runner — authoritative,
 * including "no fixCommand means no autofix") → built-in fallback → derived.
 * Also covers any diagnostic `source` missing from `linters[]`, so a lookup
 * by a diagnostic's source always succeeds.
 */
export function resolveLinterMeta(report: LintReport): Record<string, ResolvedLinterMeta> {
  const resolved: Record<string, ResolvedLinterMeta> = {};

  for (const linter of report.linters) {
    const fallback = deriveLinterMeta(linter.name);
    resolved[linter.name] = linter.meta
      ? {
          label: linter.meta.label,
          // Tone is a UI concern — report meta never carries theme tokens.
          tone: fallback.tone,
          logoSlug: linter.meta.logoSlug ?? fallback.logoSlug,
          docsUrl: linter.meta.docsUrl ?? null,
          fixCommand: linter.meta.fixCommand ?? null,
        }
      : fallback;
  }

  for (const diagnostic of report.diagnostics) {
    if (!resolved[diagnostic.source]) {
      resolved[diagnostic.source] = deriveLinterMeta(diagnostic.source);
    }
  }

  return resolved;
}
