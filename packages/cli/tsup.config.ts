import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin/lintscope.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'node20',
  external: [
    '@lintscope/api-schema',
    '@lintscope/core',
    '@lintscope/schema',
    '@lintscope/studio-server',
    'chokidar',
    'commander',
  ],
  banner: { js: '#!/usr/bin/env node' },
});
