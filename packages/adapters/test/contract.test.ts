import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BiomeReport, biomeAdapter } from '../src/linters/biome';
import { type EslintLintResult, eslintAdapter } from '../src/linters/eslint';
import { type OxcReport, oxcAdapter } from '../src/linters/oxc';
import { type StylelintResult, stylelintAdapter } from '../src/linters/stylelint';
import { describeAdapterContract } from '../src/testing';

// The built-in adapters run through the same contract harness community
// adapters use — if the harness drifts from what the built-ins do, this is
// where it shows up first.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')) as T;

describeAdapterContract(eslintAdapter, {
  fixtures: [
    {
      name: 'captured eslint --format json run',
      payload: fixture<EslintLintResult[]>('eslint-results.json'),
      context: { cwd: '/repo', binaryPath: 'eslint', version: '9.15.0' },
    },
  ],
});

describeAdapterContract(biomeAdapter, {
  fixtures: [
    {
      name: 'captured biome lint --reporter=json run',
      payload: fixture<BiomeReport>('biome-results.json'),
      context: { cwd: '/repo', binaryPath: 'biome', version: '1.9.4' },
    },
    {
      name: 'captured run with a fixable diagnostic',
      payload: fixture<BiomeReport>('biome-fixable.json'),
      context: { cwd: '/repo', binaryPath: 'biome', version: '1.8.3' },
    },
  ],
});

describeAdapterContract(stylelintAdapter, {
  fixtures: [
    {
      name: 'captured stylelint --formatter json run (16.26.1, paths normalized to /repo)',
      payload: fixture<StylelintResult[]>('stylelint-results.json'),
      context: { cwd: '/repo', binaryPath: 'stylelint', version: '16.26.1' },
    },
    {
      name: 'captured run with a warning-severity rule (16.26.1)',
      payload: fixture<StylelintResult[]>('stylelint-warning.json'),
      context: { cwd: '/repo', binaryPath: 'stylelint', version: '16.26.1' },
    },
  ],
});

describeAdapterContract(oxcAdapter, {
  fixtures: [
    {
      name: 'captured oxlint --format=json run',
      payload: fixture<OxcReport>('oxc-results.json'),
      context: { cwd: '/repo', binaryPath: 'oxlint', version: '0.13.0' },
    },
    {
      name: 'captured oxlint 1.x run (span-nested positions)',
      payload: fixture<OxcReport>('oxc-fixable.json'),
      context: { cwd: '/repo', binaryPath: 'oxlint', version: '1.66.0' },
    },
  ],
});
