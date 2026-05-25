import { type ReportResponse, ReportResponseSchema } from '@lintscope/api-schema';
import type { LintContext } from '../context';

/**
 * Build the payload returned by `GET /report`. Validates against the schema
 * to catch any drift between core's LintReport mapping and the wire shape.
 */
export function buildReportPayload(context: LintContext): ReportResponse {
  return ReportResponseSchema.parse(context.report);
}
