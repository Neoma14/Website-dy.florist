import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// /undangan/<slug> dilayani oleh halaman undangan.html (di Vercel lewat vercel.json; di lokal lewat plugin ini)
const undanganRoute = () => {
  const rewrite = (req, _res, next) => {
    if (req.url && /^\/undangan\/[^/?]+\/?(\?.*)?$/.test(req.url)) req.url = '/undangan.html' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
    next();
  };
  return {
    name: 'undangan-route',
    configureServer(server) { server.middlewares.use(rewrite); },
    configurePreviewServer(server) { server.middlewares.use(rewrite); },
  };
};

// Saat `npm run dev`, request /api diteruskan ke server API lokal (npm run dev:api)
export default defineConfig({
  plugins: [undanganRoute()],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        undangan: resolve(import.meta.dirname, 'undangan.html'),
      },
    },
  },
});
