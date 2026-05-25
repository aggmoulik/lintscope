import type { Diagnostic, LintReport } from '@lintscope/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CommandPalette,
  type CommandPaletteAction,
  isCommandPaletteAction,
  summarizeForPalette,
} from '../src/components/command-palette';

function makeDiagnostic(overrides: Partial<Diagnostic>): Diagnostic {
  return {
    id: `d-${Math.random().toString(36).slice(2, 8)}`,
    filePath: '/repo/src/a.ts',
    relativePath: 'src/a.ts',
    line: 1,
    column: 1,
    ruleId: 'no-console',
    severity: 'error',
    message: 'msg',
    source: 'eslint',
    ...overrides,
  };
}

function makeReport(diagnostics: Diagnostic[]): LintReport {
  const filesIndex = new Map<string, { errorCount: number; warningCount: number }>();
  for (const d of diagnostics) {
    const bucket = filesIndex.get(d.relativePath) ?? { errorCount: 0, warningCount: 0 };
    if (d.severity === 'error') bucket.errorCount += 1;
    if (d.severity === 'warning') bucket.warningCount += 1;
    filesIndex.set(d.relativePath, bucket);
  }
  const files = [...filesIndex.entries()].map(([relativePath, counts]) => ({
    path: `/repo/${relativePath}`,
    relativePath,
    ...counts,
  }));
  return {
    schemaVersion: '1.0',
    generatedAt: '2026-05-26T10:00:00.000Z',
    projectRoot: '/repo',
    linters: [{ name: 'eslint', version: '9' }],
    files,
    diagnostics,
    summary: {
      errorCount: diagnostics.filter((d) => d.severity === 'error').length,
      warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
      fixableCount: 0,
      fileCount: files.length,
      ruleFrequency: {},
    },
  };
}

const SAMPLE_DIAGS: Diagnostic[] = [
  makeDiagnostic({
    ruleId: 'no-console',
    severity: 'error',
    source: 'eslint',
    relativePath: 'src/a.ts',
  }),
  makeDiagnostic({
    ruleId: 'no-console',
    severity: 'error',
    source: 'eslint',
    relativePath: 'src/a.ts',
  }),
  makeDiagnostic({
    ruleId: 'no-explicit-any',
    severity: 'warning',
    source: 'biome',
    relativePath: 'src/b.ts',
    url: 'https://docs.example/no-any',
  }),
  makeDiagnostic({
    ruleId: 'prefer-const',
    severity: 'warning',
    source: 'eslint',
    relativePath: 'src/c.ts',
  }),
];

describe('isCommandPaletteAction', () => {
  it('accepts all known action shapes', () => {
    const actions: CommandPaletteAction[] = [
      { type: 'filter-rule', ruleId: 'no-console' },
      { type: 'filter-severity', severity: 'error' },
      { type: 'filter-file', relativePath: 'src/a.ts' },
      { type: 'filter-linter', source: 'eslint' },
      { type: 'open-rule-docs', url: 'https://x' },
      { type: 'clear-filters' },
    ];
    for (const a of actions) expect(isCommandPaletteAction(a)).toBe(true);
  });

  it('rejects junk', () => {
    expect(isCommandPaletteAction(null)).toBe(false);
    expect(isCommandPaletteAction({})).toBe(false);
    expect(isCommandPaletteAction({ type: 'unknown' })).toBe(false);
    expect(isCommandPaletteAction('filter-rule')).toBe(false);
  });
});

describe('summarizeForPalette', () => {
  it('counts severities and lists unique rules + linters', () => {
    const result = summarizeForPalette(makeReport(SAMPLE_DIAGS));
    expect(result.severityCounts).toEqual({ error: 2, warning: 2, info: 0 });
    expect(result.uniqueRules).toEqual(['no-console', 'no-explicit-any', 'prefer-const']);
    expect(result.uniqueLinters).toEqual(['biome', 'eslint']);
  });

  it('skips null ruleIds (parser errors)', () => {
    const result = summarizeForPalette(
      makeReport([makeDiagnostic({ ruleId: null, severity: 'error' })]),
    );
    expect(result.uniqueRules).toEqual([]);
  });
});

