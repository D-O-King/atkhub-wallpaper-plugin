(function () {
  'use strict';
  function normalizeHex(value) {
    const text = String(value ?? '').trim();
    const match = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(text);
    if (!match) return null;
    const digits = match[1].length === 3 ? match[1].split('').map(c => c + c).join('') : match[1];
    return '#' + digits.toUpperCase();
  }
  function wallpaperToHex(value) {
    const text = String(value ?? '').trim();
    if (text.startsWith('#')) return normalizeHex(text);
    const parts = text.split(/\s+/);
    if (parts.length !== 3 || parts.some(p => !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(p))) return null;
    const rgb = parts.map(Number);
    if (rgb.some(v => !Number.isFinite(v) || v < 0 || v > 1)) return null;
    return '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  function hexToWallpaper(value) {
    const hex = normalizeHex(value);
    if (!hex) return null;
    return [1, 3, 5].map(i => String(Number((parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(6)))).join(' ');
  }
  const api = { normalizeHex, wallpaperToHex, hexToWallpaper };
  if (typeof window === 'object' && window.document) window.__atkWpColors = api;
  else if (typeof module === 'object' && module.exports) module.exports = api;
})();
