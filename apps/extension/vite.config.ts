import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const extensionRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: resolve(extensionRoot, 'src'),
  publicDir: resolve(extensionRoot, 'public'),
  plugins: [react()],
  build: {
    emptyOutDir: true,
    outDir: resolve(extensionRoot, '../../dist/chrome'),
    rollupOptions: {
      input: {
        background: resolve(extensionRoot, 'src/background/index.ts'),
        content: resolve(extensionRoot, 'src/content/index.ts'),
        popup: resolve(extensionRoot, 'src/popup/index.html'),
      },
      output: {
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name].js',
      },
    },
  },
});
