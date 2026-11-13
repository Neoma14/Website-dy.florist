import app from './app';

// Handler web-standar untuk Vercel Functions.
// File ini dibundel oleh esbuild menjadi api/index.js (lihat script build:api).
export default {
  fetch: (request: Request) => app.fetch(request),
};
