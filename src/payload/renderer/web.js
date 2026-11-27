(function () {
  'use strict';
  var VERSION = '1.0.0';
  if (window.__atkWpWeb && window.__atkWpWeb.version === VERSION) return;
  var active = null;
  function mount(host, media, callbacks) {
    if (active) active.destroy();
    var cb = callbacks || {}, frame = document.createElement('iframe');
    var token = Date.now().toString(36) + Math.random().toString(36).slice(2);
    var paused = false, ready = false, destroyed = false, performance = media.performance || {}, properties = media.props || {}, sent = Object.create(null);
    host.style.cssText = 'position:absolute;inset:0;overflow:hidden;opacity:0;pointer-events:none;';
    frame.className = 'atk-wp-web-frame'; frame.title = '网页壁纸';
    frame.setAttribute('sandbox', 'allow-scripts'); frame.setAttribute('referrerpolicy', 'no-referrer'); frame.tabIndex = -1;
    frame.style.cssText = 'position:absolute;inset:0;border:0;width:100%;height:100%;display:block;';
    var session = { destroyed: false, setFit: function () {},
      setPerformance: function (value) { performance = value || {}; send('performance', performance); },
      setProperties: function (value) { properties = value || {}; send('properties', properties); },
      setPaused: function (value) { paused = !!value; send('paused', paused); },
      destroy: function () {
        if (destroyed) return; destroyed = true; session.destroyed = true;
        clearTimeout(timeout); window.removeEventListener('message', receive);
        frame.remove(); host.remove(); if (active === session) active = null;
      }
    };
    active = session;
    function send(type, value) {
      if (!ready || destroyed) return;
      var signature = JSON.stringify(value); if (sent[type] === signature) return; sent[type] = signature;
      frame.contentWindow.postMessage({ channel: 'atk-wp-web', token: token, type: type, value: value }, '*');
    }
    function fail(message) { if (destroyed) return; session.destroy(); if (cb.error) cb.error(message, 'web-entry', { url: media.webUrl }); }
    function receive(event) {
      var data = event.data;
      if (destroyed || event.source !== frame.contentWindow || !data || data.channel !== 'atk-wp-web' || data.token !== token) return;
      if (data.type === 'error') { fail(data.message || '网页壁纸加载失败'); return; }
      if (data.type !== 'ready' || ready) return;
      ready = true; clearTimeout(timeout); host.style.opacity = '1';
      send('properties', properties); send('performance', performance); send('paused', paused);
      if (cb.ready) cb.ready();
    }
    window.addEventListener('message', receive);
    var timeout = setTimeout(function () { fail('网页壁纸加载超时'); }, 20000);
    if (cb.status) cb.status('web-entry', { url: media.webUrl });
    Promise.resolve().then(function () {
      if (!media.webUrl) throw new Error('网页壁纸入口为空');
      return fetch(media.webUrl, { credentials: 'omit', cache: 'no-store' });
    }).then(function (response) {
      if (!response.ok) throw new Error('网页入口 HTTP ' + response.status);
      if (response.body && response.body.cancel) response.body.cancel().catch(function () {});
      if (destroyed) return;
      var url = new URL(media.webUrl); url.searchParams.set('atkWpToken', token);
      frame.src = url.href; host.appendChild(frame);
    }).catch(function (error) { fail(String(error.message || error)); });
    return session;
  }
  window.__atkWpWeb = { version: VERSION, mount: mount, activeCount: function () { return active && !active.destroyed ? 1 : 0; } };
})();
