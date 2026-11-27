'use strict';
// Display text only: project keys and option values remain untouched.
const labels = new Map(Object.entries({
  animations: '动画', animation: '动画', bloom: '泛光', blurbackground: '背景模糊',
  backgroundblur: '背景模糊', cameramovement: '镜头移动', characterssize: '角色大小',
  charactersize: '角色大小', opacity: '不透明度', particleswind: '风粒子',
  particlesleaves: '落叶粒子', particles: '粒子', schemecolor: '主题颜色',
  uibrowsepropertiesschemecolor: '主题颜色', big169: '大尺寸（16:9）',
  littlephone: '小尺寸（手机）', background: '背景', speed: '速度',
  volume: '音量', brightness: '亮度', contrast: '对比度', saturation: '饱和度',
  blur: '模糊', size: '大小', scale: '缩放', color: '颜色', intensity: '强度',
  strength: '强度', amount: '数量', count: '数量', density: '密度',
  enabled: '启用', disabled: '禁用', enable: '启用', disable: '禁用',
  on: '开启', off: '关闭', true: '开启', false: '关闭', none: '无', null: '无',
  default: '默认', low: '低', medium: '中', high: '高', fast: '快', slow: '慢',
  small: '小', little: '小', large: '大', big: '大', normal: '正常', auto: '自动',
  clock: '时钟', clockdraganddrop: '时钟（可拖动）', date: '日期',
  '1224hours': '12 / 24 小时制', '24h': '24 小时制', clockcolor: '时钟颜色',
  mouse: '鼠标', mouselight: '鼠标光效', parallax: '视差', depthparallax: '深度视差',
  snow: '飘雪', rain: '下雨', sunrays: '阳光', lightshafts: '光束', lightshifts: '光线变化',
  movingbushes: '灌木摆动', butterfly: '蝴蝶', sparcle: '闪光', sparkle: '闪光',
  chromaticeffect: '色差效果', clouds: '云朵', dots: '光点', eyesfire: '眼部火焰',
  floweffect: '流动效果', gengaranimation: '耿鬼动画', irismove: '瞳孔移动',
  pulseaudio: '音频脉冲', backgroundparticles: '背景粒子',
  additonalbackgroundparticles: '额外背景粒子', additonalpetals: '额外花瓣',
  movementadditonalpetals: '额外花瓣飘动', petals: '花瓣', leaves: '落叶',
  leavescolor: '落叶颜色', bokeh: '散景光斑', shadow: '阴影',
  blinkingpresets: '眨眼预设', changeeyecolor: '自定义眼睛颜色', eyecolor: '眼睛颜色',
  arperspectiveparticles: '音频响应视差粒子', araudiocycle: '音频循环响应',
  bodymovement: '身体摆动', extrabodymovement: '额外身体摆动', armmovement: '手臂摆动',
  shouldermovement: '肩部摆动', hairmovement: '头发飘动',
  clothmovement1: '衣物飘动 1', clothmovement2: '衣物飘动 2', clothmovement3: '衣物飘动 3',
  decorationsmovement: '饰品摆动', decorationsmovement2: '饰品摆动 2',
  rosestopright: '玫瑰（右上）', rosesbottomleft: '玫瑰（左下）', shimmereffectgirl: '角色微光',
  music: '音乐', bgm: '背景音乐', audioreactive: '音频响应', audioreaction: '音频响应',
  joinmydiscord: '加入作者的 Discord', position: '位置', horizontal: '水平', vertical: '垂直',
  resolution: '分辨率', quality: '画质', fps: '帧率', phone: '手机', desktop: '桌面'
}));
function plainText(value) {
  return String(value ?? '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}
function normalized(value) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function chineseLabel(value, key = '') {
  const text = plainText(value);
  // Prefer a project's own Chinese text when it supplies a bilingual label.
  const chinese = text.split(/\r?\n/).find(line => /[\u3400-\u9fff]/.test(line));
  if (chinese) return chinese.trim();
  return labels.get(normalized(text)) || labels.get(normalized(key)) || text || key;
}
function localizedProperties(project) {
  const result = [];
  const locale = project?.general?.localization;
  const zh = locale?.['zh-cn'] || locale?.['zh_CN'] || locale?.['zh-CN'] || {};
  const translate = (text, key) => chineseLabel(zh[text] ?? text, key);
  for (const [key, spec] of Object.entries(project?.general?.properties || {})) {
    if (!spec || !['slider', 'bool', 'color', 'textinput', 'combo'].includes(spec.type)) continue;
    result.push({ key, type: spec.type, text: translate(spec.text || key, key), value: spec.value,
      min: spec.min, max: spec.max, step: spec.step,
      options: Array.isArray(spec.options) ? spec.options.map(option => ({ ...option,
        label: translate(option.label ?? String(option.value)) })) : undefined });
  }
  return result;
}
module.exports = { chineseLabel, localizedProperties };
