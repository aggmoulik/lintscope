import { z } from 'zod';

export const SeveritySchema = z.enum(['error', 'warning', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

export const KnownLinterSchema = z.enum(['eslint', 'biome', 'oxc', 'tsc', 'stylelint']);
export type KnownLinter = z.infer<typeof KnownLinterSchema>;

const RangeSchema = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]);

export const FixSchema = z.object({
  range: RangeSchema,
  text: z.string(),
  description: z.string().optional(),
});
export type Fix = z.infer<typeof FixSchema>;

export const SuggestionSchema = z.object({
  desc: z.string(),
  fix: z.object({
    range: RangeSchema,
    text: z.string(),
  }),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

export const DiagnosticSchema = z.object({
  id: z.string().min(1),
  filePath: z.string().min(1),
  relativePath: z.string().min(1),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  endLine: z.number().int().positive().optional(),
  endColumn: z.number().int().positive().optional(),
  ruleId: z.string().nullable(),
  severity: SeveritySchema,
  message: z.string(),
  source: z.union([KnownLinterSchema, z.string().min(1)]),
  category: z.string().optional(),
  url: z.url().optional(),
  fix: FixSchema.optional(),
  suggestions: z.array(SuggestionSchema).optional(),
});
export type Diagnostic = z.infer<typeof DiagnosticSchema>;
