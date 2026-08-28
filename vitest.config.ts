import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/vite-env.d.ts',
        // These need a real browser: WebAssembly, workers, a canvas with a 2D
        // context, and a DOM to wire up. Mocking them would assert that the
        // mocks were called and nothing else. They are verified in the browser
        // instead - the DuckDB round trip and the chart are checked against a
        // real engine before release. Every decision that could be wrong lives
        // in sniff, choose, scale and serialise, which are covered here.
        'src/main.ts',
        'src/chart/render.ts',
        'src/engine/duckdb.ts',
        'src/engine/bundles.ts',
      ],
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
    },
  },
});
