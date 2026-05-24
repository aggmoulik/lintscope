import { LinterInfoSchema, LintReportSchema, SCHEMA_VERSION } from '@lintscope/schema';
import { z } from 'zod';
import { API_VERSION } from './version';

/**
 * Canonical list of endpoint paths the CLI server exposes. Both the server
 * (registering handlers) and the client (building fetch URLs) should reference
 * these constants so a typo in one place fails at compile time.
 */
export const HTTP_ENDPOINTS = {
  init: { method: 'GET', path: '/init' },
  report: { method: 'GET', path: '/report' },
  file: { method: 'GET', path: '/file' },
  scan: { method: 'POST', path: '/scan' },
  events: { method: 'GET', path: '/events' },
} as const;

/* ---------- GET /init ---------- */

export const CapabilitiesSchema = z.object({
  /** Server can re-run the linter on demand via `POST /scan`. */
  scan: z.boolean(),
  /** Server pushes SSE events on `GET /events` (watch mode). */
  watch: z.boolean(),
  /** Server serves file source via `GET /file?path=…`. */
  file: z.boolean(),
});
export type Capabilities = z.infer<typeof CapabilitiesSchema>;

export const InitResponseSchema = z.object({
  apiVersion: z.literal(API_VERSION),
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** Human-readable name surfaced by the CLI (e.g. "lintscope"). */
  name: z.string().min(1),
  /** Linters this CLI session is running. */
  linters: z.array(LinterInfoSchema),
  capabilities: CapabilitiesSchema,
});
export type InitResponse = z.infer<typeof InitResponseSchema>;

/* ---------- GET /report ---------- */

/**
 * `GET /report` returns the LintReport unchanged. Re-export the schema so the
 * /studio page imports a single place rather than reaching into @lintscope/schema.
 */
export const ReportResponseSchema = LintReportSchema;
export type ReportResponse = z.infer<typeof ReportResponseSchema>;

/* ---------- GET /file?path=… ---------- */

export const FileQuerySchema = z.object({
  /** Path relative to projectRoot. The server validates via `safePath()`. */
  path: z.string().min(1),
});
export type FileQuery = z.infer<typeof FileQuerySchema>;

export const FileResponseSchema = z.object({
  /** Absolute path that was served. Echoed for client-side cache keys. */
  path: z.string().min(1),
  /** Same path relative to projectRoot, for display. */
  relativePath: z.string().min(1),
  /** UTF-8 file content. Binary files are rejected with 415. */
  content: z.string(),
  /** Size in bytes. */
  size: z.number().int().nonnegative(),
});
export type FileResponse = z.infer<typeof FileResponseSchema>;

/* ---------- POST /scan ---------- */

/**
 * `POST /scan` accepts an empty body (or a future `{ paths: string[] }` to
 * incrementally re-lint specific files). For v1 we accept anything and ignore
 * the body — the schema reserves the shape.
 */
export const ScanRequestSchema = z.object({
  /** Optional subset of files to re-lint. Reserved; not honored in v1. */
  paths: z.array(z.string()).optional(),
});
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

/** `POST /scan` returns the freshly-generated LintReport. */
export const ScanResponseSchema = LintReportSchema;
export type ScanResponse = z.infer<typeof ScanResponseSchema>;

/* ---------- Error responses ---------- */

/**
 * Shape of the JSON body returned for any 4xx/5xx. Always emitted by the
 * studio-server framework when a handler throws; consumers can rely on the
 * `errorId` for log correlation.
 */
export const ErrorResponseSchema = z.object({
  error: z.string().min(1),
  /** Stable id printed to server stderr; lets users grep CLI logs. */
  errorId: z.string().optional(),
  /** Sanitized message safe to render to the user. */
  message: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
