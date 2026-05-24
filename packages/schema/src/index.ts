export {
  type Diagnostic,
  DiagnosticSchema,
  type Fix,
  FixSchema,
  type KnownLinter,
  KnownLinterSchema,
  type Severity,
  SeveritySchema,
  type Suggestion,
  SuggestionSchema,
} from './diagnostic';
export { diagnosticId } from './id';
export {
  type FileInfo,
  FileInfoSchema,
  type LinterInfo,
  LinterInfoSchema,
  type LintReport,
  LintReportSchema,
  type ReportSummary,
  ReportSummarySchema,
} from './report';
export { SCHEMA_VERSION, type SchemaVersion } from './version';
