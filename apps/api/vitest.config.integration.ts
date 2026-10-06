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
    fileParallelism: false,
    environment: 'node',
    include: ['test/**/*.integration.test.ts', 'test/**/*.e2e.test.ts'],
    globalSetup: ['test/setup/global.setup.ts'],
    setupFiles: ['test/setup/env.setup.ts'],
    testTimeout: 30000,
    execArgv: ['--import', 'tsx/esm'],
  },
});
