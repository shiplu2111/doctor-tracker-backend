import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      exclude: ['src/jobs/**', 'src/server.ts', 'src/**/*.types.ts', '**/*.test.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@doctor-tracker/shared': path.resolve(__dirname, './packages/shared/src'),
    },
  },
});
