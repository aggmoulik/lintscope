import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

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
  // Bake the package version into the bundle so `lintscope --version` always
  // matches the published package (the bin has no reliable runtime path to
  // package.json from both src and dist).
  define: { __CLI_VERSION__: JSON.stringify(pkg.version) },
  banner: { js: '#!/usr/bin/env node' },
});
