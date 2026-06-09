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

describe('<LintDashboard /> v2', () => {
  it('renders the header with the linter + counts', () => {
    render(<LintDashboard report={REPORT} />);
    const header = screen.getByTestId('dashboard-header');
    expect(within(header).getByText(/eslint@9\.15\.0/)).toBeDefined();
    expect(within(header).getByText('errors')).toBeDefined();
    expect(within(header).getByText('warnings')).toBeDefined();
    expect(within(header).getByText('fixable')).toBeDefined();
  });

  it('renders FileTree, RuleSummary, and the DiagnosticList side by side', () => {
    render(<LintDashboard report={REPORT} />);
    expect(screen.getByTestId('file-tree')).toBeDefined();
    expect(screen.getByTestId('rule-summary')).toBeDefined();
    expect(screen.getByTestId('diagnostic-list-scroll')).toBeDefined();
  });

  it('filters diagnostics when a FileTree row is clicked', () => {
    render(<LintDashboard report={REPORT} />);
    const fileTree = screen.getByTestId('file-tree');
    fireEvent.click(within(fileTree).getByText('b.ts'));
    expect(screen.getByTestId('filter-pills').textContent).toContain('file: src/b.ts');
  });

  it('toggles file filter off when the same file is clicked again', () => {
    render(<LintDashboard report={REPORT} />);
    const fileTree = screen.getByTestId('file-tree');
    fireEvent.click(within(fileTree).getByText('b.ts'));
    expect(screen.queryByTestId('filter-pills')).not.toBeNull();
    fireEvent.click(within(fileTree).getByText('b.ts'));
    expect(screen.queryByTestId('filter-pills')).toBeNull();
  });

  it('filters by rule when a RuleSummary row is clicked', () => {
    render(<LintDashboard report={REPORT} />);
    const ruleSummary = screen.getByTestId('rule-summary');
    fireEvent.click(within(ruleSummary).getByText('no-console'));
    expect(screen.getByTestId('filter-pills').textContent).toContain('rule: no-console');
  });

  it('clears a single filter when its pill is clicked', () => {
    render(<LintDashboard report={REPORT} />);
    const ruleSummary = screen.getByTestId('rule-summary');
    fireEvent.click(within(ruleSummary).getByText('no-console'));
    const pill = screen.getByTestId('filter-pills').querySelector('[data-pill="ruleId"]');
    expect(pill).not.toBeNull();
    if (pill) fireEvent.click(pill);
    expect(screen.queryByTestId('filter-pills')).toBeNull();
  });

  it('shows a "showing X of Y" indicator when filtered', () => {
    render(<LintDashboard report={REPORT} />);
    const ruleSummary = screen.getByTestId('rule-summary');
    fireEvent.click(within(ruleSummary).getByText('prefer-const'));
    expect(screen.getByText(/showing 1 of 3/)).toBeDefined();
  });

  it('opens the command palette when the ⌘K button is clicked', () => {
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
  it('shows no linter-filter row when only one linter ran', () => {
    render(<LintDashboard report={REPORT} />);
    expect(screen.queryByTestId('linter-filter')).toBeNull();
  });

  it('renders a linter-filter row with one badge per linter and its diagnostic count', () => {
    render(<LintDashboard report={MULTI_REPORT} />);
    const row = screen.getByTestId('linter-filter');
    expect(within(row).getByText(/eslint · 1/)).toBeDefined();
    expect(within(row).getByText(/oxc · 2/)).toBeDefined();
  });

  it('filters diagnostics by linter when a badge is clicked', () => {
    render(<LintDashboard report={MULTI_REPORT} />);
    const row = screen.getByTestId('linter-filter');
    const oxcBtn = row.querySelector('[data-linter-filter="oxc"]');
    expect(oxcBtn).not.toBeNull();
    if (oxcBtn) fireEvent.click(oxcBtn);
    expect(screen.getByTestId('filter-pills').textContent).toContain('linter: oxc');
    expect(screen.getByText(/showing 2 of 3/)).toBeDefined();
  });
});

// Note: the previous "right-side DiffPreview panel" tests were removed when
// LintDashboard stopped rendering that panel — every diagnostic card now
// renders its own inline preview (DiffViewer for autofixes, CodePreview
// otherwise) via the `onFetchSource` prop. See diagnostic-card.tsx.
