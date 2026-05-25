import type { Diagnostic } from '@lintscope/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RuleSummary, summarizeByRule } from '../src/components/rule-summary';

function make(
  ruleId: string | null,
  severity: Diagnostic['severity'],
  overrides: Partial<Diagnostic> = {},
): Diagnostic {
  return {
    id: `${ruleId ?? 'parser'}-${Math.random().toString(36).slice(2, 8)}`,
    filePath: '/repo/src/a.ts',
    relativePath: 'src/a.ts',
    line: 1,
    column: 1,
    ruleId,
    severity,
    message: 'msg',
    source: 'eslint',
    ...overrides,
  };
}

describe('summarizeByRule', () => {
  it('groups by ruleId and counts occurrences', () => {
    const stats = summarizeByRule([
      make('no-console', 'error'),
      make('no-console', 'error'),
      make('prefer-const', 'warning'),
    ]);
    expect(stats.map((s) => [s.ruleId, s.count])).toEqual([
      ['no-console', 2],
      ['prefer-const', 1],
    ]);
  });

  it('sorts by count desc, then severity desc, then alpha', () => {
    const stats = summarizeByRule([
      make('a-rule', 'warning'),
      make('b-rule', 'warning'),
      make('a-rule', 'warning'),
      make('z-rule', 'error'),
    ]);
    // a-rule: count 2 → first. Then z-rule (count 1, error) > b-rule (count 1, warning).
    expect(stats.map((s) => s.ruleId)).toEqual(['a-rule', 'z-rule', 'b-rule']);
  });

  it('picks the highest severity present as dominant', () => {
    const stats = summarizeByRule([
      make('mixed', 'warning'),
      make('mixed', 'error'),
      make('mixed', 'info'),
    ]);
    expect(stats[0]?.dominantSeverity).toBe('error');
  });

  it('keeps the first non-empty docs URL for a rule', () => {
    const stats = summarizeByRule([
      make('no-x', 'error'),
      make('no-x', 'error', { url: 'https://docs.example/no-x' }),
      make('no-x', 'error', { url: 'https://other.example' }),
    ]);
    expect(stats[0]?.url).toBe('https://docs.example/no-x');
  });

  it('buckets null ruleIds as parser errors and surfaces them first', () => {
    const stats = summarizeByRule([
      make('high-frequency', 'warning'),
      make('high-frequency', 'warning'),
      make('high-frequency', 'warning'),
      make(null, 'error'),
    ]);
    // parser-error bucket comes first regardless of count.
    expect(stats[0]?.ruleId).toBeNull();
    expect(stats[0]?.count).toBe(1);
    expect(stats[1]?.ruleId).toBe('high-frequency');
  });

  it('returns an empty array for no diagnostics', () => {
    expect(summarizeByRule([])).toEqual([]);
  });
});

describe('<RuleSummary />', () => {
  const sample: Diagnostic[] = [
    make('no-console', 'error'),
    make('no-console', 'error'),
    make('prefer-const', 'warning'),
  ];

  it('renders an empty state when given no diagnostics', () => {
    render(<RuleSummary diagnostics={[]} />);
    expect(screen.getByText(/No diagnostics/)).toBeDefined();
  });

  it('renders a custom empty state when provided', () => {
    render(<RuleSummary diagnostics={[]} emptyState={<>nothing</>} />);
    expect(screen.getByText('nothing')).toBeDefined();
  });

  it('shows each rule with its count', () => {
    render(<RuleSummary diagnostics={sample} />);
    expect(screen.getByText('no-console')).toBeDefined();
    expect(screen.getByText('prefer-const')).toBeDefined();
    // counts appear as separate spans
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
  });

  it('renders the parser-error bucket label for null ruleId', () => {
    render(<RuleSummary diagnostics={[...sample, make(null, 'error')]} />);
    expect(screen.getByText('(parser error)')).toBeDefined();
  });

  it('exposes the rule id via data-rule-id (empty string for parser errors)', () => {
    render(<RuleSummary diagnostics={[...sample, make(null, 'error')]} />);
    const noConsoleRow = screen.getByText('no-console').closest('button');
    expect(noConsoleRow?.getAttribute('data-rule-id')).toBe('no-console');
    const parserRow = screen.getByText('(parser error)').closest('button');
    expect(parserRow?.getAttribute('data-rule-id')).toBe('');
  });

  it('fires onSelect with the rule id when a row is clicked', () => {
    const onSelect = vi.fn();
    render(<RuleSummary diagnostics={sample} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('no-console'));
    expect(onSelect).toHaveBeenCalledWith('no-console');
  });

  it('clears selection when the currently-selected row is clicked again', () => {
    const onSelect = vi.fn();
    render(<RuleSummary diagnostics={sample} selectedRule="no-console" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('no-console'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('marks the selected row with aria-current', () => {
    render(<RuleSummary diagnostics={sample} selectedRule="prefer-const" />);
    const row = screen.getByText('prefer-const').closest('button');
    expect(row?.getAttribute('aria-current')).toBe('true');
  });

  it('exposes the dominant severity on the row via data-severity', () => {
    render(<RuleSummary diagnostics={sample} />);
    const consoleRow = screen.getByText('no-console').closest('button');
    expect(consoleRow?.getAttribute('data-severity')).toBe('error');
    const constRow = screen.getByText('prefer-const').closest('button');
    expect(constRow?.getAttribute('data-severity')).toBe('warning');
  });
});
