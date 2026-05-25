import {
  API_VERSION,
  type Capabilities,
  type InitResponse,
  InitResponseSchema,
} from '@lintscope/api-schema';
import { SCHEMA_VERSION } from '@lintscope/schema';
import type { LintContext } from '../context';

/**
 * Build the payload returned by `GET /init`. Validated against the schema at
 * the boundary so the CLI fails loudly during dev if we drift from
 * @lintscope/api-schema.
 *
 * `capabilities` is supplied by the caller (the `studio` command) — it knows
 * whether watch mode is wired up for this session.
 */
export function buildInitPayload(context: LintContext, capabilities: Capabilities): InitResponse {
  return InitResponseSchema.parse({
    apiVersion: API_VERSION,
    schemaVersion: SCHEMA_VERSION,
    name: context.name,
    linters: context.report.linters,
    capabilities,
  });
}
