import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const publishRoot = fileURLToPath(new URL('../dist-frontend/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

export function createFrontendPreview(root = publishRoot) {
  root = resolve(root);
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }
    let file, directoryRequested;
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      directoryRequested = pathname.endsWith('/');
      if (pathname.includes('\0') || pathname.includes('\\')) throw new Error('Invalid path');
      file = resolve(root, '.' + pathname);
      if (file !== root && !file.startsWith(root + sep)) throw new Error('Invalid path');
    } catch {
      res.writeHead(400);
      return res.end('Invalid URL');
    }
    try {
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
      else if (directoryRequested) throw new Error('A file is not a directory');
      const contents = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : contents);
    } catch {
      try {
        const contents = await readFile(resolve(root, '404.html'));
        res.writeHead(404, { 'Content-Type': types['.html'] });
        res.end(req.method === 'HEAD' ? undefined : contents);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Build the frontend first: node scripts/build-frontend.mjs');
      }
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PREVIEW_PORT || 5501);
  createFrontendPreview().listen(port, '127.0.0.1', () => {
    console.log(`Frontend preview: http://127.0.0.1:${port}/`);
  });
}
