import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const extensionRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: resolve(extensionRoot, 'src'),
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [react()],
  build: {
    emptyOutDir: false,
    minify: 'esbuild',
    outDir: resolve(extensionRoot, '../../dist/chrome'),
    lib: {
      entry: resolve(extensionRoot, 'src/content/index.ts'),
      formats: ['iife'],
      name: 'NodeDeltaContent',
      fileName: () => 'assets/content.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
