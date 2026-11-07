import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
    // Resolve svelte's browser build under vitest so mount() works in jsdom.
    ...(process.env.VITEST ? { conditions: ['browser'] } : {}),
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (a) =>
          a.names?.some((n) => n.endsWith('.css')) || a.name?.endsWith('.css')
            ? 'index.css'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // FILESTASH_URL points it elsewhere, e.g. at the server from compose.yaml
      '^/(admin/api|api|about)': process.env.FILESTASH_URL ?? 'http://localhost:8334',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
