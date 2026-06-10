import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LinterBadge } from '../src/components/linter-badge';
import { deriveLinterMeta } from '../src/lib/linter-meta';

describe('<LinterBadge />', () => {
  it('renders the meta label by default', () => {
    render(<LinterBadge source="eslint" meta={deriveLinterMeta('eslint')} />);
    expect(screen.getByText('ESLint')).toBeDefined();
  });

  it('exposes the source via data-linter for filter selectors', () => {
    render(<LinterBadge source="biome" meta={deriveLinterMeta('biome')} />);
    expect(screen.getByText('Biome').getAttribute('data-linter')).toBe('biome');
  });

  it('colors from the meta tone, not from per-linter code', () => {
    const { rerender } = render(<LinterBadge source="eslint" meta={deriveLinterMeta('eslint')} />);
    expect(screen.getByText('ESLint').className).toMatch(/violet/);
    rerender(<LinterBadge source="biome" meta={deriveLinterMeta('biome')} />);
    expect(screen.getByText('Biome').className).toMatch(/ok/);
    rerender(<LinterBadge source="oxc" meta={deriveLinterMeta('oxc')} />);
    expect(screen.getByText('OXC').className).toMatch(/accent/);
  });

  it('renders a linter it has never heard of with a stable derived tone', () => {
    const meta = deriveLinterMeta('someday-linter');
    render(<LinterBadge source="someday-linter" meta={meta} />);
    const el = screen.getByText('someday-linter');
    expect(el.className).toMatch(new RegExp(meta.tone === 'neutral' ? 'surface-3' : meta.tone));
  });

  it('renders custom children when provided', () => {
    render(
      <LinterBadge source="eslint" meta={deriveLinterMeta('eslint')}>
        ESLint 10.4
      </LinterBadge>,
    );
    expect(screen.getByText('ESLint 10.4')).toBeDefined();
  });

  it('sets a title attribute for hover disclosure', () => {
    render(<LinterBadge source="biome" meta={deriveLinterMeta('biome')} />);
    expect(screen.getByText('Biome').getAttribute('title')).toBe('Source: biome');
  });
});
