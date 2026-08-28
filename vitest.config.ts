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
    },
  },
  test: {
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
    include: [
      'packages/**/*.test.ts',
      'apps/**/*.test.ts',
      'scripts/**/*.test.mjs',
    ],
  },
});
