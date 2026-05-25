import { Command } from 'commander';
import { runInit } from '../commands/init';
import { runScan } from '../commands/scan';
import { runStudio, type StudioHandle, type StudioOptions } from '../commands/studio';

const program = new Command();

program
  .name('lintscope')
  .description('A polished UI for your linter. Data stays on your machine.')
  .version('0.0.0');

program
  .command('init')
  .description('Write a lintscope.config.json with the detected linter')
  .option('-f, --force', 'overwrite an existing config file')
  .action(async (opts: { force?: boolean }) => {
    const result = await runInit({ cwd: process.cwd(), ...(opts.force ? { force: true } : {}) });
    console.log(`✓ ${result.written}`);
    if (result.configHint) console.log(`  ${result.configHint}`);
  });

interface StudioCliOptions {
  hostedUi?: string;
  allowOrigin?: string;
  port?: number;
  open?: boolean;
  watch?: boolean;
}

async function launchStudio(opts: StudioCliOptions): Promise<void> {
  const studioOptions: StudioOptions = {
    cwd: process.cwd(),
    ...(opts.hostedUi ? { hostedUi: opts.hostedUi } : {}),
    ...(opts.allowOrigin ? { allowOrigin: opts.allowOrigin } : {}),
    ...(typeof opts.port === 'number' ? { port: opts.port } : {}),
    ...(opts.open === false ? { open: false } : {}),
    ...(opts.watch === true ? { watch: true } : {}),
  };
  const handle: StudioHandle = await runStudio(studioOptions);
  const watching = handle.watcher !== undefined;

  console.log(`✓ lintscope studio is running${watching ? ' (watch mode)' : ''}`);
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

program
  .command('studio', { isDefault: true })
  .description('Run the linter and open the studio in your browser')
  .option('--hosted-ui <url>', 'override the hosted studio UI URL')
  .option('--allow-origin <url>', 'override the CORS allowlist')
  .option('--port <number>', 'use a specific port instead of a random free one', (v) =>
    Number.parseInt(v, 10),
  )
  .option('--no-open', 'do not open a browser')
  .option('--watch', 'watch files and push updates over SSE')
  .action(launchStudio);

program
  .command('watch')
  .description('Alias for `studio --watch` — re-lint on file change')
  .option('--hosted-ui <url>', 'override the hosted studio UI URL')
  .option('--allow-origin <url>', 'override the CORS allowlist')
  .option('--port <number>', 'use a specific port instead of a random free one', (v) =>
    Number.parseInt(v, 10),
  )
  .option('--no-open', 'do not open a browser')
  .action(async (opts: Omit<StudioCliOptions, 'watch'>) => {
    await launchStudio({ ...opts, watch: true });
  });

program
  .command('scan')
  .description('Run the linter once and emit a LintReport JSON')
  .option('-o, --out <path>', 'write the report to this file instead of stdout')
  .action(async (opts: { out?: string }) => {
    const result = await runScan({ cwd: process.cwd(), ...(opts.out ? { out: opts.out } : {}) });
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
