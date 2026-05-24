import { z } from 'zod';
import { DiagnosticSchema } from './diagnostic';
import { SCHEMA_VERSION } from './version';

export const LinterInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  configPath: z.string().optional(),
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
