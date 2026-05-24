import type { Diagnostic } from '@lintscope/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagnosticCard } from '../src/components/diagnostic-card';

const sample: Diagnostic = {
  id: 'abc123',
  filePath: '/repo/src/foo.ts',
  relativePath: 'src/foo.ts',
  line: 12,
  column: 3,
  ruleId: 'no-unused-vars',
  severity: 'warning',
  message: "'foo' is defined but never used.",
  source: 'eslint',
  url: 'https://eslint.org/docs/rules/no-unused-vars',
};

describe('<DiagnosticCard />', () => {
  it('shows rule id, message, and location', () => {
    render(<DiagnosticCard diagnostic={sample} />);
    expect(screen.getByText('no-unused-vars')).toBeDefined();
    expect(screen.getByText("'foo' is defined but never used.")).toBeDefined();
    expect(screen.getByText(/src\/foo\.ts/).textContent).toContain(':12:3');
  });

  it('renders rule id as a link when url is provided', () => {
    render(<DiagnosticCard diagnostic={sample} />);
    const link = screen.getByRole('link', { name: 'no-unused-vars' }) as HTMLAnchorElement;
    expect(link.href).toBe('https://eslint.org/docs/rules/no-unused-vars');
  });

  it('shows a "fixable" indicator when fix is present', () => {
    render(<DiagnosticCard diagnostic={{ ...sample, fix: { range: [0, 1], text: '' } }} />);
    expect(screen.getByText('fixable')).toBeDefined();
  });

  it('shows a "suggested" indicator when only suggestions exist', () => {
    render(
      <DiagnosticCard
        diagnostic={{
          ...sample,
          suggestions: [{ desc: 'do x', fix: { range: [0, 1], text: 'x' } }],
        }}
      />,
    );
    expect(screen.getByText('suggested')).toBeDefined();
  });

  it('renders "parser-error" placeholder for null rule id', () => {
    render(<DiagnosticCard diagnostic={{ ...sample, ruleId: null, url: undefined }} />);
    expect(screen.getByText('parser-error')).toBeDefined();
  });

  it('fires onClick handler when clicked', () => {
    const onClick = vi.fn();
    render(<DiagnosticCard diagnostic={sample} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(sample);
  });

  it('fires onClick on Enter / Space when interactive', () => {
    const onClick = vi.fn();
    render(<DiagnosticCard diagnostic={sample} onClick={onClick} />);
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
