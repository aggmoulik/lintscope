import type { Diagnostic } from '@lintscope/schema';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiagnosticList } from '../src/components/diagnostic-list';

function makeDiagnostic(i: number): Diagnostic {
  return {
    id: `id-${i}`,
    filePath: `/repo/src/file-${i}.ts`,
    relativePath: `src/file-${i}.ts`,
    line: 1 + (i % 50),
    column: 1,
    ruleId: i % 3 === 0 ? 'no-console' : 'no-unused-vars',
    severity: i % 5 === 0 ? 'error' : 'warning',
    message: `Diagnostic number ${i}`,
    source: 'eslint',
  };
}

describe('<DiagnosticList />', () => {
  it('renders the empty state when no diagnostics are supplied', () => {
    render(<DiagnosticList diagnostics={[]} />);
    expect(screen.getByText(/No diagnostics/)).toBeDefined();
  });

  it('renders a custom empty state when provided', () => {
    render(<DiagnosticList diagnostics={[]} emptyState={<>All clear ✨</>} />);
    expect(screen.getByText('All clear ✨')).toBeDefined();
  });

  it('renders a scrolling container with virtualized rows', () => {
    const diagnostics = Array.from({ length: 1000 }, (_, i) => makeDiagnostic(i));
    render(<DiagnosticList diagnostics={diagnostics} height={400} estimateSize={100} />);
    const scrollContainer = screen.getByTestId('diagnostic-list-scroll');
    expect(scrollContainer).toBeDefined();
    // Virtualization → not every diagnostic is in the DOM at once
    const rendered = scrollContainer.querySelectorAll('[data-diagnostic-id]');
    expect(rendered.length).toBeLessThan(diagnostics.length);
    expect(rendered.length).toBeGreaterThan(0);
  });
});
