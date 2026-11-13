// Server API lokal untuk pengembangan (di Vercel dipakai api/index.ts)
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { app } from '../server/app';

const PORT = Number(process.env.API_PORT ?? 3001);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v);
  }
  headers.set('x-forwarded-for', req.socket.remoteAddress ?? 'unknown');
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const response = await app.fetch(new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    // @ts-expect-error duplex diperlukan Node untuk body stream
    duplex: 'half',
  }));
  const out: Record<string, string | string[]> = {};
  response.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v; });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) out['set-cookie'] = cookies;
  res.writeHead(response.status, out);
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, '127.0.0.1', () => console.log(`API lokal di http://127.0.0.1:${PORT}`));
