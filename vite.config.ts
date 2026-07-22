import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          onwarn: () => {}, // Suppress warnings
        }
      },
      esbuild: {
        logOverride: { 'this-is-undefined-in-esm': 'silent' },
        // Production builds ship a silent console — log/info/debug/warn are
        // stripped at build time (console.error stays for real failures,
        // which also flow to the client-error report API).
        ...(mode === 'production' ? { pure: ['console.log', 'console.info', 'console.debug', 'console.warn'] } : {}),
      }
    };
});
