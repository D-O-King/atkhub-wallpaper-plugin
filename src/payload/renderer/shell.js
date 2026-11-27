(() => {
  'use strict';
  const version = '1.0.0';
  if (window.__atkWallpaper?.version === version) { window.__atkWallpaper.heal(); return; }
  window.__atkWallpaper?.dispose?.();
  let state = { items: [], libraries: [], favorites: [], recent: [], beautify: {}, scenePerformance: {}, rotation: {}, hotkeys: {}, props: {} };
  let entry, dialog, panel, background, visual, image, mediaSession, statusNode, currentId = '', currentKind = '', pendingScene = false;
  let disposed = false, rendering = false, signature = '', healScheduled = false;
  let backgroundInteractive = false;
  const inputRegions = new Map();
  let searchText = '', sourceFilter = 'all', favoritesOnly = false;
  const send = (t, payload = {}) => console.dir('[atk-wp]' + JSON.stringify({ t, payload }));
  function node(tag, text, className) {
    const value = document.createElement(tag); if (text !== undefined) value.textContent = text; if (className) value.className = className; return value;
  }
  function button(text, action) { const b = node('button', text); b.type = 'button'; b.onclick = action; return b; }
  const landscapeMarkup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M4 7.5H3.75A1.75 1.75 0 0 0 2 9.25v10A1.75 1.75 0 0 0 3.75 21h12A1.75 1.75 0 0 0 17.5 19.25V19" stroke="currentColor" stroke-opacity=".45" stroke-width="1.5" stroke-linecap="round"/><rect x="6" y="3" width="16" height="14" rx="3" fill="currentColor" fill-opacity=".05" stroke="currentColor" stroke-width="1.5"/><circle cx="16.75" cy="7.5" r="1.25" fill="currentColor"/><path d="m8.75 14 3.1-3.75 2.8 3.15 1.65-1.9 2.95 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const stylesheet = node('style');
  stylesheet.id = 'atk-wp-style';
  stylesheet.textContent = `
    html.atk-wp-on #app>.card{isolation:isolate}
    html.atk-wp-on #app>.card>.atk-background-image{display:none!important}
    #atk-wp-bg{position:absolute;inset:0;overflow:hidden;z-index:-1!important;pointer-events:none}
    #atk-wp-visual{position:absolute;inset:0;overflow:hidden;transform-origin:center}
    #atk-wp-visual>img,#atk-wp-visual>video{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    #atk-wp-bg .atk-wp-bg__web,#atk-wp-bg .atk-wp-web-frame,#atk-wp-bg .atk-wp-bg__scene,#atk-wp-bg .atk-wp-bg__scene canvas{pointer-events:auto!important}
    html.atk-wp-on #app>.card [data-atk-wp-input="pass"]{pointer-events:none!important}
    html.atk-wp-on #app>.card [data-atk-wp-input="foreground"]{pointer-events:auto!important}
    /* HUB's absolute drag surface otherwise uses the whole window as its box. */
    html.atk-wp-on #app>.card #layout-header[data-atk-wp-input="foreground"]{position:relative!important}
    #atk-wp-dim{position:absolute;inset:0;background:#000;pointer-events:none}
    #atk-wp-entry{display:inline-flex;align-items:center;justify-content:center;flex:none;width:36px;height:36px;padding:0;background:transparent;color:var(--color-text-head-100,#e5efff);border:1px solid transparent;border-radius:9px;box-shadow:none;cursor:pointer;-webkit-app-region:no-drag;transition:background .18s,border-color .18s,color .18s}
    #atk-wp-entry svg{display:block;width:23px;height:23px;pointer-events:none}
    #atk-wp-entry:hover{background:#b9d5ff18;border-color:#b9d5ff22}
    #atk-wp-entry:active{background:#b9d5ff2b}
    #atk-wp-entry:focus-visible{outline:2px solid #a9ccff;outline-offset:3px}
    @media(prefers-reduced-motion:reduce){#atk-wp-entry{transition:none}#atk-wp-entry:hover{transform:none}}
    #atk-wp-entry.atk-wp-fallback{position:fixed;bottom:18px;right:18px;z-index:1000;background:#1b263bd9;color:#e5efff;border-color:#b9d5ff33}
    #atk-wp-dialog{width:min(1180px,94vw);height:86vh;max-height:94vh;max-width:94vw;box-sizing:border-box;padding:0;overflow:hidden;border:1px solid #e1edff38;border-radius:24px;background:linear-gradient(135deg,#25344dc4,#111b2bb3);color:#f0f5ff;font:13px 'Microsoft YaHei',sans-serif;box-shadow:0 30px 100px #03081470,inset 0 1px 0 #ffffff24;backdrop-filter:blur(28px) saturate(145%);-webkit-backdrop-filter:blur(28px) saturate(145%);color-scheme:dark}
    #atk-wp-dialog::backdrop{background:#060b183d}
    #atk-wp-dialog *{box-sizing:border-box}
    #atk-wp-dialog header{height:84px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 26px;border-bottom:1px solid #ffffff15;background:linear-gradient(100deg,#ffffff09,transparent)}
    .atk-wp-brand{display:flex;align-items:center;gap:13px;min-width:0}
    .atk-wp-brand-mark{display:grid;place-items:center;flex:none;width:42px;height:42px;border:1px solid #d0e3ff38;border-radius:14px;background:linear-gradient(135deg,#b5d7ff28,#abc2ff08);box-shadow:inset 0 1px 0 #ffffff1c;color:#e1efff}
    .atk-wp-brand-mark svg{width:26px;height:26px}
    .atk-wp-brand strong{display:block;font-size:17px;font-weight:600;letter-spacing:.1px}
    .atk-wp-brand p{margin:5px 0 0;color:#c4d2e8;font-size:11px;letter-spacing:1px}
    .atk-wp-header-actions{display:flex;align-items:center;gap:14px}
    .atk-wp-version{color:#b6c9e4;font-size:11px;border:1px solid #ffffff18;border-radius:20px;padding:5px 9px;background:#ffffff05}
    #atk-wp-dialog button{cursor:pointer;font:inherit;color:inherit;border:1px solid #ffffff24;border-radius:10px;background:linear-gradient(155deg,#ffffff12,#ffffff06);box-shadow:inset 0 1px 0 #ffffff0a;padding:9px 14px;transition:background .16s,border-color .16s,box-shadow .16s}
    #atk-wp-dialog button:hover{background-color:#c6ddff17;border-color:#d3e5ff63;box-shadow:inset 0 1px 0 #ffffff14,0 3px 12px #050b1714}
    #atk-wp-dialog button:active{background-color:#b7d7ff24}
    #atk-wp-dialog :is(button,input,select,summary):focus-visible{outline:2px solid #b7d5ff;outline-offset:3px}
    #atk-wp-dialog .atk-wp-close{display:grid;place-items:center;flex:none;width:34px;height:34px;padding:0;border-color:#ffffff1c;font-size:23px;line-height:1;color:#d0def2;background:#ffffff05}
    .atk-wp-workspace{display:grid;grid-template-columns:180px minmax(0,1fr);height:calc(100% - 84px);min-height:0}
    .atk-wp-sidebar{display:flex;flex-direction:column;gap:6px;padding:24px 14px;border-right:1px solid #ffffff12;background:#08132312;min-height:0}
    .atk-wp-sidebar-label{padding:0 12px;margin:0 0 12px;font-size:10px;color:#b6c7e1;letter-spacing:2px}
    #atk-wp-dialog .atk-wp-nav-button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:12px;border-color:transparent;box-shadow:none;background:transparent;color:#cad7ec}
    #atk-wp-dialog .atk-wp-nav-button:hover{background:#d3e3ff12;border-color:#d3e3ff24;color:#fff}
    .atk-wp-nav-button svg{width:18px;height:18px;flex:none;opacity:.85}
    .atk-wp-sidebar-note{margin:auto 8px 0;padding:18px 4px 2px;border-top:1px solid #ffffff17;color:#c5d3e8;line-height:1.9;font-size:11px}
    .atk-wp-sidebar-note strong{display:block;font-size:12px;font-weight:500;color:#eef5ff;margin-bottom:5px}
    #atk-wp-panel{min-height:0;padding:22px;overflow:auto;overscroll-behavior:contain;scroll-padding-top:22px;scrollbar-width:thin;scrollbar-color:#b6cce447 transparent}
    #atk-wp-panel::-webkit-scrollbar{width:7px}#atk-wp-panel::-webkit-scrollbar-track{background:transparent}#atk-wp-panel::-webkit-scrollbar-thumb{background:#b6cce43d;border:1px solid transparent;border-radius:10px;background-clip:padding-box}#atk-wp-panel::-webkit-scrollbar-thumb:hover{background:#b6cce466}
    #atk-wp-panel section{margin:0 0 16px;padding:20px;background:linear-gradient(120deg,#ffffff0c,#ffffff04);border:1px solid #e2ecff21;border-radius:17px;box-shadow:inset 0 1px 0 #ffffff08,0 4px 16px #060e1d08}
    #atk-wp-panel h3{display:flex;align-items:center;gap:9px;margin:0 0 17px;font-size:14px;font-weight:600;letter-spacing:.3px}#atk-wp-panel h3::before{content:'';width:3px;height:13px;background:#b3d5ff;border-radius:3px}
    #atk-wp-panel p{color:#c4d2e7;line-height:1.8;font-size:11px;margin:12px 0 0}
    .atk-wp-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:10px 0}
    .atk-wp-form-row{align-items:flex-end;gap:12px}
    #atk-wp-panel .atk-wp-row>button{height:38px;line-height:18px;padding-top:9px;padding-bottom:9px;white-space:nowrap}
    .atk-wp-rotation-row{display:grid;grid-template-columns:minmax(100px,132px) minmax(132px,180px) max-content;align-items:end;gap:12px}
    #atk-wp-panel .atk-wp-rotation-row input[type=number]{width:100%}
    .atk-wp-playback{margin-bottom:18px}
    #atk-wp-dialog .atk-wp-primary{background:linear-gradient(135deg,#c9dfff,#adcafa);border-color:#dceaff99;color:#182a47;font-weight:600;box-shadow:0 4px 14px #122f5f26,inset 0 1px 0 #fff6}
    #atk-wp-dialog .atk-wp-primary:hover{background:linear-gradient(135deg,#dceaff,#bfd7ff);border-color:#edf5ff}
    .atk-wp-settings{gap:22px;padding-top:14px;border-top:1px solid #ffffff10;align-items:flex-end}
    .atk-wp-sliders{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .atk-wp-field{display:flex;flex-direction:column;gap:10px;min-width:0;max-width:100%;color:#d6e2f4;font-size:12px}
    .atk-wp-sliders>.atk-wp-field{padding:13px 14px;border:1px solid #ffffff0d;border-radius:12px;background:#0d182015}
    .atk-wp-field>span{display:flex;justify-content:space-between;align-items:center;gap:6px}
    .atk-wp-value{font-variant-numeric:tabular-nums;font-size:11px;color:#d1e6ff;background:#c6dfff12;border:1px solid #c6dfff14;border-radius:6px;padding:2px 6px;min-width:28px;text-align:center}
    #atk-wp-panel select,#atk-wp-panel input[type=text],#atk-wp-panel input[type=number]{font:inherit;line-height:18px;color:#edf5ff;border:1px solid #dbe8ff29;background:#0d1b2b3d;border-radius:9px;padding:9px 11px;height:38px;max-width:100%}
    #atk-wp-panel select{cursor:pointer}#atk-wp-panel select option{background:#233148;color:#f2f6ff}
    #atk-wp-panel input::placeholder{color:#b1c2db}#atk-wp-panel input[type=number]{width:88px}
    #atk-wp-panel input[type=range]{appearance:none;-webkit-appearance:none;width:100%;height:20px;margin:0;background:transparent;cursor:pointer;accent-color:#c5dfff}
    #atk-wp-panel input[type=range]::-webkit-slider-runnable-track{height:4px;background:#c8defc33;border-radius:8px}
    #atk-wp-panel input[type=range]::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:13px;height:13px;margin-top:-4.5px;border-radius:50%;background:#d8eaff;border:2px solid #f4f8ff;box-shadow:0 1px 5px #0c1d3840}
    #atk-wp-panel input[type=range]:hover::-webkit-slider-thumb{background:#fff;box-shadow:0 0 0 4px #d7e9ff15}
    #atk-wp-panel input[type=checkbox]{appearance:none;-webkit-appearance:none;position:relative;flex:none;width:34px;height:20px;border:1px solid #e4eeff33;border-radius:20px;margin:0;background:#08182d4d;cursor:pointer;transition:background .16s}
    #atk-wp-panel input[type=checkbox]::after{content:'';position:absolute;left:3px;top:3px;width:12px;height:12px;border-radius:50%;background:#c4d1e4;transition:transform .16s}
    #atk-wp-panel input[type=checkbox]:checked{background:#accdf6;border-color:#dbeaff88}#atk-wp-panel input[type=checkbox]:checked::after{transform:translateX(14px);background:#20354f}
    .atk-wp-toggle{display:flex;align-items:center;gap:9px;min-height:38px;color:#d6e2f4;font-size:12px;cursor:pointer}
    .atk-wp-library{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:10px 0;padding:10px 12px;background:#0c192621;border:1px solid #ffffff0e;border-radius:11px}
    .atk-wp-library>span{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d1def2;font-size:12px}.atk-wp-library>.atk-wp-row{flex:none;margin:0}
    .atk-wp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:13px;margin-top:18px}
    #atk-wp-dialog .atk-wp-tile{padding:0;overflow:hidden;text-align:left;border:1px solid #ffffff21;border-radius:13px;background:#ffffff06;box-shadow:0 4px 12px #07112112}
    #atk-wp-dialog .atk-wp-tile:hover{border-color:#d5e6ff77;background:#ffffff0e;box-shadow:0 6px 20px #07112124}
    #atk-wp-dialog .atk-wp-tile[aria-pressed=true]{border-color:#c1ddff;box-shadow:0 0 0 2px #c1ddff28;background:#c7e0ff14}
    .atk-wp-tile img{width:100%;height:110px;object-fit:cover;display:block;background:#08162633}
    .atk-wp-tile strong{display:block;padding:11px 12px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:500}
    .atk-wp-tile small{display:block;padding:0 12px 11px;font-size:10px;color:#bfd0e8}
    #atk-wp-panel details{margin-top:18px;padding-top:16px;border-top:1px solid #ffffff12}#atk-wp-panel summary{cursor:pointer;color:#c8d8ee;font-size:12px}
    .atk-wp-scene-status{display:none}
    @media(max-width:1000px){.atk-wp-workspace{grid-template-columns:150px minmax(0,1fr)}#atk-wp-panel{padding:16px}.atk-wp-sliders{grid-template-columns:1fr 1fr}.atk-wp-sidebar{padding:20px 8px}}
    @media(max-width:680px){#atk-wp-dialog{border-radius:18px;width:96vw;max-width:96vw;height:92vh}#atk-wp-dialog header{padding:14px 16px;height:74px}.atk-wp-brand strong{font-size:14px}.atk-wp-brand-mark{width:34px;height:34px;border-radius:11px}.atk-wp-version{display:none}.atk-wp-workspace{display:flex;flex-direction:column;height:calc(100% - 74px)}.atk-wp-sidebar{flex:none;flex-direction:row;overflow-x:auto;padding:10px;gap:4px;border-right:0;border-bottom:1px solid #ffffff12}.atk-wp-sidebar-label,.atk-wp-sidebar-note{display:none}#atk-wp-dialog .atk-wp-nav-button{width:auto;flex:none;padding:8px;font-size:11px;gap:6px}.atk-wp-nav-button svg{width:15px;height:15px}#atk-wp-panel{flex:1;padding:12px}#atk-wp-panel section{padding:15px}.atk-wp-sliders{gap:8px}.atk-wp-sliders>.atk-wp-field{padding:10px}.atk-wp-library{align-items:flex-start;flex-direction:column}.atk-wp-brand p{font-size:10px}.atk-wp-settings{gap:12px}}
    @media(max-width:520px){.atk-wp-rotation-row{grid-template-columns:repeat(2,minmax(0,1fr))}.atk-wp-rotation-row>button{grid-column:1/-1}}
    @media(prefers-reduced-motion:reduce){#atk-wp-dialog *,#atk-wp-dialog *::after{transition:none!important;scroll-behavior:auto!important}}
    @media(prefers-reduced-transparency:reduce){#atk-wp-dialog{background:#1a283d;backdrop-filter:none;-webkit-backdrop-filter:none}}
    @supports not (backdrop-filter:blur(1px)){#atk-wp-dialog{background:#1a283df5}}
  `;
  document.head.appendChild(stylesheet);
  function setStatus(phase, message = '') {
    if (!statusNode) { statusNode = node('span', '', 'atk-wp-scene-status'); document.body.appendChild(statusNode); }
    statusNode.setAttribute('data-scene-phase', phase); statusNode.textContent = message;
    if (phase === 'error') send('error', { message });
  }
  function stopMedia() {
    backgroundInteractive = false; clearWallpaperInput();
    mediaSession?.destroy(); mediaSession = null;
    background?.querySelectorAll('video').forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
    background?.remove(); background = visual = image = null; currentId = currentKind = ''; pendingScene = false;
    document.documentElement.classList.remove('atk-wp-on');
  }
  function loadRuntime(media) {
    if (media.kind === 'scene' && !window.__atkWpScene) {
      if (!pendingScene) { pendingScene = true; send('sceneRuntimeNeeded', { id: media.id }); }
      return;
    }
    pendingScene = false;
    const runtime = media.kind === 'web' ? window.__atkWpWeb : window.__atkWpScene;
    const host = node('div', undefined, media.kind === 'web' ? 'atk-wp-bg__web' : 'atk-wp-bg__scene');
    visual.appendChild(host);
    mediaSession = runtime.mount(host, media, {
      status: phase => setStatus(phase),
      ready: () => { if (image) image.style.visibility = 'hidden'; backgroundInteractive = ['web', 'scene'].includes(media.kind); syncWallpaperInput(); setStatus('ready'); },
      error: message => { backgroundInteractive = false; clearWallpaperInput(); if (image) image.style.visibility = ''; setStatus('error', message); }
    });
  }
  function clearWallpaperInput() {
    for (const element of inputRegions.keys()) element.removeAttribute('data-atk-wp-input');
    inputRegions.clear();
  }
  function syncWallpaperInput() {
    // Keep native wallpaper hit testing: empty HUB containers must not cover it.
    // Protect complete UI surfaces so their children retain the HUB's own rules.
    if (!backgroundInteractive || !background?.isConnected) { if (inputRegions.size) clearWallpaperInput(); return; }
    const next = new Map(), layout = background.parentElement;
    const foreground = 'header,footer,nav,aside,form,dialog,button,a[href],input,select,textarea,summary,label,iframe,[role="button"],[role="dialog"],[role="menu"],[role="listbox"],[role="slider"],[role="switch"],[role="checkbox"],[role="tab"],[tabindex],[contenteditable="true"],#layout-header,.card-cover-define-wrap,.device,.el-dialog,.el-overlay';
    function visit(element) {
      if (element === background || element.matches('#atk-wp-entry,#atk-wp-dialog,style,script,link,.atk-background-image')) return;
      let protect = element.matches(foreground) || typeof element.onclick === 'function';
      const style = getComputedStyle(element);
      if (!protect) protect = style.cursor === 'pointer' || style.webkitAppRegion === 'drag';
      // Some HUB cards handle clicks on a div without an explicit cursor.
      if (!protect) {
        const events = Object.getOwnPropertySymbols(element).find(symbol => symbol.description === '_vei');
        protect = !!events && Object.keys(element[events] || {}).some(key => /^on(?:Click|Dblclick|Pointerdown|Mousedown)/i.test(key));
      }
      if (!protect) protect = /auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1 || /auto|scroll/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
      next.set(element, protect ? 'foreground' : 'pass');
      if (!protect) Array.from(element.children).forEach(visit);
    }
    Array.from(layout.children).forEach(visit);
    for (const element of inputRegions.keys()) if (!next.has(element)) element.removeAttribute('data-atk-wp-input');
    for (const [element, mode] of next) if (inputRegions.get(element) !== mode) element.setAttribute('data-atk-wp-input', mode);
    inputRegions.clear(); for (const [element, mode] of next) inputRegions.set(element, mode);
  }
  function syncAppearance() {
    if (!background) return;
    const p = state.beautify;
    const filter = `blur(${p.blur || 0}px) brightness(${p.brightness ?? 100}%) saturate(${p.saturation ?? 100}%)`;
    if (visual.style.filter !== filter) visual.style.filter = filter;
    const transform = `scale(${(p.scale || 100) / 100})`; if (visual.style.transform !== transform) visual.style.transform = transform;
    const dim = background.querySelector('#atk-wp-dim'); const opacity = String((p.dim || 0) / 100); if (dim.style.opacity !== opacity) dim.style.opacity = opacity;
    for (const element of visual.querySelectorAll(':scope>img,:scope>video')) {
      if (element.style.objectFit !== p.fit) element.style.objectFit = p.fit || 'cover';
      const position = `${p.posX ?? 50}% ${p.posY ?? 50}%`; if (element.style.objectPosition !== position) element.style.objectPosition = position;
    }
    mediaSession?.setFit(p.fit); mediaSession?.setPerformance(state.scenePerformance); mediaSession?.setProperties(state.media?.props || {});
    pauseMedia();
  }
  function pauseMedia() {
    const paused = document.hidden && state.scenePerformance.pauseWhenHidden !== false;
    mediaSession?.setPaused(paused);
    background?.querySelectorAll('video').forEach(video => { if (paused) video.pause(); else if (video.paused) video.play().catch(() => {}); });
  }
  function syncBackground() {
    const layout = document.querySelector('#app>.card'), media = state.media;
    if (!layout || !state.enabled || !media) { if (background) stopMedia(); return; }
    if (currentId !== media.id || currentKind !== media.kind || !background) {
      stopMedia(); currentId = media.id; currentKind = media.kind;
      background = node('div'); background.id = 'atk-wp-bg';
      visual = node('div'); visual.id = 'atk-wp-visual'; background.appendChild(visual);
      const dim = node('div'); dim.id = 'atk-wp-dim'; background.appendChild(dim);
      layout.prepend(background); document.documentElement.classList.add('atk-wp-on');
      if (media.preview || (media.kind === 'image' && media.src)) {
        image = node('img'); image.alt = ''; image.src = media.kind === 'image' ? media.src : media.preview; visual.appendChild(image);
      }
      if (media.kind === 'video') {
        const video = node('video'); video.muted = true; video.autoplay = true; video.loop = true; video.playsInline = true; video.src = media.src;
        video.onloadeddata = () => { if (image) image.style.visibility = 'hidden'; setStatus('ready'); };
        video.onerror = () => { video.remove(); if (image) image.style.visibility = ''; setStatus('error', '视频无法解码，已显示预览'); };
        visual.appendChild(video); video.play().catch(() => {});
      } else if (['scene', 'web'].includes(media.kind)) loadRuntime(media);
      else setStatus(media.kind === 'image' ? 'ready' : 'error', media.kind === 'unsupported' ? '此项目类型暂不支持' : '');
    } else {
      if (background.parentElement !== layout) layout.prepend(background);
      if (pendingScene && window.__atkWpScene) loadRuntime(media);
    }
    syncAppearance();
  }
  function section(title, key) { const s = node('section'); if (key) s.dataset.section = key; s.appendChild(node('h3', title)); panel.appendChild(s); return s; }
  function row(parent) { const r = node('div', undefined, 'atk-wp-row'); parent.appendChild(r); return r; }
  function selectControl(parent, label, choices, value, callback) {
    const field = node('label', undefined, 'atk-wp-field'); field.appendChild(node('span', label));
    const select = node('select');
    choices.forEach(([key, title]) => { const option = node('option', title); option.value = key; select.appendChild(option); });
    select.value = String(value); select.onchange = () => callback(select.value); field.appendChild(select); parent.appendChild(field); return select;
  }
  function rangeControl(parent, label, value, min, max, step, callback) {
    const field = node('label', undefined, 'atk-wp-field'), caption = node('span', label), output = node('output', String(value), 'atk-wp-value'), input = node('input');
    caption.appendChild(output);
    input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value;
    input.oninput = () => { output.textContent = input.value; callback(Number(input.value)); };
    field.append(caption, input); parent.appendChild(field); return input;
  }
  function renderProperties(parent) {
    const item = state.items.find(i => i.id === state.bgId); if (!item?.props?.length) return;
    parent.appendChild(node('h3', '壁纸属性'));
    const grid = node('div', undefined, 'atk-wp-sliders atk-wp-property-grid'); parent.appendChild(grid);
    for (const spec of item.props) {
      const value = state.media?.props?.[spec.key] ?? spec.value;
      const apply = nextValue => send('props', { id: item.id, values: { [spec.key]: nextValue } });
      if (spec.type === 'slider') rangeControl(grid, spec.text, value, spec.min ?? 0, spec.max ?? 100, spec.step ?? 0.1, apply);
      else if (spec.type === 'combo') {
        const choices = (spec.options || []).map(o => [String(o.value), String(o.label || o.value)]);
        selectControl(grid, spec.text, choices, value, v => apply(spec.options.find(o => String(o.value) === v)?.value));
      } else {
        const label = node('label', undefined, 'atk-wp-field'), input = node('input'); label.appendChild(node('span', spec.text));
        input.type = spec.type === 'bool' ? 'checkbox' : 'text'; if (input.type === 'checkbox') input.checked = !!value; else input.value = value ?? '';
        input.onchange = () => apply(input.type === 'checkbox' ? input.checked : input.value); label.appendChild(input); grid.appendChild(label);
      }
    }
  }
  function renderTiles(grid) {
    grid.replaceChildren();
    const items = state.items.filter(item => (!favoritesOnly || state.favorites.includes(item.id)) && (sourceFilter === 'all' || item.libraryId === sourceFilter) && item.title.toLowerCase().includes(searchText.toLowerCase()));
    if (!items.length) { grid.appendChild(node('p', '暂无匹配壁纸。添加目录后刷新，或调整筛选条件。')); return; }
    const limit = 300;
    for (const item of items.slice(0, limit)) {
      const tile = button('', () => send('set', { id: item.id })); tile.className = 'atk-wp-tile'; tile.setAttribute('aria-pressed', String(state.bgId === item.id && state.enabled));
      const img = node('img'); img.alt = ''; img.loading = 'lazy'; if (item.preview) img.src = item.preview;
      const labels = { image: '图片', video: '视频', scene: '场景', web: '网页', unsupported: '暂不支持' };
      tile.append(img, node('strong', item.title), node('small', `${state.favorites.includes(item.id) ? '★ ' : ''}${labels[item.kind] || item.kind}`)); grid.appendChild(tile);
    }
    if (items.length > limit) grid.appendChild(node('p', `显示前 ${limit} 项，请用搜索缩小范围。`));
  }
  function renderPanel(force = false) {
    if (!panel || !dialog.open || rendering) return;
    const nextSignature = JSON.stringify(state);
    if (!force && signature === nextSignature) return;
    // Keep a dragged slider alive while its asynchronous state response arrives.
    if (!force && panel.contains(document.activeElement) && document.activeElement.type === 'range') return;
    signature = nextSignature; rendering = true;
    const scroll = panel.scrollTop; panel.replaceChildren();
    const controls = section('播放与画质', 'playback'), playback = row(controls); playback.classList.add('atk-wp-playback');
    playback.append(button('上一张', () => send('next', { direction: -1 })), button('下一张', () => send('next')), button('随机', () => send('next', { random: true })), button('恢复 HUB 背景', () => send('reset')),
      button(state.favorites.includes(state.bgId) ? '取消收藏' : '收藏当前', () => send('favorite', { id: state.bgId })), button('位置预览', () => send('preview', { open: true })));
    playback.children[1].classList.add('atk-wp-primary');
    const settings = row(controls); settings.classList.add('atk-wp-settings');
    selectControl(settings, '场景画质', [['saver', '省电 · 15 FPS'], ['balanced', '均衡 · 30 FPS'], ['quality', '高画质 · 60 FPS']], state.scenePerformance.preset,
      preset => send('scenePerformance', { ...state.scenePerformance, preset }));
    const hiddenLabel = node('label', undefined, 'atk-wp-toggle'), hidden = node('input'); hidden.type = 'checkbox'; hidden.checked = state.scenePerformance.pauseWhenHidden !== false;
    hidden.onchange = () => send('scenePerformance', { ...state.scenePerformance, pauseWhenHidden: hidden.checked }); hiddenLabel.append(hidden, node('span', '隐藏窗口时暂停')); settings.appendChild(hiddenLabel);
    controls.appendChild(node('p', '高画质以 60 FPS 为目标，复杂壁纸的流畅度取决于电脑性能。'));
    const appearance = section('画面调整', 'appearance'), sliders = node('div', undefined, 'atk-wp-sliders'); appearance.appendChild(sliders);
    const ranges = [['brightness', '亮度', 20, 200], ['saturation', '饱和度', 0, 200], ['dim', '遮暗', 0, 90], ['blur', '模糊', 0, 30], ['scale', '缩放', 100, 200], ['posX', '水平位置', 0, 100], ['posY', '垂直位置', 0, 100]];
    ranges.forEach(([key, label, min, max]) => rangeControl(sliders, label, state.beautify[key], min, max, 1, value => send('beautify', { [key]: value })));
    selectControl(sliders, '缩放方式', [['cover', '铺满并裁剪'], ['contain', '完整显示'], ['fill', '拉伸']], state.beautify.fit, fit => send('beautify', { fit }));
    renderProperties(appearance);
    const libraries = section('壁纸库', 'libraries'), libraryActions = row(libraries); libraryActions.append(button('添加壁纸库', () => send('libraryChoose'))); libraryActions.firstChild.classList.add('atk-wp-primary');
    for (const library of state.libraries) {
      const line = node('div', undefined, 'atk-wp-library'), label = node('span', `${library.label} · ${library.path}`); label.title = library.path;
      const actions = row(line); actions.appendChild(button(library.enabled ? '停用' : '启用', () => send('libraryUpdate', { id: library.id, enabled: !library.enabled })));
      if (library.source === 'manual') actions.appendChild(button('移除', () => send('libraryUpdate', { id: library.id, remove: true })));
      line.prepend(label); libraries.appendChild(line);
    }
    if (state.error) libraries.appendChild(node('p', state.error));
    const rotation = section('自动轮换', 'rotation'), rotationRow = row(rotation), rotationInput = node('input'); rotationInput.type = 'number'; rotationInput.min = 1; rotationInput.max = 1440; rotationInput.value = state.rotation.intervalMinutes;
    rotationRow.classList.add('atk-wp-rotation-row');
    const intervalField = node('label', undefined, 'atk-wp-field'); intervalField.append(node('span', '间隔（分钟）'), rotationInput); rotationRow.appendChild(intervalField);
    rotationInput.onchange = () => send('rotation', { ...state.rotation, intervalMinutes: Number(rotationInput.value) });
    selectControl(rotationRow, '范围', [['all', '全部壁纸'], ['favorites', '收藏']], state.rotation.scope, scope => send('rotation', { ...state.rotation, scope }));
    rotationRow.appendChild(button(state.rotation.enabled ? '停止轮换' : '开始轮换', () => send('rotation', { ...state.rotation, enabled: !state.rotation.enabled })));
    const hotkeys = node('details'), summary = node('summary', '全局快捷键（默认关闭）'); hotkeys.appendChild(summary); rotation.appendChild(hotkeys);
    for (const [key, label] of [['next', '下一张'], ['prev', '上一张'], ['random', '随机'], ['toggle', '启用 / 暂停'], ['preview', '位置预览']]) {
      const line = row(hotkeys), input = node('input'); input.type = 'text'; input.value = state.hotkeys[key] || ''; input.placeholder = '例如 Ctrl+Alt+Right';
      input.onchange = () => send('hotkeys', { [key]: input.value }); line.append(node('span', label), input);
    }
    if (state.hotkeyErrors?.length) hotkeys.appendChild(node('p', '以下快捷键无法注册：' + state.hotkeyErrors.join(', ')));
    const gallery = section(`选择壁纸 · ${state.items.length}`, 'gallery'), filters = row(gallery), search = node('input'); search.type = 'text'; search.placeholder = '搜索壁纸名称'; search.setAttribute('aria-label', '搜索壁纸名称'); search.value = searchText; filters.appendChild(search);
    filters.classList.add('atk-wp-form-row');
    const grid = node('div', undefined, 'atk-wp-grid');
    search.oninput = () => { searchText = search.value; renderTiles(grid); };
    selectControl(filters, '来源', [['all', '全部目录'], ...state.libraries.map(l => [l.id, l.label])], sourceFilter, value => { sourceFilter = value; renderTiles(grid); });
    filters.appendChild(button(favoritesOnly ? '显示全部' : '只看收藏', () => { favoritesOnly = !favoritesOnly; renderPanel(true); }));
    filters.appendChild(button('刷新', () => send('refresh')));
    gallery.appendChild(grid); renderTiles(grid); panel.scrollTop = scroll; rendering = false;
  }
  function ensureUi() {
    if (disposed || !document.querySelector('#app>.card')) return;
    if (!stylesheet.isConnected) document.head.appendChild(stylesheet);
    if (!dialog?.isConnected) {
      dialog = node('dialog'); dialog.id = 'atk-wp-dialog'; dialog.setAttribute('aria-label', 'ATK HUB Wallpaper');
      const header = node('header'), brand = node('div', undefined, 'atk-wp-brand'), mark = node('span', undefined, 'atk-wp-brand-mark'), title = node('div');
      mark.innerHTML = landscapeMarkup; title.append(node('strong', 'ATK HUB Wallpaper'), node('p', '壁纸与外观设置')); brand.append(mark, title);
      const actions = node('div', undefined, 'atk-wp-header-actions'), close = button('×', () => dialog.close()); close.className = 'atk-wp-close'; close.setAttribute('aria-label', '关闭'); close.title = '关闭';
      actions.append(node('small', version, 'atk-wp-version'), close); header.append(brand, actions);
      const workspace = node('div', undefined, 'atk-wp-workspace'), sidebar = node('nav', undefined, 'atk-wp-sidebar'); sidebar.setAttribute('aria-label', '设置快速定位'); sidebar.appendChild(node('p', '外观设置', 'atk-wp-sidebar-label'));
      const destinations = [
        ['playback', '播放与画质', '<path d="m10 8 6 4-6 4Z"/><rect x="3" y="4" width="18" height="16" rx="4"/>'],
        ['appearance', '画面调整', '<path d="M5 4v6m0 4v6M12 4v10m0 4v2M19 4v2m0 4v10M2 12h6m1 4h6m1-8h6"/>'],
        ['libraries', '壁纸库', '<path d="M3 8V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'],
        ['rotation', '自动轮换', '<path d="M20 11a8 8 0 0 0-14-5L3 9m0-5v5h5M4 13a8 8 0 0 0 14 5l3-3m0 5v-5h-5"/>'],
        ['gallery', '选择壁纸', '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>']
      ];
      destinations.forEach(([key, label, paths]) => {
        const link = button('', () => {
          const target = panel.querySelector('[data-section="' + key + '"]');
          if (target) panel.scrollTo({ top: target.offsetTop - panel.offsetTop - 22, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        });
        link.className = 'atk-wp-nav-button'; link.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>'; link.appendChild(node('span', label)); sidebar.appendChild(link);
      });
      const note = node('div', undefined, 'atk-wp-sidebar-note'); note.append(node('strong', '留一点好风景'), node('span', '自由调整画面，打造喜欢的界面。')); sidebar.appendChild(note);
      panel = node('div'); panel.id = 'atk-wp-panel'; workspace.append(sidebar, panel); dialog.append(header, workspace); document.body.appendChild(dialog);
      dialog.addEventListener('close', () => { document.activeElement?.blur?.(); });
    }
    if (!entry?.isConnected) {
      entry = button('', open); entry.id = 'atk-wp-entry';
      entry.title = '壁纸设置'; entry.setAttribute('aria-label', '壁纸设置'); entry.setAttribute('aria-haspopup', 'dialog');
      // Original layered photo icon, drawn inline for a sharp toolbar silhouette.
      entry.innerHTML = landscapeMarkup;
    }
    const anchor = document.querySelector('[data-hub-header-actions]') || document.body;
    if (entry.parentElement !== anchor) anchor.appendChild(entry);
    const fallback = anchor === document.body; if (entry.classList.contains('atk-wp-fallback') !== fallback) entry.classList.toggle('atk-wp-fallback', fallback);
  }
  function heal() { if (disposed) return; ensureUi(); syncBackground(); syncWallpaperInput(); }
  function open() { ensureUi(); if (!dialog) return; if (!dialog.open) dialog.showModal(); renderPanel(true); send('list'); }
  function receive(value) { if (disposed || !value || typeof value !== 'object') return; state = value; heal(); renderPanel(); }
  function mutations(records) {
    if (healScheduled || disposed) return;
    const relevant = records.some(record => {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      return !target?.closest('#atk-wp-bg,#atk-wp-dialog,#atk-wp-entry,.atk-wp-scene-status,#atk-wp-style');
    });
    if (!relevant) return; healScheduled = true; requestAnimationFrame(() => { healScheduled = false; heal(); });
  }
  const observer = new MutationObserver(mutations); observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'role', 'tabindex', 'disabled'] });
  document.addEventListener('visibilitychange', pauseMedia);
  window.__atkWpReceive = receive;
  window.__atkWallpaper = { version, open, heal, state: () => state, dispose: () => {
    disposed = true; observer.disconnect(); document.removeEventListener('visibilitychange', pauseMedia); stopMedia(); dialog?.remove(); entry?.remove(); stylesheet.remove(); statusNode?.remove();
    delete window.__atkWpReceive; delete window.__atkWallpaper;
  } };
  heal(); send('ready');
})();
