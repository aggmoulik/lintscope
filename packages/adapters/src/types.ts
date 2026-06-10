import type { LintReport } from '@lintscope/schema';

/** A linter config file found by an adapter's `detect()`. */
export interface DetectedConfig {
  /** Absolute path to the config file. */
  path: string;
  /** Adapter-specific flavor, e.g. ESLint 'flat' vs 'legacy'. */
  kind?: string;
}

/** Display/branding metadata that travels with the adapter into the UI. */
export interface AdapterMeta {
  /** Brand-cased display name, e.g. 'ESLint', 'Biome', 'OXC'. */
  label: string;
  /** Logo slug on the logo CDN (see packages/ui LinterLogo). Omit for a text fallback. */
  logoSlug?: string;
  /** Linter homepage / docs, linked from the UI. */
  docsUrl?: string;
}

/** Everything the runner learned before calling `map()`. */
export interface AdapterRunContext {
  /** Project root the linter ran in. Mappers compute relative paths from it. */
  cwd: string;
  /** The binary that was actually spawned. */
  binaryPath: string;
  /** Linter version from the project's own install, else 'unknown'. */
  version: string;
  /** Config file passed to the linter, when one was detected/supplied. */
  configPath?: string;
}

/** Options for a single adapter run. */
export interface RunAdapterOptions {
  /** Project root. Used as the spawn cwd and to compute relative paths. */
  cwd: string;
  /** Lint patterns. Defaults to the adapter's `defaultPatterns`. */
  patterns?: string[];
  /** Explicit binary override — wins over local `.bin` and PATH resolution. */
  binary?: string;
  /** Explicit config file. If omitted, the linter auto-detects its own. */
  configPath?: string;
}

/**
 * The adapter contract: a plain object of small pure functions, composed by
 * the shared runner (`runAdapter`). Adding a linter means implementing this —
 * no classes, no inheritance. See the package README for a worked example.
 *
 * `Payload` is the parsed shape of the linter's structured output. ALWAYS
 * consume the linter's JSON output; never regex its human-readable stdout.
 */
export interface LinterAdapter<Payload = unknown> {
  /** Lowercase machine name, e.g. 'eslint'. Unique across the registry. */
  name: string;
  /** UI display metadata. */
  meta: AdapterMeta;
  /**
   * Detection order across adapters: lower runs first. Built-ins use
   * oxc=10 · biome=20 · eslint=30 (fastest/most-specific first).
   */
  priority: number;
  /** The bin command, e.g. 'eslint', 'biome', 'oxlint'. */
  bin: string;
  /** npm package whose installed version is reported, e.g. '@biomejs/biome'. */
  pkgName?: string;
  /** Patterns when the caller passes none, e.g. ['.']. */
  defaultPatterns: string[];
  /** Shown when the binary is missing, e.g. 'pnpm add -D eslint'. */
  installHint: string;
  /**
   * Exit codes that still carry a usable report. Defaults to [0, 1] —
   * most linters exit 1 on findings. Anything else is treated as a crash.
   * (Stylelint exits 2 on findings and reserves 1 for fatal errors.)
   */
  okExitCodes?: number[];
  /**
   * Which stream carries the report. Defaults to 'stdout'. Stylelint 16+
   * prints its report to stderr.
   */
  readFrom?: 'stdout' | 'stderr';
  /** Find this linter's config in `cwd`, or null when the project doesn't use it. */
  detect(cwd: string): DetectedConfig | null;
  /** Build the CLI argv (after the binary) for a run. Pure. */
  buildArgs(options: { patterns: string[]; configPath?: string }): string[];
  /** Parse raw stdout into `Payload`. Defaults to `JSON.parse`. */
  parse?(stdout: string): Payload;
  /**
   * Map the parsed payload to a normalized LintReport. Pure. MUST validate
   * with `LintReportSchema.parse` at the end (fail loudly on shape drift).
   */
  map(payload: Payload, context: AdapterRunContext): LintReport;
}
