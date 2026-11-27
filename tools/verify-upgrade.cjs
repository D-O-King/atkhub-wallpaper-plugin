'use strict';
// Optional local regression using an existing historical installer, never a real HUB.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { pack, hash } = require('../test/helpers.cjs');
const root = path.resolve(__dirname, '..');
const historical = path.resolve(process.argv[2] || '');
assert.ok(process.argv[2] && fs.statSync(historical).isFile(), 'Provide a historical installer executable');
fs.mkdirSync(path.join(root, '.work'), { recursive: true });
const fixture = fs.mkdtempSync(path.join(root, '.work/upgrade-'));
const resources = path.join(fixture, 'resources'); fs.mkdirSync(resources);
fs.writeFileSync(path.join(fixture, 'ATK HUB.exe'), 'upgrade fixture');
const archive = path.join(resources, 'app.asar');
pack({ 'package.json': JSON.stringify({ name: 'ATK-HUB', version: '3.2.33', main: 'dist-electron/main/index.js' }),
  'dist-electron/main/index.js': '"use strict";exports.official = true;' }, archive);
const originalHash = hash(fs.readFileSync(archive));
function run(executable, operation) {
  const result = spawnSync(executable, [operation, fixture], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
run(historical, '--install');
const installed = path.join(resources, 'atk-wallpaper');
const historicalAsset = path.join(installed, 'assets/moon-wallpaper.jpg');
assert.ok(fs.existsSync(historicalAsset), 'Expected legacy artifact before update');
const current = path.join(root, 'dist/ATK-HUB-Wallpaper-Plugin.exe');
run(current, '--install');
assert.equal(JSON.parse(fs.readFileSync(path.join(resources, 'atk-wallpaper-install.json'), 'utf8')).Version, require('../package.json').version);
assert.ok(!fs.existsSync(historicalAsset), 'Old artwork must not remain in an updated installation');
assert.doesNotMatch(fs.readFileSync(path.join(installed, 'index.js'), 'utf8'), /GuXiaoYan|mhub-wallpaper-plugin/);
assert.equal(fs.readFileSync(path.join(installed, 'LICENSE'), 'utf8'), fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
assert.match(fs.readFileSync(path.join(installed, 'LICENSE'), 'utf8'), /^# PolyForm Noncommercial License 1\.0\.0/);
assert.ok(fs.existsSync(path.join(installed, 'vendor/mediabunny/source-1.56.0.tgz')));
run(current, '--uninstall');
assert.equal(hash(fs.readFileSync(archive)), originalHash);
const result = { historicalInstall: true, noncommercialUpdate: true, historicalAssetsRemoved: true,
  noncommercialLicenseInstalled: true, componentSourceIncluded: true, exactOriginalRestored: true };
fs.writeFileSync(path.join(fixture, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ fixture, checks: result }, null, 2));
