import { API_VERSION, type InitResponse, InitResponseSchema } from '@lintscope/api-schema';
import { SCHEMA_VERSION } from '@lintscope/schema';
import type { LintContext } from '../context';

/**
 * Build the payload returned by `GET /init`. Validated against the schema at
 * the boundary so the CLI fails loudly during dev if we drift from
 * @lintscope/api-schema.
 */
export function buildInitPayload(context: LintContext): InitResponse {
  const payload = {
    apiVersion: API_VERSION,
    schemaVersion: SCHEMA_VERSION,
    name: context.name,
    linters: context.report.linters,
    capabilities: {
      // v1: re-scan on demand is always available; file content + watch are
      // wired up below once we ship those endpoints.
      scan: true,
      // Watch endpoint is registered in Phase 2e. Until then advertise false
      // so the studio page doesn't open an EventSource against a 404.
      watch: false,
      file: true,
    },
  };
  return InitResponseSchema.parse(payload);
}
