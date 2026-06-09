import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CodePreview } from '../src/components/code-preview';

const SOURCE = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].join('\n');

describe('<CodePreview />', () => {
  it('marks the diagnostic line with data-error', () => {
    render(<CodePreview source={SOURCE} line={5} />);
    const errorRows = document.querySelectorAll('[data-error="true"]');
    expect(errorRows).toHaveLength(1);
    expect(errorRows[0]?.getAttribute('data-line-number')).toBe('5');
  });

  it('renders contextLines above and below the error line', () => {
    render(<CodePreview source={SOURCE} line={5} contextLines={2} />);
    // Should render lines 3..7 (2 above + error + 2 below).
    const rows = document.querySelectorAll('[data-line-number]');
    expect(rows).toHaveLength(5);
    expect(rows[0]?.getAttribute('data-line-number')).toBe('3');
    expect(rows[4]?.getAttribute('data-line-number')).toBe('7');
  });

  it('clamps to the start of the file when the diagnostic is on line 1', () => {
    render(<CodePreview source={SOURCE} line={1} contextLines={3} />);
    const rows = document.querySelectorAll('[data-line-number]');
    expect(rows[0]?.getAttribute('data-line-number')).toBe('1');
  });

  it('clamps to the end of the file when the diagnostic is near the end', () => {
    render(<CodePreview source={SOURCE} line={10} contextLines={3} />);
    const last = document.querySelectorAll('[data-line-number]');
    expect(last[last.length - 1]?.getAttribute('data-line-number')).toBe('10');
  });

  it('highlights a multi-line range when endLine is provided', () => {
    render(<CodePreview source={SOURCE} line={4} endLine={6} />);
    const errorRows = document.querySelectorAll('[data-error="true"]');
    expect(errorRows).toHaveLength(3);
  });

  it('renders the file name in the header when provided', () => {
    // The location `:line` is rendered in its own accent-colored span, so the
    // name + line live in adjacent nodes — assert on the concatenated text.
    const { getByTestId } = render(<CodePreview source={SOURCE} line={3} fileName="src/foo.ts" />);
    expect(getByTestId('code-preview').textContent).toContain('src/foo.ts:3');
  });
});
