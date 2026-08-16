import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react'
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    fakeTimers: {
      // Keep setImmediate/clearImmediate real so fake-indexeddb (which
      // schedules its internal tasks via setImmediate) can always settle,
      // even in tests that use vi.useFakeTimers() for debounce behaviour.
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']
    }
  }
});
