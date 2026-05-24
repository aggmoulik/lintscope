import { DiagnosticSchema } from '@lintscope/schema';
import { z } from 'zod';

/**
 * SSE event payload schemas for `GET /events`. Every payload has a `type`
 * discriminator so the client can pattern-match cleanly.
 *
 * The event NAME (sent as `event: <name>\n` in the SSE wire format) matches
 * the `type` field 1:1 — they're the same string by convention.
 */

/* ---------- report.updated ---------- */

/**
 * Sent after a re-lint cycle completes. Tells the client "fetch /report again"
 * without trying to push the full report (which can be MB-scale).
 */
export const ReportUpdatedEventSchema = z.object({
  type: z.literal('report.updated'),
  /** ISO timestamp of the new report. The client can dedupe replays. */
  generatedAt: z.iso.datetime(),
});
export type ReportUpdatedEvent = z.infer<typeof ReportUpdatedEventSchema>;

/* ---------- diagnostics.delta ---------- */

/**
 * Optional optimization for very large reports: rather than re-fetching the
 * full report on every file save, push just the added/removed diagnostic ids
 * (we can also send full Diagnostic objects for `added` because the UI needs
 * the data anyway).
 *
 * v1 servers MAY send this in addition to (or instead of) `report.updated` —
 * clients MUST handle either.
 */
export const DiagnosticsDeltaEventSchema = z.object({
  type: z.literal('diagnostics.delta'),
  /** Full Diagnostic objects for newly-discovered issues. */
  added: z.array(DiagnosticSchema),
  /** Diagnostic ids that no longer exist (file fixed, file deleted, etc.). */
  removed: z.array(z.string().min(1)),
});
export type DiagnosticsDeltaEvent = z.infer<typeof DiagnosticsDeltaEventSchema>;

/* ---------- server.shutdown ---------- */

/**
 * Sent (best-effort) immediately before the server closes. Lets the studio
 * page render the "your CLI exited" recovery UI without waiting for the
 * connection-timeout fallback.
 */
export const ServerShutdownEventSchema = z.object({
  type: z.literal('server.shutdown'),
  reason: z.string().optional(),
});
export type ServerShutdownEvent = z.infer<typeof ServerShutdownEventSchema>;

/* ---------- heartbeat ---------- */

/**
 * Application-level heartbeat. Distinct from the SSE protocol-level
 * `:heartbeat` comment that studio-server emits to keep proxies happy — this
 * one is a structured event the client can inspect (e.g. to detect a stalled
 * watch-mode reconciler).
 */
export const HeartbeatEventSchema = z.object({
  type: z.literal('heartbeat'),
  /** Server uptime in milliseconds. */
  uptimeMs: z.number().int().nonnegative(),
});
export type HeartbeatEvent = z.infer<typeof HeartbeatEventSchema>;

/* ---------- discriminated union ---------- */

export const SseEventSchema = z.discriminatedUnion('type', [
  ReportUpdatedEventSchema,
  DiagnosticsDeltaEventSchema,
  ServerShutdownEventSchema,
  HeartbeatEventSchema,
]);
export type SseEvent = z.infer<typeof SseEventSchema>;

/** Canonical event names — sent as `event: <name>\n` in SSE wire format. */
export const SSE_EVENT_NAMES = {
  reportUpdated: 'report.updated',
  diagnosticsDelta: 'diagnostics.delta',
  serverShutdown: 'server.shutdown',
  heartbeat: 'heartbeat',
} as const;
