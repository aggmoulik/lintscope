import type { LintReport } from '@lintscope/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileTree } from '../src/components/file-tree';

type FileEntry = LintReport['files'][number];

const sample: FileEntry[] = [
  { path: '/repo/src/foo.ts', relativePath: 'src/foo.ts', errorCount: 1, warningCount: 0 },
  { path: '/repo/src/bar.ts', relativePath: 'src/bar.ts', errorCount: 0, warningCount: 2 },
  {
    path: '/repo/src/util/helpers.ts',
    relativePath: 'src/util/helpers.ts',
    errorCount: 3,
    warningCount: 1,
  },
  { path: '/repo/readme.md', relativePath: 'readme.md', errorCount: 0, warningCount: 1 },
];

describe('<FileTree />', () => {
  it('renders an empty state when no files are supplied', () => {
    render(<FileTree files={[]} />);
    expect(screen.getByText(/No files/)).toBeDefined();
  });

  it('renders a custom empty state when provided', () => {
    render(<FileTree files={[]} emptyState={<>None 🎉</>} />);
    expect(screen.getByText('None 🎉')).toBeDefined();
  });

  it('renders top-level files and folders alphabetically with folders first', () => {
    render(<FileTree files={sample} />);
    // First button-row label is the `src` folder (folder sorted before file),
    // second top-level row is `readme.md` (file).
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]?.textContent).toContain('src');
    // readme.md is the last top-level row (file after the open folder's nested rows)
    expect(buttons.some((b) => b.textContent?.includes('readme.md'))).toBe(true);
  });

  it('rolls up error and warning counts into parent folders', () => {
    render(<FileTree files={sample} />);
    // The `src` folder aggregates: 1+0+3 = 4 errors · 0+2+1 = 3 warnings.
    const srcButton = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.startsWith('▾src') || b.textContent?.startsWith('▸src'));
    expect(srcButton?.textContent).toContain('4');
    expect(srcButton?.textContent).toContain('3');
  });

  it('expands all folders by default so every file is visible on first render', () => {
    render(<FileTree files={sample} />);
    expect(screen.getByText('foo.ts')).toBeDefined();
    expect(screen.getByText('bar.ts')).toBeDefined();
    expect(screen.getByText('helpers.ts')).toBeDefined();
  });

  it('collapses a folder when its header is clicked', () => {
    render(<FileTree files={sample} />);
    const utilFolder = screen.getAllByRole('button').find((b) => b.textContent?.includes('util'));
    expect(utilFolder).toBeDefined();
    if (!utilFolder) return;
    expect(screen.getByText('helpers.ts')).toBeDefined();
    fireEvent.click(utilFolder);
    expect(screen.queryByText('helpers.ts')).toBeNull();
  });

  it('fires onSelect with the original FileEntry when a file is clicked', () => {
    const onSelect = vi.fn();
    render(<FileTree files={sample} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('foo.ts'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toEqual({
      path: '/repo/src/foo.ts',
      relativePath: 'src/foo.ts',
      errorCount: 1,
      warningCount: 0,
    });
  });

  it('marks the selected file with aria-current="true"', () => {
    render(<FileTree files={sample} selectedPath="src/bar.ts" />);
    const barRow = screen.getByText('bar.ts').closest('button');
    expect(barRow?.getAttribute('aria-current')).toBe('true');
    const fooRow = screen.getByText('foo.ts').closest('button');
    expect(fooRow?.getAttribute('aria-current')).toBeNull();
  });

  it('exposes a stable data-relative-path attribute on each file row for selectors', () => {
    render(<FileTree files={sample} />);
    const fooRow = screen.getByText('foo.ts').closest('button');
    expect(fooRow?.getAttribute('data-relative-path')).toBe('src/foo.ts');
  });

  it('handles Windows-style path separators by normalizing to /', () => {
    render(
      <FileTree
        files={[
          {
            path: 'C:\\repo\\src\\windows.ts',
            relativePath: 'src\\windows.ts',
            errorCount: 1,
            warningCount: 0,
          },
        ]}
      />,
    );
    expect(screen.getByText('windows.ts')).toBeDefined();
  });
});
