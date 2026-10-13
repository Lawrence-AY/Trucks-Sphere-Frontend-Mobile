const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Build current source locally. Publishing is a separate deploy:web step.
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist-web-deploy');
const productionApi = process.env.WEB_API_URL || 'https://trucks-sphere-backend.onrender.com';
const result = spawnSync(process.execPath, [
  require.resolve('expo/bin/cli'), 'export', '--platform', 'web',
  '--output-dir', output, '--clear',
], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_API_URL: productionApi, EXPO_NO_TELEMETRY: '1' },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

// EAS serves clean .html URLs; expose nested index pages at their route URL.
function addDirectoryRoutes(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = path.join(directory, entry.name);
    addDirectoryRoutes(child);
    const index = path.join(child, 'index.html');
    if (fs.existsSync(index) && !fs.existsSync(`${child}.html`)) {
      fs.copyFileSync(index, `${child}.html`);
    }
  }
}
addDirectoryRoutes(output);

function verifyDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) verifyDirectory(file);
    else if (entry.name.endsWith('.html')) {
      const html = fs.readFileSync(file, 'utf8');
      for (const match of html.matchAll(/(?:src|href)="(\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
        if (!/\.(js|css|ico|png|ttf|woff2?)$/.test(match[1])) continue;
        if (!fs.existsSync(path.join(output, decodeURI(match[1])))) {
          throw new Error(`Missing asset ${match[1]} in ${file}`);
        }
      }
    }
  }
}
verifyDirectory(output);
console.log('Prepared dist-web-deploy from current source. Nothing has been published.');
console.log(`API: ${productionApi}. HTML asset references verified.`);
