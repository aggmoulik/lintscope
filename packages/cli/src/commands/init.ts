import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { detectEslintConfig } from '@lintscope/core';

export interface InitOptions {
  cwd: string;
  force?: boolean;
}

const CONFIG_FILENAME = 'lintscope.config.json';

interface LintscopeConfig {
  linter: 'eslint' | 'biome' | 'oxc';
  patterns?: string[];
}

/**
 * Write a `lintscope.config.json` with the detected linter. Returns metadata
 * the CLI prints to the user. Throws if the file already exists and `force`
 * is not set.
 */
export async function runInit(options: InitOptions): Promise<{
  written: string;
  linter: LintscopeConfig['linter'];
  configHint?: string;
}> {
  const target = path.join(options.cwd, CONFIG_FILENAME);

  if (!options.force) {
    try {
      const { access } = await import('node:fs/promises');
      await access(target);
      throw new Error(`${CONFIG_FILENAME} already exists. Pass --force to overwrite.`);
    } catch (err) {
      // `access` throws if the file doesn't exist — that's the success path.
      if (err instanceof Error && err.message.includes('already exists')) {
        throw err;
      }
    }
  }

  const detected = detectEslintConfig(options.cwd);
  const config: LintscopeConfig = {
    linter: 'eslint',
    patterns: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
  };

  await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return {
    written: target,
    linter: 'eslint',
    configHint: detected
      ? `Detected ${detected.kind === 'flat' ? 'flat' : 'legacy'} ESLint config at ${path.relative(options.cwd, detected.path)}.`
      : `No ESLint config found in ${options.cwd}. Add one (eslint.config.mjs) before running \`lintscope studio\`.`,
  };
}
