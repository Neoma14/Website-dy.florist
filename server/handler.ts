import app from './app';

// Handler web-standar untuk Vercel Functions.
// File ini dibundel oleh esbuild menjadi api/index.js (lihat script build:api).
// Vercel meneruskan alamat asli ke fungsi, jadi rewrite di vercel.json dipetakan ke rute API di sini.
export default {
  fetch: (request: Request) => {
    const url = new URL(request.url);
    const forward = (path: string) => app.fetch(new Request(`${url.origin}${path}`, { method: request.method, headers: request.headers }));
    const product = /^\/produk\/([\w-]{1,40})\/?$/.exec(url.pathname);
    if (product) return forward(`/api/share/${product[1]}`);
    // Hanya bot pratinjau link (WhatsApp, Facebook, dll.) yang diarahkan ke sini; tamu biasa langsung ke undangan.html
    const invitation = /^\/undangan\/([a-z0-9-]{1,60})\/?$/i.exec(url.pathname);
    if (invitation) return forward(`/api/invitation-share/${invitation[1]}${url.search}`);
    return app.fetch(request);
  },
};
