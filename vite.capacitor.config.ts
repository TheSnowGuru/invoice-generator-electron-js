import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/** Web build for Capacitor (iOS / iPad) — no Electron main process. */
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
