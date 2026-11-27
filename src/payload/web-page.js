'use strict';
const fs = require('fs');
const path = require('path');
function webEntryUrl(entry, id, scheme) {
  if (!entry || entry.kind !== 'web' || !entry.webEntry) return '';
  const relative = path.relative(entry.dir, entry.webEntry);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) return '';
  return scheme + '://web/project/' + encodeURIComponent(id) + '/' + relative.split(path.sep).map(encodeURIComponent).join('/');
}
function webEntryResponse(entry, file) {
  if (!entry || entry.kind !== 'web' || file !== entry.webEntry) return null;
  const bridge = fs.readFileSync(path.join(__dirname, 'renderer', 'web-bootstrap.js'), 'utf8');
  const script = '<script>' + bridge.replace(/<\/script/gi, '<\\/script') + '</script>';
  const html = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const body = /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, head => head + script) : script + html;
  return { status: 200, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Content-Security-Policy': "sandbox allow-scripts; default-src atk-wallpaper: data: blob:; script-src atk-wallpaper: 'unsafe-inline' 'unsafe-eval' blob:; style-src atk-wallpaper: 'unsafe-inline'; img-src atk-wallpaper: data: blob:; font-src atk-wallpaper: data:; media-src atk-wallpaper: data: blob:; connect-src atk-wallpaper:; worker-src atk-wallpaper: blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
  }, body: Buffer.from(body) };
}
module.exports = { webEntryUrl, webEntryResponse };
