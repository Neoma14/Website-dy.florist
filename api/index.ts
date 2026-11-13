import app from '../server/app';

// Handler web-standar untuk Vercel Functions
export default {
  fetch: (request: Request) => app.fetch(request),
};
