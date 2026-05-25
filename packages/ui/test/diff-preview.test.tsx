import type { Diagnostic } from '@lintscope/schema';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildDiff, DiffPreview } from '../src/components/diff-preview';

const SOURCE = [
  'function greet(name) {',
  '  var greeting = "hello";', // line 2 — `var` should be `const`
  '  return greeting + name;',
  '}',
  '',
  'export default greet;',
].join('\n');

function fix(range: [number, number], text: string) {
  return { range, text };
}

function makeDiagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    id: 'x',
    filePath: '/repo/src/greet.ts',
    relativePath: 'src/greet.ts',
    line: 2,
    column: 3,
    ruleId: 'no-var',
    severity: 'warning',
    message: 'no-var',
    source: 'eslint',
    ...overrides,
  };
}

describe('buildDiff', () => {
  it('returns rows with one removed and one added when a fix replaces a single line', () => {
    // Offset of 'var greeting = "hello";' inside SOURCE
    const start = SOURCE.indexOf('var greeting');
    const end = start + 'var'.length;
    const diff = buildDiff(SOURCE, fix([start, end], 'const'));

    const removed = diff.rows.filter((r) => r.kind === 'removed');
    const added = diff.rows.filter((r) => r.kind === 'added');
    expect(removed).toHaveLength(1);
    expect(added).toHaveLength(1);
    expect(removed[0]?.text).toContain('var greeting');
    expect(added[0]?.text).toContain('const greeting');
  });

  it('caps context to the requested number of lines', () => {
    const start = SOURCE.indexOf('return');
    const end = start + 'return'.length;
    const diff = buildDiff(SOURCE, fix([start, end], 'return'), 1);
    const context = diff.rows.filter((r) => r.kind === 'context');
    // 1 line before + 1 line after (file allows it).
    expect(context).toHaveLength(2);
  });

  it('emits no context-before when the fix is on line 1', () => {
    const start = 0;
    const end = SOURCE.indexOf('\n');
    const diff = buildDiff(SOURCE, fix([start, end], '// header'), 3);
    const removed = diff.rows.filter((r) => r.kind === 'removed');
    const indexOfFirstRemoved = diff.rows.findIndex((r) => r.kind === 'removed');
    // No context rows before the first removed row.
    const contextBefore = diff.rows
      .slice(0, indexOfFirstRemoved)
      .filter((r) => r.kind === 'context');
    expect(contextBefore).toHaveLength(0);
    expect(removed[0]?.text).toBe('function greet(name) {');
  });

  it('emits no context-after when the fix is on the last line', () => {
    const lastLineStart = SOURCE.lastIndexOf('\n') + 1;
    const diff = buildDiff(SOURCE, fix([lastLineStart, SOURCE.length], 'export const x = 1;'), 3);
    const indexOfLastRemoved = (() => {
      for (let i = diff.rows.length - 1; i >= 0; i--) {
        if (diff.rows[i]?.kind === 'removed') return i;
      }
      return -1;
    })();
    const indexOfLastAdded = (() => {
      for (let i = diff.rows.length - 1; i >= 0; i--) {
        if (diff.rows[i]?.kind === 'added') return i;
      }
      return -1;
    })();
    const lastChangeIndex = Math.max(indexOfLastRemoved, indexOfLastAdded);
    const contextAfter = diff.rows.slice(lastChangeIndex + 1).filter((r) => r.kind === 'context');
    expect(contextAfter).toHaveLength(0);
  });

  it('handles a pure insertion (range[0] === range[1], non-empty text)', () => {
    const insertAt = SOURCE.indexOf('return');
    const diff = buildDiff(SOURCE, fix([insertAt, insertAt], '/* injected */ '), 2);
    expect(diff.empty).toBe(false);
    expect(diff.rows.some((r) => r.kind === 'added' && r.text.includes('injected'))).toBe(true);
  });

  it('marks a fully empty fix (no-op) as `empty: true`', () => {
    const diff = buildDiff(SOURCE, fix([0, 0], ''), 2);
    expect(diff.empty).toBe(true);
  });

  it('clamps out-of-bounds ranges to source length', () => {
    expect(() =>
      buildDiff(SOURCE, fix([SOURCE.length + 100, SOURCE.length + 200], 'X')),
    ).not.toThrow();
  });

  it('numbers old + new lines independently for context, removed, added', () => {
    const start = SOURCE.indexOf('var greeting');
    const end = start + 'var greeting = "hello";'.length;
    const diff = buildDiff(
      SOURCE,
      fix([start, end], 'const greeting = "hello";\nconst secondary = 1;'),
      0,
    );
    const removed = diff.rows.filter((r) => r.kind === 'removed');
    const added = diff.rows.filter((r) => r.kind === 'added');
    expect(removed).toHaveLength(1);
    expect(removed[0]?.oldLineNumber).toBe(2);
    expect(added).toHaveLength(2);
    expect(added[0]?.newLineNumber).toBe(2);
    expect(added[1]?.newLineNumber).toBe(3);
  });
});

describe('<DiffPreview />', () => {
  it('renders the "no autofix" empty state when diagnostic has no fix', () => {
    render(<DiffPreview diagnostic={makeDiagnostic()} source={SOURCE} />);
    expect(screen.getByText(/No autofix/)).toBeDefined();
  });

  it('renders the empty state for an empty fix', () => {
    render(
      <DiffPreview
        diagnostic={makeDiagnostic({ fix: { range: [0, 0], text: '' } })}
        source={SOURCE}
      />,
    );
    expect(screen.getByText(/No autofix/)).toBeDefined();
  });

  it('renders removed and added rows with the right data-diff-kind', () => {
    const start = SOURCE.indexOf('var');
    const end = start + 'var'.length;
    render(
      <DiffPreview
        diagnostic={makeDiagnostic({ fix: { range: [start, end], text: 'const' } })}
        source={SOURCE}
      />,
    );
    const container = screen.getByTestId('diff-preview');
    const kinds = Array.from(container.querySelectorAll('[data-diff-kind]')).map((el) =>
      el.getAttribute('data-diff-kind'),
    );
    expect(kinds).toContain('removed');
    expect(kinds).toContain('added');
    expect(kinds).toContain('context');
  });

  it('uses the highlight prop when provided', () => {
    const start = SOURCE.indexOf('var');
    const end = start + 'var'.length;
    render(
      <DiffPreview
        diagnostic={makeDiagnostic({ fix: { range: [start, end], text: 'const' } })}
        source={SOURCE}
        highlight={(line, kind) => <em>{`${kind}:${line}`}</em>}
      />,
    );
    expect(screen.getAllByText(/^removed:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^added:/).length).toBeGreaterThan(0);
  });

  it('exposes the diagnostic ruleId via data-rule-id on the container', () => {
    const start = SOURCE.indexOf('var');
    const end = start + 'var'.length;
    render(
      <DiffPreview
        diagnostic={makeDiagnostic({
          fix: { range: [start, end], text: 'const' },
          ruleId: 'no-var',
        })}
        source={SOURCE}
      />,
    );
    expect(screen.getByTestId('diff-preview').getAttribute('data-rule-id')).toBe('no-var');
  });

  it('respects custom contextLines', () => {
    const start = SOURCE.indexOf('return');
    const end = start + 'return'.length;
    render(
      <DiffPreview
        diagnostic={makeDiagnostic({ fix: { range: [start, end], text: 'return' } })}
        source={SOURCE}
        contextLines={1}
      />,
    );
    const container = screen.getByTestId('diff-preview');
    const contextRows = container.querySelectorAll('[data-diff-kind="context"]');
    expect(contextRows.length).toBe(2);
  });
});
