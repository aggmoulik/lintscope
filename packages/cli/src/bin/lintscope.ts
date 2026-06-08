import { Command, InvalidArgumentError } from 'commander';
import { runExport } from '../commands/export';
import { runInit } from '../commands/init';
import { runStudio, type StudioHandle, type StudioOptions } from '../commands/studio';
import { runView, type ViewHandle, type ViewOptions } from '../commands/view';
import { LINTER_FORMATS, type LinterFormat } from '../load-report';

const program = new Command();

program
  .name('lintscope')
  .description('A polished UI for your linter. Data stays on your machine.')
  .version('0.0.0');

interface ScanCliOptions {
  hostedUi?: string;
  allowOrigin?: string;
  port?: number;
  open?: boolean;
  watch?: boolean;
  /**
   * Shortcut for monorepo development: equivalent to
   * `--hosted-ui http://localhost:3000/studio`. Allow-origin auto-derives.
   */
  dev?: boolean;
}

const DEV_HOSTED_UI = 'http://localhost:3000/studio';

async function launchStudio(
  opts: ScanCliOptions,
  targets: string[],
  label = 'scan',
): Promise<void> {
  // --dev fills in the hosted-ui default if the user hasn't set one explicitly.
  const resolvedHostedUi = opts.hostedUi ?? (opts.dev ? DEV_HOSTED_UI : undefined);

  const studioOptions: StudioOptions = {
    cwd: process.cwd(),
    ...(resolvedHostedUi ? { hostedUi: resolvedHostedUi } : {}),
    ...(opts.allowOrigin ? { allowOrigin: opts.allowOrigin } : {}),
    ...(typeof opts.port === 'number' ? { port: opts.port } : {}),
    ...(opts.open === false ? { open: false } : {}),
    ...(opts.watch === true ? { watch: true } : {}),
    ...(targets.length > 0 ? { targets } : {}),
  };
  const handle: StudioHandle = await runStudio(studioOptions);
  const watching = handle.watcher !== undefined;

  console.log(`✓ lintscope ${label} ready${watching ? ' (watch mode)' : ''}`);
  console.log(`  local: http://localhost:${handle.studio.port}`);
  console.log(`  open : ${handle.studio.url}`);

  const shutdown = async () => {
    console.log('\n→ shutting down…');
    if (handle.watcher) await handle.watcher.close();
    await handle.studio.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const studioFlagDescriptions: Array<[string, string]> = [
  ['--hosted-ui <url>', 'override the hosted studio UI URL'],
  ['--allow-origin <url>', 'override the CORS allowlist'],
  ['--port <number>', 'use a specific port instead of a random free one'],
  ['--no-open', 'do not open a browser'],
  ['--dev', `shortcut for --hosted-ui ${DEV_HOSTED_UI} (lintscope monorepo dev)`],
];

function applyStudioFlags(cmd: Command, includeWatch: boolean): Command {
  for (const [flag, desc] of studioFlagDescriptions) {
    if (flag === '--port <number>') {
      cmd.option(flag, desc, (v) => Number.parseInt(v, 10));
    } else {
      cmd.option(flag, desc);
    }
  }
  if (includeWatch) cmd.option('--watch', 'watch files and push updates over SSE');
  return cmd;
}

// `scan` is the default — lint the project and open the dashboard.
// Optional `[paths...]` scope the file set to a sub-package (the linter config
// is still found by walking up to the repo root).
applyStudioFlags(
  program
    .command('scan [paths...]', { isDefault: true })
    .description('Lint the project (or given paths) and open the dashboard'),
  /* includeWatch */ true,
).action((paths: string[], opts: ScanCliOptions) => launchStudio(opts, paths, 'scan'));

// `studio` is the explicit alias most close to the conceptual name.
applyStudioFlags(
  program
    .command('studio [paths...]')
    .description('Alias for `scan` — lint the project (or given paths) and open the dashboard'),
  /* includeWatch */ true,
).action((paths: string[], opts: ScanCliOptions) => launchStudio(opts, paths, 'studio'));

// `watch` is the shortcut for `scan --watch`.
applyStudioFlags(
  program
    .command('watch [paths...]')
    .description('Lint + watch files (or given paths); pushes updates over SSE'),
  /* includeWatch */ false,
).action((paths: string[], opts: Omit<ScanCliOptions, 'watch'>) =>
  launchStudio({ ...opts, watch: true }, paths, 'watch'),
);

// `view` — render existing linter JSON in the studio; never spawns a linter.
interface ViewCliOptions {
  from: LinterFormat;
  hostedUi?: string;
  allowOrigin?: string;
  port?: number;
  open?: boolean;
  dev?: boolean;
}

function parseLinterFormat(value: string): LinterFormat {
  if ((LINTER_FORMATS as readonly string[]).includes(value)) return value as LinterFormat;
  throw new InvalidArgumentError(`must be one of ${LINTER_FORMATS.join(', ')}`);
}

async function launchView(file: string | undefined, opts: ViewCliOptions): Promise<void> {
  const resolvedHostedUi = opts.hostedUi ?? (opts.dev ? DEV_HOSTED_UI : undefined);

  const viewOptions: ViewOptions = {
    cwd: process.cwd(),
    from: opts.from,
    ...(file ? { file } : {}),
    ...(resolvedHostedUi ? { hostedUi: resolvedHostedUi } : {}),
    ...(opts.allowOrigin ? { allowOrigin: opts.allowOrigin } : {}),
    ...(typeof opts.port === 'number' ? { port: opts.port } : {}),
    ...(opts.open === false ? { open: false } : {}),
  };
  const handle: ViewHandle = await runView(viewOptions);

  console.log(`✓ lintscope view ready (--from ${opts.from}, no linter run)`);
  console.log(`  local: http://localhost:${handle.studio.port}`);
  console.log(`  open : ${handle.studio.url}`);

  const shutdown = async () => {
    console.log('\n→ shutting down…');
    await handle.studio.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

applyStudioFlags(
  program
    .command('view [file]')
    .description('Render an existing linter JSON report in the studio (no linter run)')
    .requiredOption(
      '--from <linter>',
      `input format — one of ${LINTER_FORMATS.join(', ')}`,
      parseLinterFormat,
    ),
  /* includeWatch */ false,
).action((file: string | undefined, opts: ViewCliOptions) => launchView(file, opts));

// `init` writes a config file.
program
  .command('init')
  .description('Write a lintscope.config.json with the detected linter')
  .option('-f, --force', 'overwrite an existing config file')
  .action(async (opts: { force?: boolean }) => {
    const result = await runInit({ cwd: process.cwd(), ...(opts.force ? { force: true } : {}) });
    console.log(`✓ ${result.written}`);
    if (result.configHint) console.log(`  ${result.configHint}`);
  });

// `export` is non-interactive — emit JSON for CI / piping.
program
  .command('export [paths...]')
  .description('Run the linter once and emit a LintReport JSON (no browser, no server)')
  .option('-f, --format <format>', "output format — only 'json' is supported in v1", 'json')
  .option('-o, --out <path>', 'write the report to this file instead of stdout')
  .action(async (paths: string[], opts: { format?: string; out?: string }) => {
    if (opts.format && opts.format !== 'json') {
      throw new Error(`Unsupported --format: ${opts.format}. Only 'json' is supported in v1.`);
    }
    const result = await runExport({
      cwd: process.cwd(),
      ...(opts.out ? { out: opts.out } : {}),
      ...(paths.length > 0 ? { targets: paths } : {}),
    });
    if (result.writtenTo !== 'stdout') {
      console.error(`✓ wrote ${result.writtenTo}`);
      console.error(
        `  ${result.report.summary.errorCount} errors · ${result.report.summary.warningCount} warnings · ${result.report.summary.fileCount} files`,
      );
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`✗ ${message}`);
  process.exit(1);
});
