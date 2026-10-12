import { defineConfig } from 'vitest/config';

/** Mobile unit tests: pure logic only (src/utils). The web and worker
 *  suites own their own configs and run from their directories in CI. */
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
