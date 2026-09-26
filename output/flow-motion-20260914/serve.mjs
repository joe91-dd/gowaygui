import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../game/build/flow-motion');
const port = Number(process.env.PORT || 7465);
if (!existsSync(path.join(root, 'index.html'))) throw new Error('Build web-mobile first.');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); } catch { response.writeHead(400).end(); return; }
  const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!filename.startsWith(`${root}${path.sep}`) || !existsSync(filename) || !statSync(filename).isFile()) { response.writeHead(404).end(); return; }
  response.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');
  const stream = createReadStream(filename);
  stream.on('error', () => { if (!response.headersSent) response.writeHead(503); response.end('Build is updating. Please reload shortly.'); });
  stream.pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`Go Away Turtle: http://127.0.0.1:${port}`));




