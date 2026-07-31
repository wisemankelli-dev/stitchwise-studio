const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC = __dirname;
const BACKEND = 'http://localhost:3001';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

// Forward /api/* requests to the backend
function proxyToBackend(req, res) {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: 'localhost:3001' },
  };
  const proxy = http.request(options, (backendRes) => {
    res.writeHead(backendRes.statusCode, backendRes.headers);
    backendRes.pipe(res);
  });
  proxy.on('error', () => {
    res.writeHead(502);
    res.end(JSON.stringify({ error: 'Backend unavailable' }));
  });
  req.pipe(proxy);
}

http.createServer((req, res) => {
  // Proxy all /api requests to backend
  if (req.url.startsWith('/api/')) {
    return proxyToBackend(req, res);
  }

  let filePath = path.join(PUBLIC, req.url === '/' ? 'index.html' : req.url);
  
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback: serve index.html for all non-file routes
      filePath = path.join(PUBLIC, 'index.html');
    }
    
    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Server error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
}).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
