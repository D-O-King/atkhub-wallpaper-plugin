'use strict';
// Filesystem catalog. Only registered project roots can be exposed by the protocol.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { localizedProperties } = require('./property-labels.js');
const mediaTypes = new Map([
  ['.mp4', 'video'], ['.webm', 'video'], ['.mov', 'video'], ['.m4v', 'video'],
  ['.jpg', 'image'], ['.jpeg', 'image'], ['.png', 'image'], ['.webp', 'image'],
  ['.gif', 'image'], ['.avif', 'image'], ['.bmp', 'image']
]);
function json(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; }
}
function inside(root, file) {
  const relative = path.relative(root, file);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}
function projectFile(root, relative) {
  if (typeof relative !== 'string' || !relative || /[\x00-\x1f:]/.test(relative) || path.isAbsolute(relative)) return '';
  try {
    const base = fs.realpathSync(root), file = fs.realpathSync(path.resolve(base, relative));
    return inside(base, file) && fs.statSync(file).isFile() ? file : '';
  } catch { return ''; }
}
function idFor(prefix, file) {
  const normalized = path.resolve(file);
  return prefix + ':' + crypto.createHash('sha256').update(process.platform === 'win32' ? normalized.toLowerCase() : normalized).digest('hex').slice(0, 24);
}
function makeLibrary(root, source = 'manual', label) {
  const absolute = path.resolve(root);
  return { id: idFor('library', absolute), path: absolute, source, label: label || path.basename(absolute), enabled: true };
}
function scanProjectTree(library) {
  const entries = [], visited = new Set();
  const pending = [{ dir: library.path, depth: 0 }];
  while (pending.length && visited.size < 1500 && entries.length < 3000) {
    const { dir, depth } = pending.shift();
    let real, children;
    try { real = fs.realpathSync(dir); if (visited.has(real)) continue; visited.add(real); children = fs.readdirSync(real, { withFileTypes: true }); } catch { continue; }
    const project = json(path.join(real, 'project.json'));
    if (project && typeof project === 'object') {
      const file = projectFile(real, project.file), preview = projectFile(real, project.preview);
      let kind = String(project.type || '').toLowerCase();
      if (!['scene', 'web', 'video'].includes(kind)) kind = mediaTypes.get(path.extname(file).toLowerCase()) || 'unsupported';
      entries.push({ id: idFor('project', real), dir: real, kind, title: String(project.title || path.basename(real)),
        source: library.source, libraryId: library.id, preview, file, webEntry: kind === 'web' ? file : '',
        props: localizedProperties(project), tags: Array.isArray(project.tags) ? project.tags.map(String) : [] });
      continue;
    }
    for (const child of children) {
      if (child.isDirectory() && !child.name.startsWith('.') && depth < 4) pending.push({ dir: path.join(real, child.name), depth: depth + 1 });
      else if (child.isFile() && mediaTypes.has(path.extname(child.name).toLowerCase())) {
        const file = projectFile(real, child.name);
        if (!file) continue;
        const kind = mediaTypes.get(path.extname(child.name).toLowerCase());
        entries.push({ id: idFor('media', file), dir: real, kind, file, preview: kind === 'image' ? file : '',
          title: path.parse(child.name).name, source: library.source, libraryId: library.id, props: [], tags: [] });
      }
    }
  }
  return entries;
}
function discoverLibraries() {
  const steamRoots = new Set(), results = [];
  for (const base of [process.env['ProgramFiles(x86)'], process.env.ProgramFiles]) if (base) steamRoots.add(path.join(base, 'Steam'));
  for (let drive = 67; drive <= 90; drive++) {
    const root = String.fromCharCode(drive) + ':\\';
    for (const name of ['Steam', 'SteamLibrary', 'steam', 'Program Files (x86)/Steam']) steamRoots.add(path.join(root, name));
  }
  try {
    const output = require('child_process').execFileSync('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { encoding: 'utf8', windowsHide: true, timeout: 2000 });
    const value = output.match(/SteamPath\s+REG_SZ\s+(.+)/i); if (value) steamRoots.add(value[1].trim());
  } catch { /* Steam is optional. */ }
  for (const root of [...steamRoots]) {
    try {
      const vdf = fs.readFileSync(path.join(root, 'steamapps/libraryfolders.vdf'), 'utf8');
      for (const match of vdf.matchAll(/"path"\s*"([^"]+)"/g)) steamRoots.add(match[1].replace(/\\\\/g, '\\'));
    } catch { /* Not a Steam library. */ }
  }
  const seen = new Set();
  function add(dir, label) {
    try {
      const real = fs.realpathSync(dir), key = real.toLowerCase();
      if (!fs.statSync(real).isDirectory() || seen.has(key)) return;
      seen.add(key); results.push(makeLibrary(real, 'steam', label));
    } catch { /* Absent library. */ }
  }
  for (const root of steamRoots) {
    add(path.join(root, 'steamapps/workshop/content/431960'), 'Steam 创意工坊');
    add(path.join(root, 'steamapps/common/wallpaper_engine/projects/myprojects'), '本地壁纸项目');
  }
  return results;
}
module.exports = { json, inside, projectFile, makeLibrary, scanProjectTree, discoverLibraries };
