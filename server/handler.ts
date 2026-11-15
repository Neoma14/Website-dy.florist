import app from './app';

// Pengunjung berupa bot pratinjau link (WhatsApp, Facebook, dll.) dan mesin pencari
const BOT_RE = /WhatsApp|facebookexternalhit|Facebot|meta-externalagent|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|Pinterest|SkypeUriPreview|Line\/|Googlebot|bingbot|Applebot/i;

// Handler web-standar untuk Vercel Functions.
// File ini dibundel oleh esbuild menjadi api/index.js (lihat script build:api).
// Vercel meneruskan alamat asli ke fungsi, jadi rewrite di vercel.json dipetakan ke rute API di sini.
export default {
  fetch: (request: Request) => {
    const url = new URL(request.url);
    const forward = (path: string) => app.fetch(new Request(`${url.origin}${path}`, { method: request.method, headers: request.headers }));
    const product = /^\/produk\/([\w-]{1,40})\/?$/.exec(url.pathname);
    if (product) {
      // Bot pratinjau mendapat halaman Open Graph (foto & harga); manusia langsung dialihkan dengan redirect HTTP biasa
      // (bukan meta refresh) ke detail produk di katalog.
      if (!BOT_RE.test(request.headers.get('user-agent') ?? '')) {
        return new Response(null, {
          status: 302,
          headers: { location: `/katalog?produk=${encodeURIComponent(product[1])}`, 'cache-control': 'no-store' },
        });
      }
      return forward(`/api/share/${product[1]}`);
    }
    // Hanya bot pratinjau link (WhatsApp, Facebook, dll.) yang diarahkan ke sini; tamu biasa langsung ke undangan.html
    const invitation = /^\/undangan\/([a-z0-9-]{1,60})\/?$/i.exec(url.pathname);
    if (invitation) return forward(`/api/invitation-share/${invitation[1]}${url.search}`);
    return app.fetch(request);
  },
};
