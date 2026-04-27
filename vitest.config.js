import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['public/**/*.js'],
      exclude: [
        'public/index.js',
        'public/server.js',
        'public/middleware/**',
        'public/*.json',
      ],
    },
  },
});
