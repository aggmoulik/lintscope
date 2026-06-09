import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LinterBadge } from '../src/components/linter-badge';

describe('<LinterBadge />', () => {
  it('renders the source label by default', () => {
    render(<LinterBadge source="eslint" />);
    expect(screen.getByText('eslint')).toBeDefined();
  });

  it('exposes the source via data-linter for filter selectors', () => {
    render(<LinterBadge source="biome" />);
    expect(screen.getByText('biome').getAttribute('data-linter')).toBe('biome');
  });

  it('applies a source-specific color class per known linter', () => {
    const { rerender } = render(<LinterBadge source="eslint" />);
    expect(screen.getByText('eslint').className).toMatch(/violet/);
    rerender(<LinterBadge source="biome" />);
    expect(screen.getByText('biome').className).toMatch(/ok/);
    rerender(<LinterBadge source="oxc" />);
    expect(screen.getByText('oxc').className).toMatch(/accent/);
    rerender(<LinterBadge source="tsc" />);
    expect(screen.getByText('tsc').className).toMatch(/violet/);
    rerender(<LinterBadge source="stylelint" />);
    expect(screen.getByText('stylelint').className).toMatch(/ok/);
  });

  it('falls back to a neutral class for unknown sources', () => {
    render(<LinterBadge source="someday-linter" />);
    expect(screen.getByText('someday-linter').className).toMatch(/surface-3/);
  });

  it('renders custom children when provided', () => {
    render(<LinterBadge source="eslint">ESLint 10.4</LinterBadge>);
    expect(screen.getByText('ESLint 10.4')).toBeDefined();
  });

  it('sets a title attribute for hover disclosure', () => {
    render(<LinterBadge source="biome" />);
    expect(screen.getByText('biome').getAttribute('title')).toBe('Source: biome');
  });
});
