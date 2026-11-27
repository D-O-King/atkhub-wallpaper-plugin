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

test('Sanguis Codex Russian properties and choices use contextual Chinese without altering values', () => {
  const entries = [
    ['accentcolor', 'Свой цвет', 'color', '0.86 0.06 0.1', '自定义颜色'],
    ['audioreact', 'Реакция на музыку', 'bool', false, '音乐响应'],
    ['customtext', 'Свой текст (фрагменты через | )', 'textinput', '', '自定义文本（使用 | 分隔片段）'],
    ['eco', 'Экономия ресурсов', 'bool', false, '节省资源'],
    ['glitch', 'Глитч-эффекты', 'bool', true, '故障效果'],
    ['language', 'Язык перевода', 'combo', 'ru', '译文语言'],
    ['monitormode', 'Режим монитора', 'combo', 'main', '显示模式'],
    ['panels', 'Боковые панели', 'bool', true, '侧边面板'],
    ['popups', 'Всплывающие окна', 'bool', true, '弹出窗口'],
    ['rain', 'Фоновый поток глифов', 'bool', true, '背景符文流'],
    ['scanlines', 'ЭЛТ-эффекты', 'bool', true, 'CRT 显像管效果'],
    ['scheme', 'Цветовая схема', 'combo', 'red', '配色方案'],
    ['schemecolor', 'ui_browse_properties_scheme_color', 'color', '0 0 0', '主题颜色'],
    ['sigil3d', '3D-сигил в базе', 'bool', false, '数据库 3D 符印'],
    ['sound', 'Звук', 'bool', false, '音效'],
    ['speed', 'Скорость дешифровки', 'slider', 1, '解码速度'],
    ['volume', 'Громкость', 'slider', 0.5, '音量']
  ];
  const properties = Object.fromEntries(entries.map(([key, text, type, value]) => [key, { text, type, value }]));
  properties.speed = { ...properties.speed, min: 0.3, max: 3, step: 0.05 };
  properties.language.options = [{ label: 'Русский', value: 'ru' }, { label: 'English', value: 'en' }];
  properties.monitormode.options = [{ label: 'Основной (манускрипт)', value: 'main' }, { label: 'Второй (стена данных)', value: 'data' }];
  properties.scheme.options = ['red', 'amber', 'green', 'blue', 'custom'].map((value, i) => ({ label: ['Кровавая', 'Янтарная', 'Зелёная', 'Синяя', 'Свой цвет'][i], value }));
  const project = { title: 'Sanguis Codex — Vampire Script Decryption', general: { properties } }, original = JSON.stringify(project);
  const result = localizedProperties(project);
  assert.deepEqual(result.map(p => p.text), entries.map(e => e[4]));
  for (const p of result) {
    assert.equal(p.type, properties[p.key].type); assert.equal(p.value, properties[p.key].value);
    assert.equal(p.min, properties[p.key].min); assert.equal(p.max, properties[p.key].max); assert.equal(p.step, properties[p.key].step);
    if (p.options) assert.deepEqual(p.options.map(o => o.value), properties[p.key].options.map(o => o.value));
  }
  assert.deepEqual(result.find(p => p.key === 'language').options.map(o => o.label), ['俄语', '英语']);
  assert.deepEqual(result.find(p => p.key === 'monitormode').options.map(o => o.label), ['手稿模式（主屏）', '数据墙模式（副屏）']);
  assert.deepEqual(result.find(p => p.key === 'scheme').options.map(o => o.label), ['血红色', '琥珀色', '绿色', '蓝色', '自定义颜色']);
  assert.equal(JSON.stringify(project), original);
});

test('Sanguis translation keeps author Chinese and does not affect unrelated wallpapers', () => {
  const properties = {
    rain: { text: 'Rain', type: 'bool', value: true },
    scheme: { text: '配色主题\nColor Scheme', type: 'combo', value: 'red', options: [{ label: '作者红色', value: 'red' }, { label: 'Unknown', value: 'other' }] },
    speed: { text: 'custom_speed', type: 'slider', value: 1 }
  };
  const localized = localizedProperties({ title: 'Sanguis Codex - Vampire Script', general: { localization: { 'zh-cn': { custom_speed: '作者解码速度' } }, properties } });
  assert.equal(localized[0].text, '背景符文流'); assert.equal(localized[1].text, '配色主题');
  assert.deepEqual(localized[1].options, [{ label: '作者红色', value: 'red' }, { label: 'Unknown', value: 'other' }]);
  assert.equal(localized[2].text, '作者解码速度');
  const unrelated = localizedProperties({ title: 'Other wallpaper', general: { properties } });
  assert.equal(unrelated[0].text, '下雨');
});
