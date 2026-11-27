'use strict';
// Presets describe visual detail independently of a high frame-rate target.
const SCENE_PRESETS = {
  saver: { fps: 15, renderDpr: 0.75, videoTexScale: 0.5 },
  balanced: { fps: 30, renderDpr: 1, videoTexScale: 0.75 },
  quality: { fps: 60, renderDpr: 1.25, videoTexScale: 1 }
};
function normalizeScenePerformance(value) {
  const config = value || {};
  const preset = Object.hasOwn(SCENE_PRESETS, config.preset) ? config.preset : 'balanced';
  return { ...SCENE_PRESETS[preset], preset, pauseWhenHidden: config.pauseWhenHidden !== false };
}
module.exports = { SCENE_PRESETS, normalizeScenePerformance };
