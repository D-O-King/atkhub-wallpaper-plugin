'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chineseLabel, localizedProperties } = require('../src/payload/property-labels.js');
test('wallpaper labels use Chinese without changing engine keys, types or option values', () => {
  const properties = {
    animations: { text: 'Animations', type: 'bool', value: true },
    bloom: { text: '💡Bloom', type: 'bool', value: false },
    blurbackground: { text: 'Blur (Background)', type: 'bool', value: false },
    cameramovement: { text: '📺 Camera Movement', type: 'bool', value: true },
    characterssize: { text: 'Characters Size', type: 'combo', value: '0', options: [{ label: 'Big 16:9', value: '0' }, { label: 'Little (Phone)', value: '1' }] },
    opacity: { text: 'Opacity', type: 'slider', value: 1, min: 0, max: 1, step: 0.1 },
    particles: { text: '💨 Particles (Wind)', type: 'bool', value: true },
    particlesleaves: { text: '🍂Particles (Leaves)', type: 'bool', value: true },
    schemecolor: { text: 'ui_browse_properties_scheme_color', type: 'color', value: '0 0 0' }
  };
  const input = { general: { properties } }, original = JSON.stringify(input);
  const result = localizedProperties(input);
  assert.deepEqual(result.map(p => p.text), ['动画', '泛光', '背景模糊', '镜头移动', '角色大小', '不透明度', '风粒子', '落叶粒子', '主题颜色']);
  for (const p of result) { assert.equal(p.type, properties[p.key].type); assert.equal(p.value, properties[p.key].value); }
  const combo = result.find(p => p.type === 'combo');
  assert.deepEqual(combo.options, [{ label: '大尺寸（16:9）', value: '0' }, { label: '小尺寸（手机）', value: '1' }]);
  assert.equal(JSON.stringify(input), original);
});
test('Chinese author text wins, markup stays inert and unrecognized names are preserved', () => {
  assert.equal(chineseLabel('<b>镜头设置<br>Camera Position Settings</b>'), '镜头设置');
  assert.equal(chineseLabel('Original Custom Name'), 'Original Custom Name');
  assert.equal(chineseLabel('Speed'), '速度');
  const result = localizedProperties({ general: { localization: { 'zh-cn': { custom_speed: '移动速度' } }, properties: {
    speed: { type: 'slider', text: 'custom_speed', value: 0.5 },
    choice: { type: 'combo', options: [{ label: 'Off', value: 0 }, { label: 'On', value: 1 }] }
  } } });
  assert.equal(result[0].text, '移动速度');
  assert.deepEqual(result[1].options, [{ label: '关闭', value: 0 }, { label: '开启', value: 1 }]);
});
