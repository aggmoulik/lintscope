import type { Diagnostic, Severity } from '@lintscope/schema';

/**
 * Active filter state for the dashboard. Every field is optional / nullable.
 * Empty / null fields mean "no filter for this dimension".
 */
export interface DashboardFilters {
  ruleId: string | null;
  severity: Severity | null;
  relativePath: string | null;
  source: string | null;
}

export const EMPTY_FILTERS: DashboardFilters = {
  ruleId: null,
  severity: null,
  relativePath: null,
  source: null,
};

/** Pure — returns the diagnostics matching the active filters. */
export function applyFilters(diagnostics: Diagnostic[], filters: DashboardFilters): Diagnostic[] {
  if (!filters.ruleId && !filters.severity && !filters.relativePath && !filters.source) {
    return diagnostics;
  }
  return diagnostics.filter((d) => {
    if (filters.ruleId && d.ruleId !== filters.ruleId) return false;
    if (filters.severity && d.severity !== filters.severity) return false;
    if (filters.relativePath && d.relativePath !== filters.relativePath) return false;
    if (filters.source && d.source !== filters.source) return false;
    return true;
  });
}

/** True when at least one filter dimension is set. */
export function hasActiveFilters(filters: DashboardFilters): boolean {
  return Boolean(filters.ruleId || filters.severity || filters.relativePath || filters.source);
}
