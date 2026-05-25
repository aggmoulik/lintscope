import type { Diagnostic } from '@lintscope/schema';
import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  type DashboardFilters,
  EMPTY_FILTERS,
  hasActiveFilters,
} from '../src/lib/filters';

function make(overrides: Partial<Diagnostic>): Diagnostic {
  return {
    id: `d-${Math.random().toString(36).slice(2, 8)}`,
    filePath: '/repo/src/a.ts',
    relativePath: 'src/a.ts',
    line: 1,
    column: 1,
    ruleId: 'no-console',
    severity: 'error',
    message: 'msg',
    source: 'eslint',
    ...overrides,
  };
}

const SAMPLE: Diagnostic[] = [
  make({ ruleId: 'no-console', severity: 'error', source: 'eslint', relativePath: 'src/a.ts' }),
  make({
    ruleId: 'no-explicit-any',
    severity: 'warning',
    source: 'biome',
    relativePath: 'src/b.ts',
  }),
  make({ ruleId: 'prefer-const', severity: 'warning', source: 'eslint', relativePath: 'src/c.ts' }),
];

describe('hasActiveFilters', () => {
  it('returns false for EMPTY_FILTERS', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('returns true when any single dimension is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, ruleId: 'no-console' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, severity: 'warning' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, source: 'eslint' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, relativePath: 'src/a.ts' })).toBe(true);
  });
});

describe('applyFilters', () => {
  it('returns the input unchanged when no filters are active', () => {
    expect(applyFilters(SAMPLE, EMPTY_FILTERS)).toBe(SAMPLE);
  });

  it('filters by ruleId', () => {
    const r = applyFilters(SAMPLE, { ...EMPTY_FILTERS, ruleId: 'no-console' });
    expect(r.map((d) => d.ruleId)).toEqual(['no-console']);
  });

  it('filters by severity', () => {
    const r = applyFilters(SAMPLE, { ...EMPTY_FILTERS, severity: 'warning' });
    expect(r).toHaveLength(2);
    expect(r.every((d) => d.severity === 'warning')).toBe(true);
  });

  it('filters by relativePath', () => {
    const r = applyFilters(SAMPLE, { ...EMPTY_FILTERS, relativePath: 'src/b.ts' });
    expect(r).toHaveLength(1);
    expect(r[0]?.relativePath).toBe('src/b.ts');
  });

  it('filters by source (linter)', () => {
    const r = applyFilters(SAMPLE, { ...EMPTY_FILTERS, source: 'biome' });
    expect(r).toHaveLength(1);
    expect(r[0]?.source).toBe('biome');
  });

  it('AND-combines multiple filter dimensions', () => {
    const filters: DashboardFilters = {
      ...EMPTY_FILTERS,
      severity: 'warning',
      source: 'eslint',
    };
    const r = applyFilters(SAMPLE, filters);
    // warning + eslint → only prefer-const
    expect(r.map((d) => d.ruleId)).toEqual(['prefer-const']);
  });

  it('returns an empty array when no diagnostic matches', () => {
    const r = applyFilters(SAMPLE, { ...EMPTY_FILTERS, ruleId: 'unknown' });
    expect(r).toEqual([]);
  });
});
