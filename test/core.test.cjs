'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { isHostUrl } = require('../src/payload/host.js');
const resource = 'C:\\Program Files\\ATK HUB\\resources';
test('inject only ATK main renderer and numeric hot updates', () => {
  for (const url of ['file:///C:/Program%20Files/ATK%20HUB/resources/main/app.asar/index.html#/home', 'file:///C:/Program%20Files/ATK%20HUB/resources/apks/84/app.asar/index.html']) assert.ok(isHostUrl(url, resource), url);
  for (const url of ['https://evil.test/index.html','file:///C:/Users/test/index.html','file:///C:/Program%20Files/ATK%20HUB/resources/main/app.asar/tray/index.html','file:///C:/Program%20Files/ATK%20HUB/resources/apks/not-a-version/app.asar/index.html','file://server/C:/Program%20Files/ATK%20HUB/resources/main/app.asar/index.html']) assert.ok(!isHostUrl(url, resource), url);
});
function core(t, saved) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'atk-wp-core-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const file = path.resolve(__dirname, '../src/payload/index.js');
  if (saved) { const dir=path.join(temp,'ATK-HUB/atk-wallpaper');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify(saved)); }
  const sandbox = { require: createRequire(file), __dirname: path.dirname(file), console, process: { env: { APPDATA: temp }, platform: process.platform, resourcesPath: resource }, URL, Buffer, global: {}, setTimeout, clearTimeout, setInterval, clearInterval };
  vm.createContext(sandbox); vm.runInContext(fs.readFileSync(file, 'utf8') + '\nthis.api={readRange,resolveSceneAsset,projectFile,scanProjectTree,makeLibrary,registerLibrary,state,handleUplink,serveScheme,backgroundMedia,buildPayload};', sandbox);
  return { ...sandbox.api, temp };
}
async function body(value) { if (Buffer.isBuffer(value)) return value; const chunks = []; for await (const chunk of value) chunks.push(chunk); return Buffer.concat(chunks); }
test('video streaming handles ranges, suffixes and unsatisfiable requests', async t => {
  const c = core(t); const file = path.join(c.temp, 'video.mp4'); fs.writeFileSync(file, '0123456789');
  for (const [range, status, expected] of [['',200,'0123456789'],['bytes=2-5',206,'2345'],['bytes=-3',206,'789'],['bytes=8-999',206,'89'],['bytes=99-',416,'']]) {
    const response = c.readRange(file, range, 'video/mp4'); assert.equal(response.status,status); assert.equal((await body(response.body)).toString(),expected);
  }
});
test('scene resources reject traversal, encoded separators and symlinks outside project', t => {
  const c = core(t); const dir = path.join(c.temp,'scene'); fs.mkdirSync(dir); fs.writeFileSync(path.join(dir,'scene.json'),'{}');
  fs.writeFileSync(path.join(c.temp,'outside.txt'),'outside'); const entry = { kind:'scene',dir };
  assert.equal(c.resolveSceneAsset(entry,'scene.json').status,200);
  for(const file of ['../outside.txt','%2e%2e/outside.txt','%2foutside.txt','a%5cb.txt','scene.json%00']) assert.equal(c.resolveSceneAsset(entry,file).status,403,file);
  assert.equal(c.projectFile(dir,'../outside.txt'),'');
  const link = path.join(dir,'link'); fs.symlinkSync(c.temp,link,'junction');
  assert.equal(c.resolveSceneAsset(entry,'link/outside.txt').status,403);
  assert.equal(c.projectFile(dir,'link/outside.txt'),'');
});
test('control messages from a remote window cannot change wallpaper state', t => {
  const c = core(t); c.state.bgId='keep';c.state.enabled=true;
  c.handleUplink(JSON.stringify({t:'reset'}),{isDestroyed:()=>false,getURL:()=> 'https://evil.test/'});
  assert.equal(c.state.bgId,'keep'); assert.equal(c.state.enabled,true);
});
test('restored quality profile uses the new bounded rendering settings', t => {
  const c=core(t,{scenePerformance:{preset:'quality',fps:45,renderDpr:1.5,videoTexScale:1,pauseWhenHidden:false}});
  assert.equal(c.state.scenePerformance.fps,60);assert.equal(c.state.scenePerformance.renderDpr,1.25);
  assert.equal(c.state.scenePerformance.pauseWhenHidden,false);
});

