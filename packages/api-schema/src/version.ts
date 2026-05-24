/**
 * Version of the studio HTTP API. Embedded in `GET /init` responses so the
 * /studio page can refuse to talk to an incompatible CLI server.
 *
 * Major bump = breaking endpoint / payload shape change. The schemaVersion
 * inside @lintscope/schema is separate — that one versions the LintReport
 * shape on disk; this one versions the live wire shape.
 */
export const API_VERSION = '1' as const;
export type ApiVersion = typeof API_VERSION;
