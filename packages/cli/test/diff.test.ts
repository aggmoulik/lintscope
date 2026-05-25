import type { Diagnostic } from '@lintscope/schema';
import { describe, expect, it } from 'vitest';
import { diffDiagnostics } from '../src/diff';

const make = (id: string, overrides: Partial<Diagnostic> = {}): Diagnostic => ({
  id,
  filePath: `/repo/src/${id}.ts`,
  relativePath: `src/${id}.ts`,
  line: 1,
  column: 1,
  ruleId: 'no-console',
  severity: 'error',
  message: 'Unexpected console',
  source: 'eslint',
  ...overrides,
});

describe('diffDiagnostics', () => {
  it('returns empty arrays when previous and next are identical', () => {
    const list = [make('a'), make('b')];
    expect(diffDiagnostics(list, list)).toEqual({ added: [], removed: [] });
  });

  it('detects an added diagnostic', () => {
    const before = [make('a')];
    const after = [make('a'), make('b')];
    const diff = diffDiagnostics(before, after);
    expect(diff.removed).toEqual([]);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]?.id).toBe('b');
  });

  it('detects a removed diagnostic by id', () => {
    const before = [make('a'), make('b')];
    const after = [make('a')];
    const diff = diffDiagnostics(before, after);
    expect(diff.removed).toEqual(['b']);
    expect(diff.added).toEqual([]);
  });

  it('returns both added and removed when both occur', () => {
    const before = [make('a'), make('b')];
    const after = [make('b'), make('c')];
    const diff = diffDiagnostics(before, after);
    expect(diff.removed).toEqual(['a']);
    expect(diff.added.map((d) => d.id)).toEqual(['c']);
  });

  it('handles empty before / empty after correctly', () => {
    expect(diffDiagnostics([], [make('a')])).toEqual({
      added: [make('a')],
      removed: [],
    });
    expect(diffDiagnostics([make('a')], [])).toEqual({
      added: [],
      removed: ['a'],
    });
    expect(diffDiagnostics([], [])).toEqual({ added: [], removed: [] });
  });
});
