import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const upstream = process.argv.includes('--upstream');
const demo = process.env.OPTICSIM_SERVE_DEMO === '1';
const root = fileURLToPath(new URL(upstream ? '../vendor/ray-optics/dist/' :
  demo ? '../test-artifacts/demo-site/' : '../dist/', import.meta.url));
// Reproduce a project Pages URL such as /opticsim/ in local Chrome without
// introducing any rewrite rules or a new server-side runtime.
const base = process.env.OPTICSIM_BASE_PATH || '/';
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base))
  throw Error('OPTICSIM_BASE_PATH must be / or a slash-delimited safe prefix');
const port = Number(process.env.PORT || (upstream ? 4174 : 4173));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.md': 'text/plain',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (base !== '/' && pathname === base.slice(0,-1)) {
      response.writeHead(308, { Location: base });
      response.end();
      return;
    }
    if (!pathname.startsWith(base)) throw Error('Not found');
    const relative = pathname.slice(base.length) || 'index.html';
    const path = resolve(root, relative);
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep) ||
        !(await stat(path)).isFile()) throw Error('Not found');
    response.writeHead(200, { 'Content-Type': (types[extname(path)] || 'text/plain') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(await readFile(path));
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Ray Optics 2D: http://127.0.0.1:${port}${base}`));
