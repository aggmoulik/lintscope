import { biomeAdapter } from './linters/biome';
import { eslintAdapter } from './linters/eslint';
import { oxcAdapter } from './linters/oxc';
import { stylelintAdapter } from './linters/stylelint';
import { registerAdapter } from './registry';
import type { LinterAdapter } from './types';

export { type PathImpl, relativeDisplayPath, toPosix } from './display-path';
export * from './linters/biome';
export * from './linters/eslint';
export * from './linters/oxc';
export * from './linters/stylelint';
export {
  type AdapterRegistry,
  createRegistry,
  getAdapter,
  listAdapters,
  registerAdapter,
} from './registry';
export {
  type ResolvedLinterBin,
  type ResolveLinterBinDeps,
  type ResolveLinterBinOptions,
  type ResolveLinterVersionDeps,
  resolveLinterBin,
  resolveLinterVersion,
} from './resolve-bin';
export { type RunnerDeps, runAdapter, type SpawnLike } from './runner';
export type {
  AdapterMeta,
  AdapterRunContext,
  DetectedConfig,
  LinterAdapter,
  RunAdapterOptions,
} from './types';

// Seed the default registry with the built-ins, in detection-priority order
// (oxc=10 · biome=20 · eslint=30 · stylelint=40). External adapters join via
// registerAdapter. The cast erases each adapter's concrete Payload — the
// registry stores them payload-agnostically and the runner re-pairs
// parse/map at the call site.
for (const adapter of [oxcAdapter, biomeAdapter, eslintAdapter, stylelintAdapter]) {
  registerAdapter(adapter as LinterAdapter);
}
