// Local stack for e2e: real api/index.php inside php-wasm + static apps/web/dist.  Needs `npm i @php-wasm/node` in CWD (e.g. /tmp/phpt).
//   cd /tmp/phpt && npm i @php-wasm/node && PORT=8096 node /home/user/dong/tools/qa/php-server.mjs
import { loadNodeRuntime } from '@php-wasm/node';
import { PHP } from '@php-wasm/universal';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.env.DONG_ROOT || '/home/user/dong'; const DIST = ROOT + '/apps/web/dist'; const PORT = Number(process.env.PORT || 8096);
const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));
php.mkdir('/srv'); php.mkdir('/srv/www'); php.mkdir('/srv/www/api'); php.mkdir('/srv/dong-data');
php.writeFile('/srv/www/api/index.php', fs.readFileSync(ROOT + '/api/index.php', 'utf8'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg' };
let q = Promise.resolve();
http.createServer((req, res) => {
  const [p] = req.url.split('?');
  if (p === '/api' || p.startsWith('/api/')) {
    const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
      const body = Buffer.concat(chunks); const headers = {}; for (const [k, v] of Object.entries(req.headers)) headers[k] = String(v);
      q = q.then(async () => {
        const r = await php.run({ scriptPath: '/srv/www/api/index.php', relativeUri: req.url, method: req.method, headers, body: body.length ? new Uint8Array(body) : undefined,
          $_SERVER: { REQUEST_URI: req.url, SCRIPT_NAME: '/api/index.php', DOCUMENT_ROOT: '/srv/www', REQUEST_METHOD: req.method, ...(req.headers.authorization ? { HTTP_AUTHORIZATION: req.headers.authorization } : {}) } });
        const h = {}; for (const [k, v] of Object.entries(r.headers)) h[k] = v; res.writeHead(r.httpStatusCode, h); res.end(Buffer.from(r.bytes));
      }).catch((e) => { res.writeHead(500); res.end(String(e)); });
    }); return;
  }
  let f = path.join(DIST, decodeURIComponent(p)); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = DIST + '/index.html';
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, '0.0.0.0', () => console.log('dong local stack on', PORT));
