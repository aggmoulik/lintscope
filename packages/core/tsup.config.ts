import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/adapters/eslint.ts', 'src/adapters/biome.ts', 'src/adapters/oxc.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  external: ['eslint', '@lintscope/schema'],
});
