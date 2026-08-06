import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/** Web build for Capacitor (iOS / iPad) — no Electron main process. */
export default defineConfig({
  define: {
    'import.meta.env.VITE_PWA': JSON.stringify('false'),
  },
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'virtual:pwa-register': path.resolve(
        __dirname,
        'src/shims/pwa-register-stub.ts'
      ),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
