import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildStylelintArgs,
  detectStylelintConfig,
  mapStylelintResults,
  type StylelintResult,
} from '../src/linters/stylelint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/stylelint-results.json'), 'utf8'),
) as StylelintResult[];
const WARNING_FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/stylelint-warning.json'), 'utf8'),
) as StylelintResult[];

const ctx = { cwd: '/repo', stylelintVersion: '16.26.1' };

describe('mapStylelintResults', () => {
  it('maps every warning to a diagnostic with source stylelint', () => {
    const report = mapStylelintResults(FIXTURE, ctx);
    expect(report.diagnostics).toHaveLength(3);
    expect(report.diagnostics.every((d) => d.source === 'stylelint')).toBe(true);
  });

  it('maps rule, message, and positions from the warning', () => {
    const report = mapStylelintResults(FIXTURE, ctx);
    const emptyBlock = report.diagnostics.find((d) => d.ruleId === 'block-no-empty');
    expect(emptyBlock?.message).toContain('Unexpected empty block');
    expect(emptyBlock?.line).toBe(1);
    expect(emptyBlock?.column).toBe(3);
    expect(emptyBlock?.endLine).toBe(2);
    expect(emptyBlock?.endColumn).toBe(2);
  });

  it('maps stylelint severities (error stays error, warning stays warning)', () => {
    const report = mapStylelintResults(WARNING_FIXTURE, ctx);
    expect(report.diagnostics.filter((d) => d.severity === 'warning')).toHaveLength(1);
    expect(report.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(1);
  });

  it('computes forward-slash relativePath from cwd', () => {
    const report = mapStylelintResults(FIXTURE, ctx);
    expect(report.diagnostics[0]?.relativePath).toBe('src/broken.css');
  });

  it('includes clean files in the files list with zero counts', () => {
    const report = mapStylelintResults(FIXTURE, ctx);
    const clean = report.files.find((f) => f.relativePath === 'src/clean.css');
    expect(clean).toBeDefined();
    expect(clean?.errorCount).toBe(0);
    expect(clean?.warningCount).toBe(0);
  });

  it('summary counts match the diagnostics', () => {
    const report = mapStylelintResults(FIXTURE, ctx);
    expect(report.summary.errorCount).toBe(3);
    expect(report.summary.warningCount).toBe(0);
    expect(report.summary.fileCount).toBe(2);
    expect(report.summary.ruleFrequency['block-no-empty']).toBe(1);
  });

  it('reports the linter name + version (with configPath when supplied)', () => {
    const report = mapStylelintResults(FIXTURE, {
      ...ctx,
      configPath: '/repo/.stylelintrc.json',
    });
    expect(report.linters).toEqual([
      { name: 'stylelint', version: '16.26.1', configPath: '/repo/.stylelintrc.json' },
    ]);
  });
});

describe('buildStylelintArgs', () => {
  it('passes globs through and uses the json formatter', () => {
    expect(buildStylelintArgs(['src/**/*.css'])).toEqual([
      '--formatter',
      'json',
      '--allow-empty-input',
      'src/**/*.css',
    ]);
  });

  it('expands "." and bare directory patterns into stylesheet globs', () => {
    // stylelint does not lint directories — scope patterns from the monorepo
    // walk-up (e.g. 'apps/web') must become globs.
    expect(buildStylelintArgs(['.'])).toContain('**/*.{css,scss,sass,less}');
    expect(buildStylelintArgs(['apps/web'])).toContain('apps/web/**/*.{css,scss,sass,less}');
  });

  it('leaves explicit file paths untouched', () => {
    expect(buildStylelintArgs(['src/a.css'])).toContain('src/a.css');
  });

  it('forwards an explicit config path', () => {
    expect(buildStylelintArgs(['src/**/*.css'], '/repo/.stylelintrc.json')).toEqual(
      expect.arrayContaining(['--config', '/repo/.stylelintrc.json']),
    );
  });
});

describe('detectStylelintConfig', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'lintscope-detect-stylelint-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when no stylelint config exists', () => {
    expect(detectStylelintConfig(dir)).toBeNull();
  });

  it('detects .stylelintrc.json', () => {
    writeFileSync(path.join(dir, '.stylelintrc.json'), '{}');
    expect(detectStylelintConfig(dir)?.path).toBe(path.join(dir, '.stylelintrc.json'));
  });

  it('detects stylelint.config.js', () => {
    writeFileSync(path.join(dir, 'stylelint.config.js'), 'export default {};');
    expect(detectStylelintConfig(dir)?.path).toBe(path.join(dir, 'stylelint.config.js'));
  });

  it('prefers rc files over stylelint.config.* (cosmiconfig order)', () => {
    writeFileSync(path.join(dir, 'stylelint.config.js'), 'export default {};');
    writeFileSync(path.join(dir, '.stylelintrc.json'), '{}');
    expect(detectStylelintConfig(dir)?.path).toBe(path.join(dir, '.stylelintrc.json'));
  });
});
