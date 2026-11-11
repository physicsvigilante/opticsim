import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const upstream = process.argv.includes('--upstream');
const root = fileURLToPath(new URL(upstream ? '../vendor/ray-optics/dist/' : '../dist/', import.meta.url));
const port = Number(process.env.PORT || (upstream ? 4174 : 4173));
// The production build is entirely relative-path based. This optional prefix
// lets the existing local server exercise the GitHub Pages project subpath
// without introducing a reverse proxy, deployment dependency or remote host.
const basePath = process.env.OPTICSIM_BASE_PATH || '/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)?$/.test(basePath))
  throw Error('OPTICSIM_BASE_PATH must be / or a single /project-name/ prefix');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.md': 'text/plain',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(basePath)) throw Error('Outside configured demo prefix');
    const relativePath = pathname.slice(basePath.length);
    const path = resolve(root, relativePath || 'index.html');
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep) || !(await stat(path)).isFile()) throw Error('Not found');
    response.writeHead(200, { 'Content-Type': (types[extname(path)] || 'text/plain') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(await readFile(path));
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Ray Optics 2D: http://127.0.0.1:${port}${basePath}`));
