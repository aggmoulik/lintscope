import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadReport } from '../src/load-report';

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'adapters', 'test', 'fixtures');
const eslintRaw = readFileSync(path.join(FIXTURES_DIR, 'eslint-results.json'), 'utf8');
const biomeRaw = readFileSync(path.join(FIXTURES_DIR, 'biome-results.json'), 'utf8');
const oxcRaw = readFileSync(path.join(FIXTURES_DIR, 'oxc-results.json'), 'utf8');

const CWD = '/repo';

describe('loadReport', () => {
  describe('valid payloads → mapped LintReport', () => {
    it('maps eslint `-f json` output', () => {
      const report = loadReport('eslint', eslintRaw, CWD);
      expect(report.schemaVersion).toBe('1.0');
      expect(report.linters[0]?.name).toBe('eslint');
      expect(report.summary.errorCount).toBe(2);
      expect(report.summary.warningCount).toBe(2);
      expect(report.summary.fileCount).toBe(3);
    });

    it('maps biome `--reporter=json` output', () => {
      const report = loadReport('biome', biomeRaw, CWD);
      expect(report.schemaVersion).toBe('1.0');
      expect(report.linters[0]?.name).toBe('biome');
      expect(report.summary.errorCount).toBe(2);
      expect(report.summary.warningCount).toBe(1);
      expect(report.summary.fileCount).toBe(3);
    });

    it('maps oxlint `--format=json` output', () => {
      const report = loadReport('oxc', oxcRaw, CWD);
      expect(report.schemaVersion).toBe('1.0');
      expect(report.linters[0]?.name).toBe('oxc');
      expect(report.summary.errorCount).toBe(2);
      expect(report.summary.warningCount).toBe(1);
      expect(report.summary.fileCount).toBe(3);
    });

    it('stamps version as "unknown" since view never spawns the linter', () => {
      const report = loadReport('eslint', eslintRaw, CWD);
      expect(report.linters[0]?.version).toBe('unknown');
    });
  });

  describe('error handling', () => {
    it('throws a clear error for invalid JSON, citing the expected CLI command', () => {
      expect(() => loadReport('eslint', '{ not json', CWD)).toThrow(
        /wasn't valid JSON.*eslint -f json/i,
      );
    });

    it('throws a shape-mismatch error when --from disagrees with the payload', () => {
      // eslint fixture is a top-level array; biome expects an object.
      expect(() => loadReport('biome', eslintRaw, CWD)).toThrow(/expected biome.*shape.*--from/i);
    });

    it('throws when the payload is an empty string', () => {
      expect(() => loadReport('eslint', '', CWD)).toThrow(/valid JSON/i);
    });
  });
});
