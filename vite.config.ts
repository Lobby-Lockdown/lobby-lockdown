import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  root: 'src/renderer',
  base: command === 'build' ? './' : '/',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: true,
    target: 'es2020',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
}));
