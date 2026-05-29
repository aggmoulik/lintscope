import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { computeDiff, DiffViewer } from '../src/components/diff-viewer';

describe('<DiffViewer />', () => {
  it('renders an empty-state pre when no inputs are given', () => {
    render(<DiffViewer />);
    expect(screen.getByText(/No diff content/)).toBeDefined();
  });

  it('renders both removed and added lines when oldFile/newFile are supplied', () => {
    render(
      <DiffViewer
        oldFile={{ content: 'const x = 1\n', name: 'a.ts' }}
        newFile={{ content: 'const x = 2\n', name: 'a.ts' }}
        showLineNumbers={false}
        showIcon={false}
      />,
    );
    // Removed line ('-' indicator) and added line ('+' indicator) both present.
    const removed = document.querySelectorAll('[data-slot="diff-viewer-line"][data-type="del"]');
    const added = document.querySelectorAll('[data-slot="diff-viewer-line"][data-type="add"]');
    expect(removed.length).toBeGreaterThan(0);
    expect(added.length).toBeGreaterThan(0);
  });

  it('renders a patch string in unified mode', () => {
    const patch = [
      '--- a/foo.ts',
      '+++ b/foo.ts',
      '@@ -1,1 +1,1 @@',
      '-const x = 1',
      '+const x = 2',
      '',
    ].join('\n');
    render(<DiffViewer patch={patch} showLineNumbers={false} />);
    const lines = document.querySelectorAll('[data-slot="diff-viewer-line"]');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});

describe('computeDiff', () => {
  it('counts additions and deletions', () => {
    const out = computeDiff('a\nb\nc\n', 'a\nB\nc\n');
    expect(out.additions).toBe(1);
    expect(out.deletions).toBe(1);
  });

  it('reports identical inputs as all normal lines (no add/del)', () => {
    const out = computeDiff('hello\n', 'hello\n');
    expect(out.additions).toBe(0);
    expect(out.deletions).toBe(0);
  });
});