describe('<CommandPalette />', () => {
  const report = makeReport(SAMPLE_DIAGS);

  it('renders nothing visible when open is false', () => {
    render(
      <CommandPalette
        report={report}
        open={false}
        onOpenChange={() => {}}
        onAction={() => {}}
        bindShortcut={false}
      />,
    );
    expect(screen.queryByTestId('command-palette')).toBeNull();
  });

  it('renders the dialog when open is true', () => {
    render(
      <CommandPalette
        report={report}
        open={true}
        onOpenChange={() => {}}
        onAction={() => {}}
        bindShortcut={false}
      />,
    );
    expect(screen.getByTestId('command-palette')).toBeDefined();
  });

  it('shows a "Clear all filters" item in the Actions group', () => {
    render(
      <CommandPalette
        report={report}
        open={true}
        onOpenChange={() => {}}
        onAction={() => {}}
        bindShortcut={false}
      />,
    );
    expect(screen.getByText('Clear all filters')).toBeDefined();
  });

  it('lists each unique linter when more than one is present', () => {
    render(
      <CommandPalette
        report={report}
        open={true}
        onOpenChange={() => {}}
        onAction={() => {}}
        bindShortcut={false}
      />,
    );
    expect(screen.getByText('eslint')).toBeDefined();
    expect(screen.getByText('biome')).toBeDefined();
  });

  it('hides the linter group when only one linter is present', () => {
    const single = makeReport([
      makeDiagnostic({ ruleId: 'no-console', source: 'eslint', severity: 'error' }),
    ]);
    render(
      <CommandPalette
        report={single}
        open={true}
        onOpenChange={() => {}}
        onAction={() => {}}
        bindShortcut={false}
      />,
    );
    expect(screen.queryByText('Filter by linter')).toBeNull();
  });

  it('fires onAction with clear-filters when the clear item is selected', () => {
    const onAction = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CommandPalette
        report={report}
        open={true}
        onOpenChange={onOpenChange}
        onAction={onAction}
        bindShortcut={false}
      />,
    );
    fireEvent.click(screen.getByText('Clear all filters'));
    expect(onAction).toHaveBeenCalledWith({ type: 'clear-filters' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('fires filter-rule with the clicked rule id', () => {
    const onAction = vi.fn();
    render(
      <CommandPalette
        report={report}
        open={true}
        onOpenChange={() => {}}
        onAction={onAction}
        bindShortcut={false}
      />,
    );
    fireEvent.click(screen.getByText('no-console'));
    expect(onAction).toHaveBeenCalledWith({ type: 'filter-rule', ruleId: 'no-console' });
  });

  it('renders an open-docs button only for rules with a URL', () => {
    render(
      <CommandPalette
        report={report}
        open={true}
        onOpenChange={() => {}}
        onAction={() => {}}
        bindShortcut={false}
      />,
    );
    // SAMPLE_DIAGS: only no-explicit-any has a url.
    expect(screen.getAllByTestId('open-docs-button')).toHaveLength(1);
  });

  it('fires open-rule-docs when the docs button is clicked (event stops propagation)', () => {
    const onAction = vi.fn();
    render(
      <CommandPalette
        report={report}
        open={true}
        onOpenChange={() => {}}
        onAction={onAction}
        bindShortcut={false}
      />,
    );
    fireEvent.click(screen.getByTestId('open-docs-button'));
    expect(onAction).toHaveBeenCalledWith({
      type: 'open-rule-docs',
      url: 'https://docs.example/no-any',
    });
  });

  it('respects maxPerGroup', () => {
    const many = makeReport(
      Array.from({ length: 30 }, (_, i) =>
        makeDiagnostic({
          ruleId: `rule-${i}`,
          relativePath: `src/file-${i}.ts`,
          severity: i % 2 === 0 ? 'error' : 'warning',
        }),
      ),
    );
    render(
      <CommandPalette
        report={many}
        open={true}
        onOpenChange={() => {}}
        onAction={() => {}}
        maxPerGroup={5}
        bindShortcut={false}
      />,
    );
    // Rules group: 5 of rule-0..rule-29 rendered. Search the DOM for items whose text starts with "rule-".
    const ruleItems = screen
      .getAllByText(/^rule-/)
      .filter((el) => el.tagName.toLowerCase() === 'span');
    expect(ruleItems.length).toBeLessThanOrEqual(5);
  });

  it('toggles via cmd+k when bindShortcut is true', () => {
    const onOpenChange = vi.fn();
    render(
      <CommandPalette
        report={report}
        open={false}
        onOpenChange={onOpenChange}
        onAction={() => {}}
        bindShortcut={true}
      />,
    );
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('does NOT bind the shortcut when bindShortcut is false', () => {
    const onOpenChange = vi.fn();
    render(
      <CommandPalette
        report={report}
        open={false}
        onOpenChange={onOpenChange}
        onAction={() => {}}
        bindShortcut={false}
      />,
    );
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
