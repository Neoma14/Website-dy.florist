import app from './app';

// Handler web-standar untuk Vercel Functions.
// File ini dibundel oleh esbuild menjadi api/index.js (lihat script build:api).
export default {
  fetch: (request: Request) => {
    const url = new URL(request.url);
    const m = /^\/produk\/([\w-]{1,40})\/?$/.exec(url.pathname);
    if (m) return app.fetch(new Request(`${url.origin}/api/share/${m[1]}`, { method: request.method, headers: request.headers }));
    return app.fetch(request);
  },
};
