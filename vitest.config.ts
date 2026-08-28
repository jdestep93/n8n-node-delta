import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@nodedelta/core': fileURLToPath(
        new URL('./packages/core/src/index.ts', import.meta.url),
      ),
      '@nodedelta/n8n-adapter': fileURLToPath(
        new URL('./packages/n8n-adapter/src/index.ts', import.meta.url),
      ),
      '@nodedelta/diff-engine': fileURLToPath(
        new URL('./packages/diff-engine/src/index.ts', import.meta.url),
      ),
      '@nodedelta/diff-ui': fileURLToPath(
        new URL('./packages/diff-ui/src/index.ts', import.meta.url),
      ),
      '@nodedelta/n8n-normalizer': fileURLToPath(
        new URL('./packages/n8n-normalizer/src/index.ts', import.meta.url),
      ),
      '@nodedelta/snapshot-store': fileURLToPath(
        new URL('./packages/snapshot-store/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
    setupFiles: ['./packages/snapshot-store/tests/setup-indexeddb.ts'],
    include: [
      'packages/**/*.test.ts',
      'packages/**/*.test.tsx',
      'apps/**/*.test.ts',
      'apps/**/*.test.tsx',
      'scripts/**/*.test.mjs',
    ],
  },
});
