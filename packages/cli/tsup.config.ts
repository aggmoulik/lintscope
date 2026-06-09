import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin/lintscope.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'node20',
  // Bundle the internal `@lintscope/*` workspace packages (+ zod) into the CLI so
  // `lintscope` is the ONLY package we publish — the rest stay private/internal.
  // Only real npm runtime deps are external.
  external: ['chokidar', 'commander'],
  banner: { js: '#!/usr/bin/env node' },
});
