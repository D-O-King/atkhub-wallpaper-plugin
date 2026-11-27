'use strict';
const fs = require('fs');
const path = require('path');
const { projectFile } = require('./catalog.js');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
function mime(file) { return types[path.extname(file).toLowerCase()] || 'application/octet-stream'; }
function readRange(file, range, contentType = mime(file), head = false) {
  let size;
  try { size = fs.statSync(file).size; } catch { return { status: 404, body: Buffer.alloc(0) }; }
  const headers = { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  let start = 0, end = size - 1, status = 200;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      if (match[1]) { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      else start = Math.max(0, size - Number(match[2]));
      status = 206;
    }
    if (!match || (!match[1] && !match[2]) || start > end || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      return { status: 416, headers: { ...headers, 'Content-Range': 'bytes */' + size }, body: Buffer.alloc(0) };
    }
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = String(Math.max(0, end - start + 1));
  return { status, headers, body: head || !size ? Buffer.alloc(0) : fs.createReadStream(file, { start, end }) };
}
function resolveSceneAsset(entry, encoded) {
  if (!entry || !['scene', 'web'].includes(entry.kind)) return { status: 404 };
  const parts = encoded.split('/');
  try {
    for (let i = 0; i < parts.length; i++) {
      parts[i] = decodeURIComponent(parts[i]);
      if (!parts[i] || parts[i] === '.' || parts[i] === '..' || /[\\/\x00-\x1f:]/.test(parts[i])) return { status: 403 };
    }
  } catch { return { status: 403 }; }
  const relative = parts.join(path.sep), file = projectFile(entry.dir, relative);
  if (!file) {
    // Includes symlinks and nonexistent paths: never reveal anything outside a project.
    return { status: 403 };
  }
  return { status: 200, file };
}
module.exports = { mime, readRange, resolveSceneAsset };
