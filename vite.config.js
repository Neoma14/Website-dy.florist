import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// /undangan/<slug> dilayani oleh undangan.html, /admin/undangan oleh undangan-admin.html
// (di Vercel lewat vercel.json; di lokal lewat plugin ini)
const pageRoutes = () => {
  const rewrite = (req, _res, next) => {
    const url = req.url || '';
    const query = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    if (/^\/admin\/undangan\/?(\?.*)?$/.test(url)) req.url = '/undangan-admin.html' + query;
    else if (/^\/undangan\/[^/?]+\/?(\?.*)?$/.test(url)) req.url = '/undangan.html' + query;
    next();
  };
  return {
    name: 'page-routes',
    configureServer(server) { server.middlewares.use(rewrite); },
    configurePreviewServer(server) { server.middlewares.use(rewrite); },
  };
};

// Saat `npm run dev`, request /api diteruskan ke server API lokal (npm run dev:api)
export default defineConfig({
  plugins: [pageRoutes()],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        undangan: resolve(import.meta.dirname, 'undangan.html'),
        undanganAdmin: resolve(import.meta.dirname, 'undangan-admin.html'),
      },
    },
  },
});
