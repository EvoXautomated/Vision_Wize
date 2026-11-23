import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Los e2e resiembran la base: solo se ejecutan contra DATABASE_URL_TEST.
    env: { DATABASE_URL: process.env.DATABASE_URL_TEST ?? '' },
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
