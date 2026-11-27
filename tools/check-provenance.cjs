'use strict';
// Build boundary check, not a substitute for reviewing where source code came from.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const payload = path.join(root, 'src/payload');
assert.notEqual(require('../package.json').private, true);
assert.equal(require('../package.json').license, 'PolyForm-Noncommercial-1.0.0');
const applicationLicense = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
assert.match(applicationLicense, /^# PolyForm Noncommercial License 1\.0\.0\r?\n/);
assert.match(applicationLicense, /## Noncommercial Purposes/);
assert.match(applicationLicense, /^Required Notice: Copyright \(c\) 2026 ATK HUB Wallpaper contributors$/m);
assert.ok(!fs.existsSync(path.join(root, 'tools/import-upstream.cjs')));
assert.ok(!fs.existsSync(path.join(payload, 'assets/moon-wallpaper.jpg')));
assert.ok(!fs.existsSync(path.join(root, 'src/adapter')));
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'vendor') walk(file); }
    else if (/\.(?:js|cjs|cs|ps1)$/.test(file)) {
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /GuXiaoYan|mhub-wallpaper-plugin|mhub-wp|mhub-sp|moon-wallpaper|\.reference[\\/]/i, file);
    }
  }
}
walk(path.join(root, 'src'));
const sha = (name, algorithm = 'sha256') => crypto.createHash(algorithm).update(fs.readFileSync(path.join(payload, name))).digest('hex');
assert.equal(sha('vendor/webwallgl/webwallgl.global.min.js'), 'ee2fbe9a4d15a9ecca837c08a76b90d8c3d98dd2619976929890c9f51de2ff9c');
assert.equal(sha('vendor/mediabunny/source-1.56.0.tgz', 'sha1'), 'ee150e9fc6ccdd8c36d6a82fe603a01a960a5d36');
for (const name of ['webwallgl', 'mediabunny']) assert.ok(fs.statSync(path.join(payload, 'vendor', name, 'LICENSE')).size > 500);
console.log('Release license, build boundary and official third-party checksums verified.');
