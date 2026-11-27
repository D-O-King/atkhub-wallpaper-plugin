'use strict';
const path = require('path');
const { fileURLToPath } = require('url');
// Exclude tray, wallpaper windows, webviews, devtools and arbitrary local pages.
function isHostUrl(value, resourcesPath) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'file:' || (url.hostname && url.hostname !== 'localhost')) return false;
    url.hash = ''; url.search = '';
    const file = fileURLToPath(url);
    const rel = path.relative(path.resolve(resourcesPath), file).replace(/\\/g, '/');
    return /^(?:main\/app\.asar\/index\.html|apks\/\d+\/app\.asar\/index\.html|app\.asar\/dist\/index\.html)$/i.test(rel);
  } catch (_) { return false; }
}
module.exports = { isHostUrl };
