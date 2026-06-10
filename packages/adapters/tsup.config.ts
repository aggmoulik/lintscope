import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/types.ts',
    'src/testing.ts',
    'src/linters/eslint/index.ts',
    'src/linters/biome/index.ts',
    'src/linters/oxc/index.ts',
    'src/linters/stylelint/index.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  external: ['@lintscope/schema', 'vitest'],
});
