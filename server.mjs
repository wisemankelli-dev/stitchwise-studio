import { createServer, request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const PORT = 3000;
const API_PORT = 3001;
const DIST_DIR = '/home/team/shared/repo-check/client-portal/dist';

// SPA fallback: serve index.html for any non-file route
const SPA_ROOT = join(DIST_DIR, 'index.html');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function proxyToApi(req, res) {
  const options = {
    hostname: 'localhost',
    port: API_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${API_PORT}` },
  };
  const proxy = httpRequest(options, (apiRes) => {
    res.writeHead(apiRes.statusCode, apiRes.headers);
    apiRes.pipe(res);
  });
  proxy.on('error', () => {
    res.writeHead(502);
    res.end('502 Bad Gateway');
  });
  req.pipe(proxy);
}

createServer(async (req, res) => {
  try {
    let url = new URL(req.url, `http://localhost:${PORT}`).pathname;

    // Proxy all /api/* routes to the backend
    if (url.startsWith('/api/')) {
      return proxyToApi(req, res);
    }

    if (url === '/') url = '/index.html';
    
    // For /app/* routes, serve from client-portal dist
    const filePath = url.startsWith('/app/') 
      ? join(DIST_DIR, url.slice(5))
      : join(DIST_DIR, url);
    
    const ext = extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    try {
      const data = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    } catch {
      // SPA fallback: serve index.html
      const indexData = await readFile(SPA_ROOT);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(indexData);
    }
  } catch (err) {
    res.writeHead(500);
    res.end('500 Internal Server Error');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Serving on port ${PORT}, proxying /api/* to port ${API_PORT}`);
});
