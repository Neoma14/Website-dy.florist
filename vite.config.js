import { defineConfig } from 'vite';

// Saat `npm run dev`, request /api diteruskan ke server API lokal (npm run dev:api)
export default defineConfig({
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});
