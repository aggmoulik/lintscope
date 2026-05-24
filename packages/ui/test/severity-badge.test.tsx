import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeverityBadge } from '../src/components/severity-badge';

describe('<SeverityBadge />', () => {
  it('renders the severity label as text by default', () => {
    render(<SeverityBadge severity="error" />);
    expect(screen.getByText('error')).toBeDefined();
  });

  it('exposes severity via a data attribute for filter/E2E selectors', () => {
    render(<SeverityBadge severity="warning" />);
    const el = screen.getByText('warning');
    expect(el.getAttribute('data-severity')).toBe('warning');
  });

  it('renders children when provided (custom label)', () => {
    render(<SeverityBadge severity="info">12</SeverityBadge>);
    expect(screen.getByText('12')).toBeDefined();
  });

  it('applies severity-specific classes (smoke check)', () => {
    const { rerender } = render(<SeverityBadge severity="error" />);
    expect(screen.getByText('error').className).toMatch(/red/);
    rerender(<SeverityBadge severity="warning" />);
    expect(screen.getByText('warning').className).toMatch(/amber/);
    rerender(<SeverityBadge severity="info" />);
    expect(screen.getByText('info').className).toMatch(/blue/);
  });
});
