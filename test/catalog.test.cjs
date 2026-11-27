'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeLibrary, scanProjectTree, projectFile } = require('../src/payload/catalog.js');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atk-private-catalog-'));
  t.after(() => fs.rmSync(dir, { force: true, recursive: true })); return dir;
}
test('catalog reads web project metadata, direct media and stable independent IDs', t => {
  const root = fixture(t), web = path.join(root, 'web'); fs.mkdirSync(web);
  fs.writeFileSync(path.join(root, 'clip.webm'), 'fixture');
  fs.writeFileSync(path.join(web, 'index.html'), '<html></html>');
  fs.writeFileSync(path.join(web, 'preview.png'), 'fixture');
  fs.writeFileSync(path.join(web, 'project.json'), JSON.stringify({ title: 'Native Web', type: 'web', file: 'index.html', preview: 'preview.png', general: { properties: { speed: { type: 'slider', value: 2, min: 1, max: 5 } } } }));
  const library = makeLibrary(root), entries = scanProjectTree(library);
  assert.equal(entries.length, 2);
  const entry = entries.find(e => e.kind === 'web');
  assert.equal(entry.title, 'Native Web'); assert.equal(entry.webEntry, path.join(web, 'index.html'));
  assert.equal(entry.props[0].key, 'speed'); assert.equal(entry.props[0].value, 2);
  assert.deepEqual(scanProjectTree(library).map(e => e.id), entries.map(e => e.id));
});
test('projects cannot select assets outside their registered root', t => {
  const root = fixture(t), child = path.join(root, 'project'); fs.mkdirSync(child);
  fs.writeFileSync(path.join(root, 'outside.html'), 'private');
  fs.writeFileSync(path.join(child, 'project.json'), JSON.stringify({ type: 'web', file: '../outside.html' }));
  const entry = scanProjectTree(makeLibrary(child))[0]; assert.equal(entry.webEntry, '');
  assert.equal(projectFile(child, path.join(root, 'outside.html')), '');
});
test('release excludes the historical runtime and verifies licensing and official dependencies', () => {
  assert.doesNotThrow(() => require('../tools/check-provenance.cjs'));
});
