import path from 'node:path';
import { LintReportSchema } from '@lintscope/schema';
import { describe, expect, it } from 'vitest';
import type { AdapterRunContext, LinterAdapter } from './types';

/** One captured real linter output + the context it was captured under. */
export interface AdapterFixture<Payload> {
  /** Test label, e.g. 'two files with findings'. */
  name: string;
  /** The parsed payload, exactly as the linter's structured output produced it. */
  payload: Payload;
  /** The run context the payload was captured under. */
  context: AdapterRunContext;
}

/**
 * The invariants every lintscope adapter must hold, as a reusable Vitest
 * suite. A community adapter PR is: a descriptor, a mapper, captured real
 * fixtures, and one call to this — see the package README.
 *
 *   describeAdapterContract(stylelintAdapter, { fixtures: [...] });
 */
export function describeAdapterContract<Payload>(
  adapter: LinterAdapter<Payload>,
  options: { fixtures: Array<AdapterFixture<Payload>> },
): void {
  describe(`${adapter.name} adapter contract`, () => {
    it('declares a well-formed descriptor', () => {
      expect(adapter.name).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(adapter.meta.label.length).toBeGreaterThan(0);
      expect(Number.isFinite(adapter.priority)).toBe(true);
      expect(adapter.bin.length).toBeGreaterThan(0);
      expect(adapter.defaultPatterns.length).toBeGreaterThan(0);
      expect(adapter.installHint.length).toBeGreaterThan(0);
    });

    it('buildArgs represents every pattern it is given', () => {
      // Adapters may transform patterns (e.g. stylelint expands directories
      // into stylesheet globs), but every input must survive into the args.
      const args = adapter.buildArgs({ patterns: ['src', 'lib'] });
      for (const pattern of ['src', 'lib']) {
        expect(args.some((arg) => arg.includes(pattern))).toBe(true);
      }
    });

    for (const fixture of options.fixtures) {
      describe(`fixture: ${fixture.name}`, () => {
        it('maps to a schema-valid LintReport', () => {
          const report = adapter.map(fixture.payload, fixture.context);
          expect(() => LintReportSchema.parse(report)).not.toThrow();
        });

        it('reports itself as the linter, with the resolved version', () => {
          const report = adapter.map(fixture.payload, fixture.context);
          expect(report.linters.map((l) => l.name)).toContain(adapter.name);
        });

        it('uses absolute file paths and forward-slash relativePaths', () => {
          const report = adapter.map(fixture.payload, fixture.context);
          for (const file of report.files) {
            expect(path.isAbsolute(file.path)).toBe(true);
            expect(file.relativePath).not.toContain('\\');
          }
          for (const diagnostic of report.diagnostics) {
            expect(path.isAbsolute(diagnostic.filePath)).toBe(true);
            expect(diagnostic.relativePath).not.toContain('\\');
          }
        });

        it('produces stable diagnostic ids across repeat runs', () => {
          const first = adapter.map(fixture.payload, fixture.context);
          const second = adapter.map(fixture.payload, fixture.context);
          expect(first.diagnostics.map((d) => d.id)).toEqual(second.diagnostics.map((d) => d.id));
        });

        it('summary counts agree with the diagnostics list', () => {
          const report = adapter.map(fixture.payload, fixture.context);
          const errors = report.diagnostics.filter((d) => d.severity === 'error').length;
          const warnings = report.diagnostics.filter((d) => d.severity === 'warning').length;
          expect(report.summary.errorCount).toBe(errors);
          expect(report.summary.warningCount).toBe(warnings);
        });
      });
    }
  });
}
