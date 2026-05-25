import { Command } from 'commander';
import { runInit } from '../commands/init';
import { runScan } from '../commands/scan';
import { runStudio } from '../commands/studio';

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

program
  .command('studio', { isDefault: true })
  .description('Run the linter and open the studio in your browser')
  .option('--hosted-ui <url>', 'override the hosted studio UI URL')
  .option('--allow-origin <url>', 'override the CORS allowlist')
  .option('--port <number>', 'use a specific port instead of a random free one', (v) =>
    Number.parseInt(v, 10),
  )
  .option('--no-open', 'do not open a browser')
  .action(
    async (opts: { hostedUi?: string; allowOrigin?: string; port?: number; open?: boolean }) => {
      const studio = await runStudio({
        cwd: process.cwd(),
        ...(opts.hostedUi ? { hostedUi: opts.hostedUi } : {}),
        ...(opts.allowOrigin ? { allowOrigin: opts.allowOrigin } : {}),
        ...(typeof opts.port === 'number' ? { port: opts.port } : {}),
        ...(opts.open === false ? { open: false } : {}),
      });
      console.log(`✓ lintscope studio is running`);
      console.log(`  local: http://localhost:${studio.port}`);
      console.log(`  open : ${studio.url}`);

      const shutdown = async () => {
        console.log('\n→ shutting down…');
        await studio.close();
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    },
  );

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
