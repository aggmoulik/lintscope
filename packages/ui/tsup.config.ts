import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
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
  ],
  // Tsup bundles all per-file `'use client'` directives away. The barrel
  // re-exports a mix of client + server components; mark the whole bundle
  // as client so Next's RSC compiler accepts the import. Source files keep
  // their per-file directives, so shadcn-copied components still carry the
  // right directive on a per-file basis in consumer projects.
  banner: { js: '"use client";' },
});
