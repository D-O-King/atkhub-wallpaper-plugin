'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { pack, readArchive, hash } = require('./helpers.cjs');
const exe = path.resolve(__dirname, '../dist/ATK-HUB-Wallpaper-Plugin.exe');
let harnessDirectory, harness;
before(() => {
  harnessDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'atk-process-harness-'));
  harness = path.join(harnessDirectory, 'ProcessHarness.exe');
  const compiler=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const result=spawnSync(compiler,['/nologo','/target:exe','/platform:x64','/reference:System.Web.Extensions.dll','/out:'+harness,path.resolve(__dirname,'installer-process-harness.cs')],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stdout||result.stderr);
});
after(() => { if(harnessDirectory)fs.rmSync(harnessDirectory,{recursive:true,force:true}); });
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atk-wallpaper-test-'));
  const children=[];
  t.after(async () => { for(const child of children){if(child.exitCode===null)child.kill();await child.exited;} fs.rmSync(dir, { recursive: true, force: true }); });
  fs.mkdirSync(path.join(dir, 'resources')); fs.writeFileSync(path.join(dir, 'ATK HUB.exe'), 'fixture');
  const file = path.join(dir, 'resources/app.asar');
  const entries = {
    'package.json': JSON.stringify({ name: 'ATK-HUB', version: '3.2.33', main: 'dist-electron/main/index.js' }),
    'before.txt': '文件 before\0☀',
    'dist-electron/main/index.js': '"use strict";exports.official = true;\n',
    'after.bin': Buffer.from([0, 1, 255, 3, 65])
  };
  pack(entries, file); return { dir, file, entries, children };
}
async function startHub(f) {
  const target=path.join(f.dir,'ATK HUB.exe');
  if(!f.children.length)fs.copyFileSync(harness,target);
  const child=spawn(target,[],{stdio:'ignore',windowsHide:true});
  child.exited=new Promise(resolve=>child.once('exit',resolve));f.children.push(child);
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  return child;
}
function installWithDecision(f, decision) {
  return spawnSync(harness,[exe,f.dir,decision],{encoding:'utf8',windowsHide:true});
}
function cli(command, dir, ...args) { return spawnSync(exe, [command, dir, ...args], { encoding: 'utf8', windowsHide: true }); }
function ok(result) { assert.equal(result.status, 0, result.stderr || result.stdout); }
test('CLI detection keeps JSON output when launched with redirected standard handles', t => {
  const f = fixture(t);
  const result = cli('--check', f.dir); ok(result);
  const info = JSON.parse(result.stdout.trim());
  assert.equal(info.Version, '3.2.33');
  assert.equal(info.Installed, false);
  assert.equal(info.Bootstrap, false);
});
test('prepare preserves all packed files, unpacked metadata, links and integrity', t => {
  const f = fixture(t); const before = readArchive(f.file); const output = path.join(f.dir, 'prepared.asar');
  ok(cli('--prepare', f.dir, output)); const after = readArchive(output);
  assert.equal(readArchive(f.file).hash, before.hash, 'prepare must not mutate installation');
  for (const [name, item] of Object.entries(after.entries)) {
    assert.equal(item.node.integrity.hash, hash(item.bytes));
    assert.equal(item.node.integrity.blocks[0], hash(item.bytes));
    if (name !== 'dist-electron/main/index.js') assert.deepEqual(item.bytes, before.entries[name].bytes);
  }
  assert.match(after.entries['dist-electron/main/index.js'].bytes.toString(), /ATK-WALLPAPER-BOOTSTRAP-v1/);
  assert.ok(after.entries['dist-electron/main/index.js'].bytes.toString().endsWith(f.entries['dist-electron/main/index.js']));
  assert.deepEqual(after.header.files.unpacked, before.header.files.unpacked);
  assert.deepEqual(after.header.files.linked, before.header.files.linked);
});
test('install, reinstall and uninstall restore exact original bytes', t => {
  const f = fixture(t); const original = fs.readFileSync(f.file);
  ok(cli('--install', f.dir)); const first = readArchive(f.file);
  assert.equal(fs.readFileSync(path.join(f.dir, 'resources/atk-wallpaper/LICENSE'), 'utf8'), fs.readFileSync(path.resolve(__dirname, '../LICENSE'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(f.dir, 'resources/atk-wallpaper/THIRD-PARTY-NOTICES.md'), 'utf8'), fs.readFileSync(path.resolve(__dirname, '../THIRD-PARTY-NOTICES.md'), 'utf8'));
  const obsolete = ['desktop-sync.js', 'desktop-wallpaper.ps1'].map(name => path.join(f.dir, 'resources/atk-wallpaper', name));
  for (const file of obsolete) fs.writeFileSync(file, 'obsolete desktop integration fixture');
  ok(cli('--install', f.dir)); assert.equal(readArchive(f.file).hash, first.hash);
  for (const file of obsolete) assert.equal(fs.existsSync(file), false);
  assert.equal((first.entries['dist-electron/main/index.js'].bytes.toString().match(/ATK-WALLPAPER-BOOTSTRAP-v1/g) || []).length, 1);
  ok(cli('--uninstall', f.dir)); assert.deepEqual(fs.readFileSync(f.file), original);
  assert.ok(!fs.existsSync(path.join(f.dir, 'resources/atk-wallpaper')));
  assert.ok(fs.existsSync(path.join(f.dir, 'resources/atk-wallpaper-backups')));
});
test('official update is preserved on uninstall and can be rebased on reinstall', t => {
  const f = fixture(t); ok(cli('--install', f.dir));
  pack({ ...f.entries, 'after.bin': 'official update' }, f.file); const updated = fs.readFileSync(f.file);
  ok(cli('--uninstall', f.dir)); assert.deepEqual(fs.readFileSync(f.file), updated);
  ok(cli('--install', f.dir)); pack({ ...f.entries, 'after.bin': 'next official update' }, f.file);
  const next = fs.readFileSync(f.file); ok(cli('--install', f.dir)); ok(cli('--uninstall', f.dir));
  assert.deepEqual(fs.readFileSync(f.file), next);
});
test('modified archive and corrupt backup are refused without overwriting files', t => {
  const f = fixture(t); ok(cli('--install', f.dir));
  const installed = fs.readFileSync(f.file); fs.appendFileSync(f.file, 'third party'); const changed = fs.readFileSync(f.file);
  assert.notEqual(cli('--uninstall', f.dir).status, 0); assert.deepEqual(fs.readFileSync(f.file), changed);
  fs.writeFileSync(f.file, installed);
  const manifest = JSON.parse(fs.readFileSync(path.join(f.dir, 'resources/atk-wallpaper-install.json'), 'utf8'));
  fs.appendFileSync(path.join(f.dir, 'resources', manifest.Backup), 'corrupt');
  assert.notEqual(cli('--uninstall', f.dir).status, 0); assert.deepEqual(fs.readFileSync(f.file), installed);
});
test('foreign payload directory and non-ATK archive are refused', t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.dir, 'resources/atk-wallpaper'));
  fs.writeFileSync(path.join(f.dir, 'resources/atk-wallpaper/keep.txt'), 'keep'); const before = fs.readFileSync(f.file);
  assert.notEqual(cli('--install', f.dir).status, 0); assert.deepEqual(fs.readFileSync(f.file), before);
  pack({ ...f.entries, 'package.json': JSON.stringify({ name: 'OTHER', main: 'index.js' }) }, f.file);
  assert.notEqual(cli('--check', f.dir).status, 0);
});
test('running HUB is preserved when CLI has no consent or confirmation is declined', async t => {
  const f=fixture(t);const child=await startHub(f);const original=fs.readFileSync(f.file);
  assert.notEqual(cli('--install',f.dir).status,0);assert.equal(child.exitCode,null);
  const result=installWithDecision(f,'deny');assert.equal(result.status,2,result.stdout||result.stderr);
  assert.equal(JSON.parse(result.stdout).prompts,1);assert.equal(child.exitCode,null);
  assert.deepEqual(fs.readFileSync(f.file),original);assert.ok(!fs.existsSync(path.join(f.dir,'resources/atk-wallpaper')));
});
test('confirmed shutdown closes every target process and preserves another installation', async t => {
  const f=fixture(t),other=fixture(t);
  const one=await startHub(f),two=await startHub(f),unrelated=await startHub(other);
  const result=installWithDecision(f,'allow');ok(result);assert.equal(JSON.parse(result.stdout).prompts,1);
  await Promise.all([one.exited,two.exited]);assert.equal(unrelated.exitCode,null);
  assert.match(readArchive(f.file).entries['dist-electron/main/index.js'].bytes.toString(),/ATK-WALLPAPER-BOOTSTRAP-v1/);
  ok(cli('--uninstall',f.dir));
});
test('another directory running HUB neither prompts nor blocks the selected directory', async t => {
  const f=fixture(t),other=fixture(t);const unrelated=await startHub(other);
  const result=installWithDecision(f,'allow');ok(result);assert.equal(JSON.parse(result.stdout).prompts,0);
  assert.equal(unrelated.exitCode,null);ok(cli('--uninstall',f.dir));
});
