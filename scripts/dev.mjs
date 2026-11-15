// Desktop Chrome development: rebuilds dist/ on change and serves it on the same origin
// TizenBrew uses on the TV (http://127.0.0.1:8081). Kick reflects any Origin, so API calls go direct.
// It also runs the serviceFile playlist proxy (src/service/proxy.cjs) on http://127.0.0.1:8093,
// the same port and code as on the TV, so the hls.js player loads the master playlist through it.
//
// Open http://127.0.0.1:8081/ in a 1920x1080 window (DevTools device toolbar).
// Keys: arrows, Enter = OK, Escape or Backspace = Back, r g y b = colour keys, space = PlayPause.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { watch } from './build.mjs';

const proxy = createRequire(import.meta.url)('../src/service/proxy.cjs');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const PORT = Number(process.env.PORT) || 8081;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

await watch();
proxy.start(proxy.PORT).on('listening', () => console.log('Playlist proxy: http://127.0.0.1:' + proxy.PORT + '/ping'));

createServer(async (req, res) => {
  const path = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = normalize(join(dist, path === '/' ? 'index.html' : path));
  if (!file.startsWith(dist)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log('Dev server: http://127.0.0.1:' + PORT + '/');
});
