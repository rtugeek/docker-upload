import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  outDir: 'bin',
  format: ['esm'],
  banner: {
    js: '#!/usr/bin/env node',
  },
})