test('old enabled desktop preferences are ignored and removed on the next save', t => {
  const c = core(t, { desktopSync: { enabled: true, windowsMonitor: 'all', engineMonitor: 'all' }, beautify: { brightness: 143 } });
  assert.equal('desktopSync' in c.state, false);
  const wc = { isDestroyed: () => false, getURL: () => 'file:///C:/Program%20Files/ATK%20HUB/resources/main/app.asar/index.html' };
  for (const action of ['desktopSync', 'desktopSyncNow', 'desktopMonitor', 'desktopMonitorsRefresh']) {
    c.handleUplink(JSON.stringify({ t: action, payload: { enabled: true, backend: 'windows', monitor: 'all' } }), wc);
  }
  assert.equal('desktopSync' in c.state, false);
  c.handleUplink(JSON.stringify({ t: 'reset' }), wc);
  const persisted = JSON.parse(fs.readFileSync(path.join(c.temp, 'ATK-HUB/atk-wallpaper/state.json'), 'utf8'));
  assert.equal('desktopSync' in persisted, false);
  assert.equal(persisted.beautify.brightness, 143);
});
test('web entry and relative assets stream independently from scene packages', async t => {
  const c=core(t);const dir=path.join(c.temp,'web');fs.mkdirSync(path.join(dir,'nested'),{recursive:true});
  const entryFile=path.join(dir,'nested/page.html');fs.writeFileSync(entryFile,'<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body>web</body></html>');
  fs.writeFileSync(path.join(dir,'nested/style.css'),'body{color:red}');
  c.state.byId.set('web:test',{kind:'web',dir,webEntry:entryFile});c.state.bgId='web:test';
  const media=c.backgroundMedia();assert.equal(media.sceneBase,'');assert.match(media.webUrl,/^atk-wallpaper:\/\/web\/project\/web%3Atest\/nested\/page.html$/);
  const page=await c.serveScheme({url:media.webUrl,method:'GET'});assert.equal(page.status,200);
  assert.match((await body(page.body)).toString(),/wallpaperPropertyListener/);
  assert.match(page.headers['Content-Security-Policy'],/sandbox allow-scripts/);
  assert.ok(!page.headers['Content-Security-Policy'].includes('allow-same-origin'));
  const css=await c.serveScheme({url:media.webUrl.replace('page.html','style.css'),method:'GET'});
  assert.equal(css.status,200);assert.equal((await body(css.body)).toString(),'body{color:red}');
});
test('web protocol rejects encoded traversal and non-web project IDs', async t => {
  const c=core(t);const dir=path.join(c.temp,'web');fs.mkdirSync(dir);const entryFile=path.join(dir,'index.html');fs.writeFileSync(entryFile,'<html></html>');
  c.state.byId.set('test',{kind:'web',dir,webEntry:entryFile});c.state.byId.set('scene',{kind:'scene',dir});
  assert.equal((await c.serveScheme({url:'atk-wallpaper://web/project/test/%2e%2e%2foutside.txt',method:'GET'})).status,403);
  assert.equal((await c.serveScheme({url:'atk-wallpaper://web/project/scene/index.html',method:'GET'})).status,404);
});
test('combined web runtime and shell injection produce valid JavaScript', t => {
  const c=core(t);const payload=c.buildPayload();assert.ok(payload);assert.doesNotThrow(()=>new vm.Script(payload.code));
  assert.match(payload.code,/__atkWpWeb/);
});
