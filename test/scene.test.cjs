'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { normalizeScenePerformance } = require('../src/payload/scene-policy.js');
const tick = () => new Promise(resolve => setImmediate(resolve));

function runtime({ pending = false, width = 1440, height = 840 } = {}) {
  const calls = []; let options; let finish; let onResize; let disconnected = false;
  const instance = Object.fromEntries(['setFit','setFps','setRenderDpr','setVideoTexScale','setQuality','setProperties','pause','resume','destroy'].map(name => [name, value => calls.push({ name, value })]));
  const fetch = async url => ({ ok: true, json: async () => ({}), body: { cancel: () => Promise.resolve() } });
  const host = { clientWidth: width, clientHeight: height, style: {}, parentNode: { removeChild() {} } };
  const sandbox = { fetch, console, innerWidth: width, innerHeight: height, ResizeObserver: class {
    constructor(callback) { onResize = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  }, WebWallGL: { httpSource: source => source, mount: (_host, value) => {
    options = value;
    return pending ? new Promise(resolve => { finish = () => resolve(instance); }) : Promise.resolve(instance);
  } } };
  sandbox.window = sandbox; vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../src/payload/renderer/scene.js'), 'utf8'), sandbox);
  const media = { sceneBase: 'atk-wallpaper://scene/project/test/', performance: normalizeScenePerformance({ preset: 'quality' }), props: { speed: 1 } };
  const session = sandbox.__atkWpScene.mount(host, media);
  return { calls, host, media, session, get options() { return options; }, finish: () => finish(), resize: () => onResize(), get disconnected() { return disconnected; } };
}

test('old high-quality settings migrate to 60 FPS while preserving the rendering budget', () => {
  const p = normalizeScenePerformance({ preset:'quality',fps:45,renderDpr:1.5,videoTexScale:1,pauseWhenHidden:false });
  assert.equal(p.fps,60);assert.equal(p.renderDpr,1.25);assert.equal(p.videoTexScale,1);assert.equal(p.pauseWhenHidden,false);
});
test('unchanged scene updates do not relayout, resize or reset adaptive quality', async () => {
  const r = runtime(); await tick();
  assert.ok(r.session.instance);
  for(let i=0;i<100;i++) {
    r.session.setFit('cover');
    r.session.setPerformance({ ...r.media.performance });
    r.session.setProperties({ speed:1 });
    r.session.setPaused(false);
  }
  assert.deepEqual(r.calls,[]);
  r.session.setFit('contain');r.session.setFit('contain');
  r.session.setProperties({ speed:2 });r.session.setProperties({ speed:2 });
  r.session.setPaused(true);r.session.setPaused(true);r.session.setPaused(false);
  assert.deepEqual(r.calls.map(c=>c.name),['setFit','setProperties','pause','resume']);
  r.session.destroy();assert.ok(r.disconnected);
});
test('4K resize stays within the render-target pixel budget and changes DPR once', async () => {
  const r = runtime(); await tick();
  assert.equal(r.options.fps,60);assert.equal(r.options.renderDpr,1.25);
  r.host.clientWidth=3840;r.host.clientHeight=2160;r.resize();r.resize();
  const changes=r.calls.filter(c=>c.name==='setRenderDpr');assert.equal(changes.length,1);
  assert.ok(3840*2160*changes[0].value**2 <= 2560*1440+1);
  assert.equal(r.calls.filter(c=>c.name==='setQuality').length,0);
  r.session.destroy();
});
test('changes during asynchronous scene loading are applied once after mount', async () => {
  const r=runtime({pending:true});await tick();
  r.session.setFit('fill');r.session.setPaused(true);r.session.setProperties({speed:2});
  r.session.setPerformance(normalizeScenePerformance({preset:'saver'}));
  r.finish();await tick();
  assert.equal(r.session.fit,'stretch');
  assert.equal(r.calls.filter(c=>c.name==='setFit').length,1);
  assert.equal(r.calls.filter(c=>c.name==='pause').length,1);
  assert.equal(r.calls.filter(c=>c.name==='setProperties').length,1);
  assert.equal(r.calls.filter(c=>c.name==='setQuality').length,1);
  r.session.destroy();
});
