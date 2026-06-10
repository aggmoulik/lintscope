import type { Diagnostic, LintReport } from '@lintscope/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LintDashboard } from '../src/components/lint-dashboard';

function makeDiagnostic(overrides: Partial<Diagnostic>): Diagnostic {
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

const SAMPLE_DIAGS: Diagnostic[] = [
  makeDiagnostic({ id: 'd1', ruleId: 'no-console', severity: 'error', relativePath: 'src/a.ts' }),
  makeDiagnostic({ id: 'd2', ruleId: 'no-console', severity: 'error', relativePath: 'src/a.ts' }),
  makeDiagnostic({
    id: 'd3',
    ruleId: 'prefer-const',
    severity: 'warning',
    relativePath: 'src/b.ts',
    fix: { range: [0, 3], text: 'const' },
  }),
];

const REPORT: LintReport = {
  schemaVersion: '1.0',
  generatedAt: '2026-05-26T10:00:00.000Z',
  projectRoot: '/repo',
  linters: [{ name: 'eslint', version: '9.15.0' }],
  files: [
    { path: '/repo/src/a.ts', relativePath: 'src/a.ts', errorCount: 2, warningCount: 0 },
    { path: '/repo/src/b.ts', relativePath: 'src/b.ts', errorCount: 0, warningCount: 1 },
  ],
  diagnostics: SAMPLE_DIAGS,
  summary: {
    errorCount: 2,
    warningCount: 1,
    fixableCount: 1,
    fileCount: 2,
    ruleFrequency: { 'no-console': 2, 'prefer-const': 1 },
  },
};

describe('<LintDashboard /> layout', () => {
  it('renders the top bar with the project brand + search', () => {
    render(<LintDashboard report={REPORT} />);
    const topbar = screen.getByTestId('dashboard-topbar');
    expect(within(topbar).getByText('lintscope')).toBeDefined();
    expect(within(topbar).getByText('repo')).toBeDefined(); // projectRoot basename
    expect(screen.getByTestId('open-palette-button')).toBeDefined();
  });

  it('renders the sidebar stat tiles (errors / warnings / auto-fixable / files)', () => {
    render(<LintDashboard report={REPORT} />);
    const tiles = screen.getByTestId('stat-tiles');
    expect(within(tiles).getByText('Errors')).toBeDefined();
    expect(within(tiles).getByText('Warnings')).toBeDefined();
    expect(within(tiles).getByText('Auto-fixable')).toBeDefined();
    expect(within(tiles).getByText('Files affected')).toBeDefined();
  });

  it('does NOT count suggestion-only diagnostics as auto-fixable (matches the card badge)', () => {
    // ESLint suggestions are manual-choice hints — `eslint --fix` does not
    // apply them. d1 gets suggestions only, d3 keeps a real inline fix.
    const report: LintReport = {
      ...REPORT,
      diagnostics: [
        makeDiagnostic({
          id: 'd1',
          relativePath: 'src/a.ts',
          suggestions: [{ desc: 'use console.warn', fix: { range: [0, 3], text: 'warn' } }],
        }),
        makeDiagnostic({ id: 'd2', relativePath: 'src/a.ts' }),
        makeDiagnostic({
          id: 'd3',
          severity: 'warning',
          relativePath: 'src/b.ts',
          fix: { range: [0, 3], text: 'const' },
        }),
      ],
    };
    render(<LintDashboard report={report} />);
    const tiles = screen.getByTestId('stat-tiles');
    const fixableTile = within(tiles).getByText('Auto-fixable').parentElement;
    expect(fixableTile?.textContent).toContain('1');
    expect(fixableTile?.textContent).not.toContain('2');
  });

  it('renders the FileTree and the grouped diagnostic feed', () => {
    render(<LintDashboard report={REPORT} />);
    expect(screen.getByTestId('file-tree')).toBeDefined();
    expect(screen.getByTestId('diagnostic-feed')).toBeDefined();
    // default group-by = file → group headers, no flat virtualized scroller
    expect(screen.getByTestId('diagnostic-feed').textContent).toContain('of 3 shown');
  });

  it('scopes the feed when a FileTree row is clicked (and shows a scope pill)', () => {
    render(<LintDashboard report={REPORT} />);
    const tree = screen.getByTestId('file-tree');
    // `src` holds only files → collapsed by default; expand it first.
    fireEvent.click(within(tree).getByText('src'));
    fireEvent.click(within(tree).getByText('b.ts'));
    const pill = screen.getByTestId('scope-pill');
    expect(pill.textContent).toContain('src/b.ts');
    expect(screen.getByTestId('diagnostic-feed').textContent).toContain('1 of 3 shown');
  });

  it('toggles the file scope off when the same file is clicked again', () => {
    render(<LintDashboard report={REPORT} />);
    const tree = screen.getByTestId('file-tree');
    fireEvent.click(within(tree).getByText('src'));
    fireEvent.click(within(tree).getByText('b.ts'));
    expect(screen.queryByTestId('scope-pill')).not.toBeNull();
    fireEvent.click(within(tree).getByText('b.ts'));
    expect(screen.queryByTestId('scope-pill')).toBeNull();
  });

  it('regroups the feed via the group-by control', () => {
    render(<LintDashboard report={REPORT} />);
    const groupByRule = screen
      .getByTestId('diagnostic-feed')
      .querySelector('[data-groupby="rule"]');
    if (!groupByRule) throw new Error('group-by "rule" control not found');
    fireEvent.click(groupByRule);
    // grouped by rule → both rule names appear as group headers
    expect(screen.getAllByText('no-console').length).toBeGreaterThan(0);
    expect(screen.getAllByText('prefer-const').length).toBeGreaterThan(0);
  });

  it('opens the command palette when the search button is clicked', () => {
    render(<LintDashboard report={REPORT} />);
    expect(screen.queryByTestId('command-palette')).toBeNull();
    fireEvent.click(screen.getByTestId('open-palette-button'));
    expect(screen.getByTestId('command-palette')).toBeDefined();
  });
});

const MULTI_REPORT: LintReport = {
  ...REPORT,
  linters: [
    { name: 'eslint', version: '9.15.0' },
    { name: 'oxc', version: '1.66.0' },
  ],
  diagnostics: [
    makeDiagnostic({ id: 'm1', source: 'eslint', ruleId: 'no-console', relativePath: 'src/a.ts' }),
    makeDiagnostic({ id: 'm2', source: 'oxc', ruleId: 'no-debugger', relativePath: 'src/a.ts' }),
    makeDiagnostic({
      id: 'm3',
      source: 'oxc',
      ruleId: 'no-debugger',
      severity: 'warning',
      relativePath: 'src/b.ts',
    }),
  ],
};

describe('<LintDashboard /> multi-linter', () => {
  it('shows no LINTERS section when only one linter ran', () => {
    render(<LintDashboard report={REPORT} />);
    expect(screen.queryByTestId('linter-filter')).toBeNull();
  });

  it('renders a LINTERS row with one tag per linter and its diagnostic count', () => {
    render(<LintDashboard report={MULTI_REPORT} />);
    const row = screen.getByTestId('linter-filter');
    // Tags show the brand-cased name (ESLint / OXC) + the per-linter count.
    const eslintTag = row.querySelector('[data-linter-filter="eslint"]');
    expect(eslintTag?.textContent).toContain('ESLint');
    expect(eslintTag?.textContent).toContain('1');
    const oxcTag = row.querySelector('[data-linter-filter="oxc"]');
    expect(oxcTag?.textContent).toContain('OXC');
    expect(oxcTag?.textContent).toContain('2');
  });

  it('filters diagnostics by linter when a tag is clicked', () => {
    render(<LintDashboard report={MULTI_REPORT} />);
    const row = screen.getByTestId('linter-filter');
    const oxcBtn = row.querySelector('[data-linter-filter="oxc"]');
    expect(oxcBtn).not.toBeNull();
    if (oxcBtn) fireEvent.click(oxcBtn);
    expect(screen.getByTestId('diagnostic-feed').textContent).toContain('2 of 3 shown');
  });
});
