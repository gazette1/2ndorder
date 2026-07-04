import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: the app serves at / and /api proxies to the node backend on 8787.
// Build: the app is emitted under /app/ so the production node server can host
// the marketing landing at / and the app at /app from one process.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/app/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
}));
