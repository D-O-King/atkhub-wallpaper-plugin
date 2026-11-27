(function () {
  'use strict';
  var token = new URL(location.href).searchParams.get('atkWpToken');
  var paused = false, properties = {}, propertiesReceived = false, listener, animations = [], playing = [];
  var nativeRaf = window.requestAnimationFrame.bind(window);
  var nativeCancel = window.cancelAnimationFrame.bind(window);
  // The sandbox has an opaque origin. Local images must use CORS before loading
  // so wallpaper scripts can upload them to WebGL without tainting the canvas.
  var imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  var imageSetAttribute = HTMLImageElement.prototype.setAttribute;
  function prepareImage(image, source) {
    if (image.crossOrigin !== null) return;
    try {
      var url = new URL(String(source), document.baseURI);
      if (url.protocol === 'atk-wallpaper:' && url.hostname === 'web') image.crossOrigin = 'anonymous';
    } catch (_) { /* Leave invalid URLs to the browser. */ }
  }
  if (imageSrc && imageSrc.get && imageSrc.set) Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: imageSrc.configurable, enumerable: imageSrc.enumerable,
    get: imageSrc.get, set: function (source) { prepareImage(this, source); imageSrc.set.call(this, source); }
  });
  HTMLImageElement.prototype.setAttribute = function (name, value) {
    if (String(name).toLowerCase() === 'src') prepareImage(this, value);
    return imageSetAttribute.call(this, name, value);
  };
  var pending = new Map(), nextId = 1;
  function notify(type, extra) { parent.postMessage(Object.assign({ channel: 'atk-wp-web', token: token, type: type }, extra || {}), '*'); }
  function schedule(id, request) {
    request.native = nativeRaf(function (time) {
      request.native = null;
      if (paused) return;
      pending.delete(id); request.callback(time);
    });
  }
  window.requestAnimationFrame = function (callback) {
    var id = nextId++, request = { callback: callback, native: null };
    pending.set(id, request); if (!paused) schedule(id, request); return id;
  };
  window.cancelAnimationFrame = function (id) {
    var request = pending.get(id); if (request && request.native !== null) nativeCancel(request.native);
    pending.delete(id);
  };
  function applyProperties() {
    if (!propertiesReceived || !listener || typeof listener.applyUserProperties !== 'function') return;
    var values = {}; Object.keys(properties).forEach(function (key) { values[key] = { value: properties[key] }; });
    listener.applyUserProperties(values);
  }
  Object.defineProperty(window, 'wallpaperPropertyListener', {
    configurable: true, get: function () { return listener; },
    set: function (value) { listener = value; applyProperties(); }
  });
  function setPaused(value) {
    if (paused === value) return; paused = value;
    if (paused) {
      pending.forEach(function (request) { if (request.native !== null) nativeCancel(request.native); request.native = null; });
      animations = document.getAnimations().filter(function (a) { return a.playState === 'running'; });
      animations.forEach(function (a) { a.pause(); });
      playing = Array.from(document.querySelectorAll('video,audio')).filter(function (m) { return !m.paused; });
      playing.forEach(function (m) { m.pause(); });
    } else {
      pending.forEach(function (request, id) { schedule(id, request); });
      animations.forEach(function (a) { a.play(); }); animations = [];
      playing.forEach(function (m) { m.play().catch(function () {}); }); playing = [];
    }
  }
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (event.source !== parent || !data || data.channel !== 'atk-wp-web' || data.token !== token) return;
    if (data.type === 'properties') { properties = data.value || {}; propertiesReceived = true; applyProperties(); }
    if (data.type === 'paused') setPaused(!!data.value);
    if (data.type === 'performance' && listener && typeof listener.applyGeneralProperties === 'function') listener.applyGeneralProperties({ fps: data.value.fps });
  });
  window.addEventListener('load', function () {
    var images = Array.from(document.images);
    Promise.all(images.map(function (img) { return img.decode().catch(function () {}); })).then(function () {
      if (images.length && !images.some(function (img) { return img.naturalWidth > 0; })) { notify('error', { message: '网页壁纸图片加载失败' }); return; }
      notify('ready', { images: images.length });
    });
  }, { once: true });
})();
