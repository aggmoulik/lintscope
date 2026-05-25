import type { Diagnostic, LintReport } from '@lintscope/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('renders the DiffPreview panel when a diagnostic with a fix is selected and source resolves', () => {
    const getFileSource = vi.fn((path: string) => (path === 'src/b.ts' ? 'let count = 1;' : null));
    render(<LintDashboard report={REPORT} getFileSource={getFileSource} />);
    expect(screen.queryByTestId('diff-preview')).toBeNull();

    // Narrow to the prefer-const diagnostic (the only one with a fix).
    const ruleSummary = screen.getByTestId('rule-summary');
    fireEvent.click(within(ruleSummary).getByText('prefer-const'));

    // After filtering, the DiagnosticList shows only d3. Find its card by
    // its diagnostic id and click it to select.
    const list = screen.getByTestId('diagnostic-list-scroll');
    const cards = list.querySelectorAll('[data-diagnostic-id]');
    expect(cards).toHaveLength(1);
    fireEvent.click(cards[0] as HTMLElement);

    expect(screen.getByTestId('diff-preview')).toBeDefined();
    expect(getFileSource).toHaveBeenCalledWith('src/b.ts');
  });

  it('hides the DiffPreview when getFileSource returns null', () => {
    const getFileSource = vi.fn(() => null);
    render(<LintDashboard report={REPORT} getFileSource={getFileSource} />);
    const ruleSummary = screen.getByTestId('rule-summary');
    fireEvent.click(within(ruleSummary).getByText('prefer-const'));
    const list = screen.getByTestId('diagnostic-list-scroll');
    const cards = list.querySelectorAll('[data-diagnostic-id]');
    fireEvent.click(cards[0] as HTMLElement);
    expect(screen.queryByTestId('diff-preview')).toBeNull();
  });
});
