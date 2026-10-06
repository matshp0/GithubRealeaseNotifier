import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@test': resolve(__dirname, 'test'),
    },
  },
  test: {
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      'test/**/*.integration.test.ts',
      'test/**/*.e2e.test.ts',
    ],
  },
});
