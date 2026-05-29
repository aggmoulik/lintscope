import { type ScanResponse, ScanResponseSchema } from '@lintscope/api-schema';
import type { LintContext } from '../context';

/**
 * Re-run the linter and return the fresh report. The context's `rerun` is
 * passed in so tests can mock the lint pass without spawning ESLint.
 *
 * Mutates `context.report` so subsequent `/report` calls return the new data.
 */
export async function handleScanRequest(context: LintContext): Promise<ScanResponse> {
  if (!context.rerun) {
    // /scan should never be registered without a rerun (e.g. in `view` mode);
    // surface a clear server error if a caller mis-wires the endpoint set.
    throw new Error('handleScanRequest requires a LintContext.rerun function');
  }
  const fresh = await context.rerun();
  context.report = fresh;
  return ScanResponseSchema.parse(fresh);
}
