const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../dist-web-deploy');
const portFlag = process.argv.indexOf('--port');
const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : 8081);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port.');
if (!fs.existsSync(path.join(root, 'index.html'))) {
  throw new Error('Web build missing. Run npm run export:web first.');
}
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let file;
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    file = path.resolve(root, '.' + pathname);
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid path');
  } catch { res.writeHead(400); return res.end(); }
  const isFile = candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  if (!isFile(file)) {
    if (isFile(file + '.html')) file += '.html';
    else if (isFile(path.join(file, 'index.html'))) file = path.join(file, 'index.html');
    else if (!path.extname(file)) file = path.join(root, 'index.html');
    else { res.writeHead(404); return res.end(); }
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Serving dist-web-deploy at http://localhost:${port}`));
