import { defineConfig, type Options } from 'tsup';

const SHARED: Options = {
  format: ['esm'],
  dts: true,
  sourcemap: true,
  target: 'es2022',
  external: [
    'react',
    'react-dom',
    '@lintscope/schema',
    'cmdk',
    '@radix-ui/react-dialog',
    '@radix-ui/react-accordion',
    'lucide-react',
    'diff',
    'parse-diff',
  ],
};

export default defineConfig([
  {
    ...SHARED,
    entry: ['src/index.ts'],
    clean: true,
    // Tsup bundles all per-file `'use client'` directives away. The barrel
    // re-exports a mix of client + server components; mark the whole bundle
    // as client so Next's RSC compiler accepts the import. Source files keep
    // their per-file directives, so shadcn-copied components still carry the
    // right directive on a per-file basis in consumer projects.
    banner: { js: '"use client";' },
  },
  {
    ...SHARED,
    entry: { meta: 'src/lib/linter-meta.ts' },
    clean: false,
    // NO client banner: linter-meta is pure data resolution, importable from
    // Server Components via the `@lintscope/ui/meta` subpath.
  },
]);
