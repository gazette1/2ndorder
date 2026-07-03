import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api to the mock backend (node:http on http://localhost:8787) so
// same-origin fetch('/api/...') works in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
