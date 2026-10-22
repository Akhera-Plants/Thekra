import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    // Run only files inside test/ to avoid picking up src unit specs
    include: ['test/**/*.e2e-spec.ts'],
    // Shared Postgres DB — files must not run concurrently
    fileParallelism: false,
    sequence: { concurrent: false },
    // Allow time for NestJS bootstrap + DB queries
    testTimeout: 30000,
    hookTimeout: 30000,
    // Global setup: create thekra_test DB + prisma migrate deploy (runs once)
    globalSetup: ['./test/global-setup-e2e.ts'],
    // Worker setup: load .env.test into process.env before any module imports
    setupFiles: ['./test/setup-e2e.ts'],
  },
});
