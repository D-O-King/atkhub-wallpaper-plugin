'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { normalizeHex, wallpaperToHex, hexToWallpaper } = require('../src/payload/renderer/color.js');

test('wallpaper RGB fractions render as familiar hex colors without changing the source', () => {
  const source = '0.8588235294117647 0.058823529411764705 0.10196078431372549';
  assert.equal(wallpaperToHex(source), '#DB0F1A');
  assert.equal(wallpaperToHex(' 0\t0.5\n1 '), '#0080FF');
  assert.equal(wallpaperToHex('0 0 0'), '#000000');
  assert.equal(wallpaperToHex('1 1 1'), '#FFFFFF');
  assert.equal(wallpaperToHex('#abc'), '#AABBCC');
});

test('hex edits accept shorthand and generate compatible numeric RGB triples', () => {
  assert.equal(normalizeHex(' #abc '), '#AABBCC');
  assert.equal(normalizeHex('00ff80'), '#00FF80');
  assert.equal(hexToWallpaper('#0f8'), '0 1 0.533333');
  assert.equal(hexToWallpaper('#000000'), '0 0 0');
  assert.equal(hexToWallpaper('#ffffff'), '1 1 1');
  for (const color of ['#DB0F1A', '#7F80FE', '#010203', '#000000', '#FFFFFF']) {
    assert.equal(wallpaperToHex(hexToWallpaper(color)), color);
  }
});

test('invalid or incomplete color edits cannot produce saved values', () => {
  for (const value of ['', '#', '#ff', '#12345', '#1234567', '#GGGGGG', 'red', '1 0 0']) {
    assert.equal(normalizeHex(value), null, String(value)); assert.equal(hexToWallpaper(value), null, String(value));
  }
  for (const value of ['', null, 'NaN 0 0', 'Infinity 0 0', '2 0 0', '-0.1 0 0', '0 0', '0 0 0 1', '#zzzzzz']) {
    assert.equal(wallpaperToHex(value), null, String(value));
  }
});

test('browser integration remains available when the host exposes a CommonJS module', () => {
  const sandbox = { window: { document: {} }, module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/payload/renderer/color.js'), 'utf8'), sandbox);
  assert.equal(sandbox.window.__atkWpColors.wallpaperToHex('0 0 1'), '#0000FF');
  assert.equal(sandbox.module.exports.normalizeHex, undefined);
});
