'use strict';
// ATK HUB integration. No upstream plugin sources or generated adapters.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Readable } = require('stream');
const { isHostUrl } = require('./host.js');
const { normalizeScenePerformance } = require('./scene-policy.js');
const { json, projectFile, makeLibrary, scanProjectTree, discoverLibraries } = require('./catalog.js');
const { readRange, resolveSceneAsset } = require('./resources.js');
const { webEntryUrl, webEntryResponse } = require('./web-page.js');
const VERSION = '1.0.0';
const SCHEME = 'atk-wallpaper';
const PREFIX = '[atk-wp]';
const dataDir = path.join(process.env.APPDATA || os.homedir(), 'ATK-HUB/atk-wallpaper');
const stateFile = path.join(dataDir, 'state.json');
const saved = json(stateFile) || {};
const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
const defaults = { blur: 0, brightness: 100, saturation: 100, dim: 0, scale: 100, fit: 'cover', posX: 50, posY: 50 };
const state = {
  version: VERSION, items: [], byId: new Map(), libraries: [],
  manualLibraries: Array.isArray(saved.manualLibraries) ? saved.manualLibraries.filter(l => l && typeof l.path === 'string').map(l => ({ ...makeLibrary(l.path), enabled: l.enabled !== false })) : [],
  libraryStates: saved.libraryStates || {}, bgId: String(saved.bgId || ''), enabled: saved.enabled === true,
  favorites: Array.isArray(saved.favorites) ? saved.favorites.filter(v => typeof v === 'string') : [],
  recent: Array.isArray(saved.recent) ? saved.recent.filter(v => typeof v === 'string').slice(0, 30) : [],
  beautify: { ...defaults }, scenePerformance: normalizeScenePerformance(saved.scenePerformance),
  props: saved.props && typeof saved.props === 'object' ? saved.props : {},
  rotation: { enabled: saved.rotation?.enabled === true, scope: saved.rotation?.scope === 'favorites' ? 'favorites' : 'all', intervalMinutes: clamp(saved.rotation?.intervalMinutes, 1, 1440, 30) },
  error: '', hotkeys: { next: '', prev: '', random: '', toggle: '', preview: '', ...saved.hotkeys }, hotkeyErrors: []
};
let electronApi, previewWindow, rotationTimer;
const attached = new Set(), injected = new Map(), runtimeLoads = new Map();
const registeredHotkeys = new Set();
const targets = () => electronApi?.webContents.getAllWebContents().filter(isTarget) || [];
function log(message) {
  try { fs.mkdirSync(dataDir, { recursive: true }); fs.appendFileSync(path.join(dataDir, 'private-plugin.log'), new Date().toISOString() + ' ' + String(message).slice(0, 2000) + '\n'); } catch { /* Read-only profile. */ }
}
function save() {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const { byId, items, libraries, error, ...config } = state;
    fs.writeFileSync(stateFile + '.tmp', JSON.stringify(config, null, 2)); fs.renameSync(stateFile + '.tmp', stateFile);
  } catch (error) { log(error.message); }
}
function updateBeautify(value) {
  if (!value || typeof value !== 'object') return;
  const ranges = { blur: [0, 30], brightness: [20, 200], saturation: [0, 200], dim: [0, 90], scale: [100, 200], posX: [0, 100], posY: [0, 100] };
  for (const [key, limits] of Object.entries(ranges)) if (value[key] !== undefined) state.beautify[key] = clamp(value[key], ...limits, defaults[key]);
  if (['cover', 'contain', 'fill'].includes(value.fit)) state.beautify.fit = value.fit;
}
updateBeautify(saved.beautify);
function registerLibrary(library) {
  if (!state.libraries.some(l => l.id === library.id)) state.libraries.push(library);
  if (!library.enabled) return;
  for (const entry of scanProjectTree(library)) {
    if (state.byId.has(entry.id)) continue;
    state.byId.set(entry.id, entry);
    state.items.push({ id: entry.id, title: entry.title, kind: entry.kind, source: entry.source, libraryId: entry.libraryId,
      tags: entry.tags, props: entry.props, preview: entry.preview ? SCHEME + '://img/preview/' + encodeURIComponent(entry.id) : '' });
  }
}
function scanAll() {
  state.items = []; state.byId.clear(); state.libraries = [];
  for (const library of [...discoverLibraries(), ...state.manualLibraries]) {
    registerLibrary({ ...library, enabled: library.enabled !== false && state.libraryStates[library.id]?.enabled !== false });
  }
  state.error = state.items.length ? '' : '添加壁纸库以选择本地图片、视频或完整壁纸项目。';
}
function backgroundMedia() {
  const entry = state.byId.get(state.bgId);
  if (!entry) return null;
  const base = SCHEME + '://';
  const values = Object.fromEntries((entry.props || []).map(p => [p.key, p.value]));
  Object.assign(values, state.props[state.bgId] || {});
  return { id: state.bgId, kind: entry.kind, preview: entry.preview ? base + 'img/preview/' + encodeURIComponent(state.bgId) : '',
    src: ['image', 'video'].includes(entry.kind) && entry.file ? base + 'media/file/' + encodeURIComponent(state.bgId) : '',
    sceneBase: entry.kind === 'scene' ? base + 'scene/project/' + encodeURIComponent(state.bgId) + '/' : '',
    webUrl: webEntryUrl(entry, state.bgId, SCHEME), props: values, performance: state.scenePerformance };
}
function snapshot() {
  const { byId, manualLibraries, libraryStates, ...publicState } = state;
  return { ...publicState, media: backgroundMedia() };
}
function isTarget(wc) {
  return !!wc && !wc.isDestroyed() && (!wc.getType || wc.getType() === 'window') && isHostUrl(wc.getURL(), process.resourcesPath);
}
function deliver(wc) {
  if (!isTarget(wc)) return;
  const code = 'window.__atkWpReceive && window.__atkWpReceive(' + JSON.stringify(snapshot()) + ')';
  wc.executeJavaScript(code, true).catch(error => log(error.message));
}
function publish() { save(); targets().forEach(deliver); }
function select(id) {
  if (!state.byId.has(id)) return;
  state.bgId = id; state.enabled = true;
  state.recent = [id, ...state.recent.filter(value => value !== id)].slice(0, 30); publish();
}
function next(delta = 1, random = false) {
  const entries = state.items.filter(item => state.rotation.scope !== 'favorites' || state.favorites.includes(item.id));
  if (!entries.length) return;
  const index = entries.findIndex(item => item.id === state.bgId);
  select(entries[random ? Math.floor(Math.random() * entries.length) : (index + delta + entries.length) % entries.length].id);
}
function scheduleRotation() {
  clearInterval(rotationTimer);
  if (state.rotation.enabled) { rotationTimer = setInterval(() => next(), state.rotation.intervalMinutes * 60000); rotationTimer.unref(); }
}
function addLibrary(root) {
  if (typeof root !== 'string' || !root || root.length > 2048) return;
  try {
    const real = fs.realpathSync(root); if (!fs.statSync(real).isDirectory() || real === path.parse(real).root) return;
    const library = makeLibrary(real);
    if (!state.manualLibraries.some(item => item.id === library.id)) state.manualLibraries.push(library);
    scanAll(); publish();
  } catch (error) { state.error = '无法读取目录：' + error.message; publish(); }
}
function registerHotkeys() {
  if (!electronApi) return;
  for (const accelerator of registeredHotkeys) electronApi.globalShortcut.unregister(accelerator);
  registeredHotkeys.clear(); state.hotkeyErrors = [];
  const actions = { next: () => next(), prev: () => next(-1), random: () => next(1, true), toggle: () => { state.enabled = !state.enabled; publish(); }, preview: openPreview };
  for (const [key, callback] of Object.entries(actions)) {
    const accelerator = state.hotkeys[key]; if (!accelerator) continue;
    try { if (!electronApi.globalShortcut.register(accelerator, callback)) state.hotkeyErrors.push(key); else registeredHotkeys.add(accelerator); } catch { state.hotkeyErrors.push(key); }
  }
}
function openPreview() {
  if (previewWindow && !previewWindow.isDestroyed()) { previewWindow.focus(); return; }
  previewWindow = new electronApi.BrowserWindow({ width: 900, height: 650, title: '壁纸位置预览', autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  const wc = previewWindow.webContents;
  wc.on('console-message', (event, level, message) => {
    const text = typeof message === 'string' ? message : event.message;
    if (wc.getURL() !== SCHEME + '://ui/crop-preview' || !text?.startsWith(PREFIX)) return;
    if (event.frame && event.frame !== wc.mainFrame) return;
    try { const msg = JSON.parse(text.slice(PREFIX.length)); if (msg.t === 'beautify') { updateBeautify(msg.payload); publish(); } } catch { /* Invalid message. */ }
  });
  previewWindow.loadURL(SCHEME + '://ui/crop-preview');
}
function handleUplink(raw, wc) {
  if (!isTarget(wc)) return;
  let message; try { message = JSON.parse(raw); } catch { return; }
  const p = message?.payload || {};
  switch (message?.t) {
    case 'ready': case 'list': deliver(wc); break;
    case 'set': select(p.id); break;
    case 'reset': state.enabled = false; state.bgId = ''; publish(); break;
    case 'next': next(p.direction === -1 ? -1 : 1, !!p.random); break;
    case 'favorite': {
      if (!state.byId.has(p.id)) return;
      state.favorites = state.favorites.includes(p.id) ? state.favorites.filter(id => id !== p.id) : [...state.favorites, p.id]; publish(); break;
    }
    case 'scenePerformance': state.scenePerformance = normalizeScenePerformance(p); publish(); break;
    case 'beautify': updateBeautify(p); publish(); break;
    case 'rotation':
      state.rotation = { enabled: !!p.enabled, scope: p.scope === 'favorites' ? 'favorites' : 'all', intervalMinutes: clamp(p.intervalMinutes, 1, 1440, 30) };
      scheduleRotation(); publish(); break;
    case 'props': {
      const entry = state.byId.get(p.id); if (!entry || !p.values || typeof p.values !== 'object') return;
      const values = { ...(state.props[p.id] || {}) };
      for (const spec of entry.props || []) {
        const value = p.values[spec.key]; if (value === undefined) continue;
        if (spec.type === 'slider') values[spec.key] = clamp(value, Number(spec.min) || 0, Number(spec.max) || 100, spec.value);
        else if (spec.type === 'bool') values[spec.key] = !!value;
        else if (spec.type === 'combo') { if ((spec.options || []).some(o => o.value === value)) values[spec.key] = value; }
        else if (typeof value === 'string' && value.length <= 2048) values[spec.key] = value;
      }
      state.props[p.id] = values; publish(); break;
    }
    case 'refresh': scanAll(); publish(); break;
    case 'libraryAdd': addLibrary(p.path); break;
    case 'libraryChoose':
      electronApi.dialog.showOpenDialog({ title: '选择本地壁纸或项目目录', properties: ['openDirectory'] }).then(result => { if (!result.canceled) addLibrary(result.filePaths[0]); }); break;
    case 'libraryUpdate':
      if (p.remove) state.manualLibraries = state.manualLibraries.filter(l => l.id !== p.id);
      else state.libraryStates[p.id] = { enabled: p.enabled !== false };
      scanAll(); publish(); break;
    case 'hotkeys':
      for (const key of Object.keys(state.hotkeys)) if (typeof p[key] === 'string') state.hotkeys[key] = p[key].slice(0, 100);
      registerHotkeys(); publish(); break;
    case 'preview': if (p.open) openPreview(); else previewWindow?.close(); break;
    case 'sceneRuntimeNeeded':
      if (p.id === state.bgId && state.byId.get(p.id)?.kind === 'scene') loadSceneRuntime(wc); break;
    case 'error': log(JSON.stringify(message)); break;
  }
}
async function serveScheme(request) {
  const empty = status => ({ status, headers: { 'Access-Control-Allow-Origin': '*' }, body: Buffer.alloc(0) });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method || 'GET')) return empty(405);
  if (request.method === 'OPTIONS') return { ...empty(204), headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Range', 'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS' } };
  let url; try { url = new URL(request.url); } catch { return empty(400); }
  if (url.hostname === 'ui' && url.pathname === '/crop-preview') {
    const media = backgroundMedia();
    const src = String(media?.preview || media?.src || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const html = '<!doctype html><meta charset="utf-8"><title>壁纸位置预览</title><style>body{margin:0;background:#151820;color:white;font:14px sans-serif}img{width:100%;height:80vh;object-fit:cover}label{display:inline-block;padding:12px}</style><img src="' + src + '"><label>水平位置<input id="x" type="range" min="0" max="100" value="' + state.beautify.posX + '"></label><label>垂直位置<input id="y" type="range" min="0" max="100" value="' + state.beautify.posY + '"></label><script>function update(){document.querySelector("img").style.objectPosition=x.value+"% "+y.value+"%";console.log("[atk-wp]"+JSON.stringify({t:"beautify",payload:{posX:+x.value,posY:+y.value}}))}x.oninput=y.oninput=update;</script>';
    return { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: Buffer.from(html) };
  }
  const parts = url.pathname.split('/').filter(Boolean);
  let id; try { id = decodeURIComponent(parts[1] || ''); } catch { return empty(403); }
  const entry = state.byId.get(id); if (!entry) return empty(404);
  let file;
  if (url.hostname === 'img' && parts[0] === 'preview' && parts.length === 2) file = projectFile(entry.dir, path.relative(entry.dir, entry.preview || ''));
  else if (url.hostname === 'media' && parts[0] === 'file' && parts.length === 2 && ['video', 'image'].includes(entry.kind)) file = projectFile(entry.dir, path.relative(entry.dir, entry.file || ''));
  else if (['scene', 'web'].includes(url.hostname) && parts[0] === 'project' && entry.kind === url.hostname) {
    const resolved = resolveSceneAsset(entry, parts.slice(2).join('/'));
    if (resolved.status !== 200) return empty(resolved.status);
    file = resolved.file;
    if (entry.kind === 'web' && file === entry.webEntry) {
      const response = webEntryResponse(entry, file);
      if (request.method === 'HEAD') response.body = Buffer.alloc(0);
      return response;
    }
  } else return empty(404);
  if (!file) return empty(404);
  return readRange(file, request.headers?.get?.('range') || request.headers?.Range || request.headers?.range || '', undefined, request.method === 'HEAD');
}
function buildPayload() {
  const code = ['color.js', 'web.js', 'shell.js'].map(file => fs.readFileSync(path.join(__dirname, 'renderer', file), 'utf8')).join('\n;\n');
  return { code, hash: crypto.createHash('sha256').update(code).digest('hex') };
}
function inject(wc) {
  if (!isTarget(wc)) return;
  const payload = buildPayload(); if (injected.get(wc.id) === payload.hash) return;
  injected.set(wc.id, payload.hash);
  wc.executeJavaScript(payload.code, true).then(() => deliver(wc)).catch(error => { injected.delete(wc.id); log(error.stack); });
}
function loadSceneRuntime(wc) {
  if (runtimeLoads.has(wc.id)) return;
  const token = {}; runtimeLoads.set(wc.id, token);
  const code = fs.readFileSync(path.join(__dirname, 'vendor/webwallgl/webwallgl.global.min.js'), 'utf8') + '\n;\n' + fs.readFileSync(path.join(__dirname, 'renderer/scene.js'), 'utf8');
  wc.executeJavaScript(code, true).then(() => { if (isTarget(wc) && runtimeLoads.get(wc.id) === token) deliver(wc); }).catch(error => { runtimeLoads.delete(wc.id); log(error.stack); });
}
function attach(wc) {
  if (!wc || wc.isDestroyed() || (wc.getType && wc.getType() !== 'window')) return;
  if (!attached.has(wc.id)) {
    attached.add(wc.id);
    wc.on('console-message', function (event, level, message) {
      const text = typeof message === 'string' ? message : event.message;
      if (typeof text !== 'string' || !text.startsWith(PREFIX) || text.length > 65536) return;
      if (event.frame && event.frame !== wc.mainFrame) return;
      const source = event.sourceId || arguments[4] || '';
      if (/^atk-wallpaper:\/\/web\//i.test(source)) return;
      try { handleUplink(text.slice(PREFIX.length), wc); } catch (error) { log(error.stack); }
    });
    wc.on('did-finish-load', () => { injected.delete(wc.id); runtimeLoads.delete(wc.id); inject(wc); });
    wc.on('destroyed', () => { attached.delete(wc.id); injected.delete(wc.id); runtimeLoads.delete(wc.id); });
  }
  inject(wc);
}
function boot() {
  try { electronApi = require('electron'); } catch { return; }
  if (!electronApi.app || global.__atkPrivateBooted) return;
  global.__atkPrivateBooted = true;
  if (!electronApi.app.isReady()) electronApi.protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
  electronApi.app.on('web-contents-created', (_event, wc) => attach(wc));
  electronApi.app.whenReady().then(() => {
    electronApi.protocol.handle(SCHEME, async request => {
      try {
        const result = await serveScheme(request);
        const body = request.method === 'HEAD' || result.status === 204 ? null : Buffer.isBuffer(result.body) ? result.body : Readable.toWeb(result.body);
        return new Response(body, { status: result.status, headers: result.headers });
      } catch (error) { log(error.stack); return new Response(null, { status: 500 }); }
    });
    scanAll(); scheduleRotation(); registerHotkeys(); targets().forEach(attach);
    const timer = setInterval(() => targets().forEach(attach), 1500); timer.unref();
    electronApi.app.once('will-quit', () => { clearInterval(timer); clearInterval(rotationTimer); for (const key of registeredHotkeys) electronApi.globalShortcut.unregister(key); });
  }).catch(error => log(error.stack));
}
boot();
