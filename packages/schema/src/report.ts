import { z } from 'zod';
import { DiagnosticSchema } from './diagnostic';
import { SCHEMA_VERSION } from './version';

/**
 * Display metadata for a linter, stamped into the report by the adapter
 * runner so the UI never needs per-linter knowledge. Presentation data in a
 * data artifact — deliberate: it keeps `view <report.json>` and exported
 * reports self-contained.
 *
 * Optional on the wire (additive 1.x field — pre-meta reports still parse).
 * The UI resolves it to a complete object with fallbacks at its boundary.
 */
export const LinterMetaSchema = z.object({
  /** Brand-cased display name, e.g. 'ESLint', 'OXC'. */
  label: z.string().min(1),
  /** Logo slug on the logo CDN. */
  logoSlug: z.string().min(1).optional(),
  /** Linter homepage / docs. */
  docsUrl: z.string().min(1).optional(),
  /** CLI autofix invocation, e.g. 'eslint --fix'. Absent = no autofix. */
  fixCommand: z.string().min(1).optional(),
});
export type LinterMeta = z.infer<typeof LinterMetaSchema>;

export const LinterInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  configPath: z.string().optional(),
  meta: LinterMetaSchema.optional(),
});
export type LinterInfo = z.infer<typeof LinterInfoSchema>;

export const FileInfoSchema = z.object({
  path: z.string().min(1),
  relativePath: z.string().min(1),
  errorCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
});
export type FileInfo = z.infer<typeof FileInfoSchema>;

export const ReportSummarySchema = z.object({
  errorCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  fixableCount: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  ruleFrequency: z.record(z.string(), z.number().int().nonnegative()),
});
export type ReportSummary = z.infer<typeof ReportSummarySchema>;

export const LintReportSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  generatedAt: z.iso.datetime(),
  projectRoot: z.string().min(1),
  linters: z.array(LinterInfoSchema).min(1),
  files: z.array(FileInfoSchema),
  diagnostics: z.array(DiagnosticSchema),
  summary: ReportSummarySchema,
});
export type LintReport = z.infer<typeof LintReportSchema>;
