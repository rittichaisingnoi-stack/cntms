// Tiny dev server: serves ./public and proxies /api to the backend.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.FRONTEND_PORT || 3700;
const BACKEND = process.env.BACKEND_URL || 'http://localhost:4700';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

http.createServer((req, res) => {
  if (req.url.startsWith('/api')) {
    const target = new URL(req.url, BACKEND);
    const proxy = http.request(target, { method: req.method, headers: req.headers }, (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    });
    proxy.on('error', () => { res.writeHead(502); res.end('backend unavailable'); });
    req.pipe(proxy);
    return;
  }
  let file = path.join(PUBLIC, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`[cntms] frontend on http://localhost:${PORT} (proxy -> ${BACKEND})`));
