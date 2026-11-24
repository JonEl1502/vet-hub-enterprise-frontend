import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Production builds give away as little as possible to someone reading the
 * site in DevTools (John, 2026-11-24 — same hardening as Rekodi web 4bea626;
 * vault: "Web build hardening"):
 *  - NO SECRETS. Anything in this bundle is public. The old `define` that
 *    injected GEMINI_API_KEY into the browser code is gone — nothing in the
 *    frontend used it, and a real key would have shipped to every visitor.
 *  - Hash-only file names: no page or component names (ShopPage-…,
 *    SupplierPosApp-…) telling a reader how the app is built.
 *  - No source maps.
 *  - Debug output stripped: console.log/info/debug/warn/trace, `debugger`,
 *    legal comments. console.error stays — real failures also flow to the
 *    client-error report API.
 */
export default defineConfig(({ command }) => ({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      onwarn: () => {}, // Suppress warnings
      output: {
        entryFileNames: 'assets/c[hash].js',
        chunkFileNames: 'assets/c[hash].js',
        assetFileNames: 'assets/a[hash][extname]',
      },
    },
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    ...(command === 'build'
      ? {
          pure: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.trace'],
          drop: ['debugger' as const],
          legalComments: 'none' as const,
        }
      : {}),
  },
}));
