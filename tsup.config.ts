import { readFileSync } from 'fs';
import { join } from 'path';
import { defineConfig } from 'tsup';

// Read package.json to auto-detect externals (peers + deps + non-@types devDeps).
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

const external = [
  ...Object.keys(packageJson.peerDependencies || {}),
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {}).filter(
    (dep) => !dep.startsWith('@types/') && !['typescript', 'tsup'].includes(dep),
  ),
];

export default defineConfig({
  entry: ['src/index.ts', 'src/nest/index.ts', 'src/typeorm/index.ts', 'src/pg-realtime/index.ts'],
  format: ['cjs', 'esm'],
  dts: false,
  splitting: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  external,
  treeshake: true,
  minify: false,
  target: 'es2023',
});
