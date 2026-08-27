import { defineConfig } from 'vitest/config'

// Minimal Vitest config. We only run pure-TypeScript tests against
// in-memory fixtures (see tests/*.test.ts) — no DOM, no jsdom, no
// module-aliasing. Path resolution matches Vite's defaults so `../data/...`
// imports in src/lib/db.ts stay identical between the two runners.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
