/* Rocket Browser — tabbed web browser with built-in rocket:// pages. Needs Wi-Fi for the web.
 * Web version: pages load in iframes (some sites refuse to be framed).
 * OS version: pages load in real native WebKit views supplied by rocket-shell (every site works). */
OS.registerApp({ id: 'browser', name: 'Rocket Browser', icon: '🌐', category: 'Internet', width: 900, height: 580, desc: 'Browse the web (requires Wi-Fi)',
  launch(win, args = {}) {
    if (typeof Native !== 'undefined' && Native.on && Native.browser) return RocketBrowserNative(win, args);
    const { h } = OS;
    const bm = JSON.parse(localStorage.getItem('rocketos.bookmarks') || 'null') || [['Wikipedia', 'https://en.m.wikipedia.org'], ['DuckDuckGo', 'https://duckduckgo.com'], ['OpenStreetMap', 'https://www.openstreetmap.org/export/embed.html'], ['Example', 'https://example.com'], ['RocketOS Home', 'rocket://home']];
    const tabsEl = h('div', { class: 'br-tabs' }), url = h('input', { class: 'input br-url', spellcheck: 'false' });
    const bBack = h('button', { class: 'btn icon' }, '←'), bFwd = h('button', { class: 'btn icon' }, '→'), bReload = h('button', { class: 'btn icon' }, '⟳'), bHome = h('button', { class: 'btn icon' }, '🏠'), bStar = h('button', { class: 'btn icon', title: 'Bookmark' }, '☆');
    const bmBar = h('div', { class: 'br-bm' });
    const views = h('div', { class: 'br-views' });
    win.body.append(h('div', { class: 'browser' }, h('div', { class: 'br-top' }, tabsEl, h('button', { class: 'btn icon sm', onclick: () => newTab('rocket://home') }, '+')), h('div', { class: 'br-nav' }, bBack, bFwd, bReload, bHome, url, bStar), bmBar, views));
    const tabs = []; let cur = null;
    const renderBm = () => { bmBar.innerHTML = ''; bm.forEach(([n, u]) => bmBar.append(h('button', { class: 'bm', onclick: () => nav(u), oncontextmenu: e => { e.preventDefault(); OS.contextMenu(e.clientX, e.clientY, [{ icon: '🗑️', label: 'Remove bookmark', action: () => { bm.splice(bm.findIndex(b => b[1] === u), 1); localStorage.setItem('rocketos.bookmarks', JSON.stringify(bm)); renderBm(); } }]); } }, n))); };
    renderBm();

    function page(name) {
      const online = NET.online();
      if (name === 'home') return `<style>body{font-family:system-ui;background:linear-gradient(160deg,#141a3d,#3b1f5c);color:#fff;text-align:center;padding:40px}a{color:#ffb86c}input{width:60%;padding:12px 16px;border-radius:24px;border:0;font-size:16px}.g{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:30px}.g a{background:#fff1;padding:16px 20px;border-radius:14px;text-decoration:none;min-width:110px}</style>
<div style="font-size:64px">🚀</div><h1>Rocket Browser</h1><p>${online ? '🟢 Online via ' + OS.esc(NET.status().ssid || '') : '🔴 Offline — connect to Wi-Fi from the top bar to browse the web.'}</p>
<form onsubmit="parent.postMessage({rocketNav:document.querySelector('input').value},'*');return false"><input placeholder="Search DuckDuckGo or type a URL" autofocus></form>
<div class="g">${bm.map(([n, u]) => `<a href="#" onclick="parent.postMessage({rocketNav:${OS.esc(JSON.stringify(u))}},'*');return false">${OS.esc(n)}</a>`).join('')}</div>
<p style="opacity:.6;margin-top:40px">Note: many big sites refuse to load inside other pages (frames). Wikipedia, DuckDuckGo, OpenStreetMap and example.com work well.</p>`;
      if (name === 'offline') return `<style>body{font-family:system-ui;background:#1a1d27;color:#ddd;text-align:center;padding:60px}</style><div style="font-size:60px">📵</div><h2>No internet connection</h2><p>${!OS.settings.wifi.enabled ? 'Wi-Fi is turned off.' : !NET.current() ? 'You are not connected to a Wi-Fi network.' : 'Your device is offline.'}</p><p>Open the Wi-Fi menu in the top bar to connect.</p>`;
      if (name === 'about') return `<style>body{font-family:system-ui;padding:30px}</style><h2>Rocket Browser 1.0</h2><p>Part of RocketOS ${OS.version}.</p>`;
      return `<h2>rocket://${OS.esc(name)} not found</h2>`;
    }
    function newTab(u) {
      const frame = h('iframe', { class: 'br-frame', sandbox: 'allow-scripts allow-forms allow-popups allow-same-origin', referrerpolicy: 'no-referrer' });
      const label = h('span', {}, 'New tab');
      const tabEl = h('div', { class: 'br-tab' }, label, h('button', { class: 'x', onclick: e => { e.stopPropagation(); close(tab); } }, '×'));
      const tab = { frame, tabEl, label, hist: [], idx: -1 };
      tabEl.onclick = () => activate(tab);
      tabsEl.append(tabEl); views.append(frame); tabs.push(tab); activate(tab);
      nav(u || 'rocket://home');
    }
    function activate(t) { cur = t; tabs.forEach(x => { x.frame.classList.toggle('on', x === t); x.tabEl.classList.toggle('on', x === t); }); url.value = t.hist[t.idx] || ''; }
    function close(t) { tabs.splice(tabs.indexOf(t), 1); t.frame.remove(); t.tabEl.remove(); if (!tabs.length) return win.close(); activate(tabs[tabs.length - 1]); }
    function normalize(u) {
      u = u.trim();
      if (/^rocket:\/\//.test(u)) return u;
      if (/^https?:\/\//.test(u)) return u;
      if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(u)) return 'https://' + u;
      return 'https://duckduckgo.com/html/?q=' + encodeURIComponent(u);
    }
    function load(t, u) {
      url.value = u;
      if (u.startsWith('rocket://')) { t.frame.setAttribute('sandbox', 'allow-scripts allow-forms'); t.frame.removeAttribute('src'); t.frame.srcdoc = page(u.slice(9)); t.label.textContent = u.slice(9); return; }
      if (!NET.online()) { t.frame.setAttribute('sandbox', 'allow-scripts'); t.frame.removeAttribute('src'); t.frame.srcdoc = page('offline'); t.label.textContent = 'Offline'; return; }
      t.frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-same-origin'); t.frame.removeAttribute('srcdoc'); t.frame.src = u;
      try { t.label.textContent = new URL(u).hostname.replace(/^www\./, ''); } catch { t.label.textContent = u; }
      bStar.textContent = bm.some(b => b[1] === u) ? '★' : '☆';
    }
    function nav(u) { const t = cur; u = normalize(u); t.hist = t.hist.slice(0, t.idx + 1); t.hist.push(u); t.idx++; load(t, u); }
    bBack.onclick = () => { if (cur.idx > 0) load(cur, cur.hist[--cur.idx]); };
    bFwd.onclick = () => { if (cur.idx < cur.hist.length - 1) load(cur, cur.hist[++cur.idx]); };
    bReload.onclick = () => load(cur, cur.hist[cur.idx]);
    bHome.onclick = () => nav('rocket://home');
    bStar.onclick = async () => { const u = cur.hist[cur.idx]; if (!u || bm.some(b => b[1] === u)) return; const n = await OS.prompt('Bookmark name:', cur.label.textContent, 'Bookmark'); if (!n) return; bm.push([n, u]); localStorage.setItem('rocketos.bookmarks', JSON.stringify(bm)); renderBm(); bStar.textContent = '★'; };
    url.addEventListener('keydown', e => { if (e.key === 'Enter') nav(url.value); });
    const onMsg = e => { if (e.data && e.data.rocketNav && tabs.some(t => t.frame.contentWindow === e.source)) nav(e.data.rocketNav); };
    addEventListener('message', onMsg); win.onClose(() => removeEventListener('message', onMsg));
    const onNet = () => { if (cur && (cur.hist[cur.idx] || '').startsWith('rocket://home')) load(cur, cur.hist[cur.idx]); };
    OS.on('net', onNet); win.onClose(() => OS.off('net', onNet));
    newTab(args.url || 'rocket://home');
  } });

/* ------------------------------------------------------------------ native (OS) browser */
const BrowserCommon = {
  bookmarks() { return JSON.parse(localStorage.getItem('rocketos.bookmarks') || 'null') || [['Wikipedia', 'https://en.wikipedia.org'], ['DuckDuckGo', 'https://duckduckgo.com'], ['YouTube', 'https://www.youtube.com'], ['GitHub', 'https://github.com'], ['OpenStreetMap', 'https://www.openstreetmap.org'], ['RocketOS Home', 'rocket://home']]; },
  saveBookmarks(bm) { localStorage.setItem('rocketos.bookmarks', JSON.stringify(bm)); },
  normalize(u) {
    u = u.trim();
    if (/^(rocket|about|https?|file):/.test(u)) return u;
    // local addresses (localhost, 192.168.x.x…) are usually plain http; everything else https
    if (/^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[\da-f:]+\])(:\d+)?(\/.*)?$/i.test(u)) return 'http://' + u;
    if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(u)) return 'https://' + u;
    return 'https://duckduckgo.com/?q=' + encodeURIComponent(u);
  },
};
let nativeBrowserSeq = 0;

function RocketBrowserNative(win, args = {}) {
  const { h } = OS, B = Native.browser;
  const bm = BrowserCommon.bookmarks();
  const tabsEl = h('div', { class: 'br-tabs' }), url = h('input', { class: 'input br-url', spellcheck: 'false', placeholder: 'Search or enter address' });
  const btn = (t, title, fn) => h('button', { class: 'btn icon', title, onclick: fn }, t);
  const bBack = btn('←', 'Back', () => cur && cur.mode === 'web' ? B.post({ cmd: 'back', id: cur.id }) : null);
  const bFwd = btn('→', 'Forward', () => cur && cur.mode === 'web' ? B.post({ cmd: 'forward', id: cur.id }) : null);
  const bReload = btn('⟳', 'Reload', () => { if (!cur) return; if (cur.mode === 'web') B.post({ cmd: cur.loading ? 'stop' : 'reload', id: cur.id }); else showPage(cur, cur.page); });
  const bHome = btn('🏠', 'Home', () => nav('rocket://home'));
  const bStar = btn('☆', 'Bookmark', async () => { const u = cur && cur.url; if (!u || bm.some(b => b[1] === u)) return; const n = await OS.prompt('Bookmark name:', cur.title || u, 'Bookmark'); if (!n) return; bm.push([n, u]); BrowserCommon.saveBookmarks(bm); renderBm(); upd(); });
  const zoomBtn = btn('🔍', 'Zoom', e => { const r = e.target.getBoundingClientRect(); OS.contextMenu(r.left, r.bottom, [0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2].map(z => ({ label: Math.round(z * 100) + '%' + (cur.zoom === z ? '  ✓' : ''), action: () => { cur.zoom = z; B.post({ cmd: 'zoom', id: cur.id, level: z }); } }))); });
  const progress = h('div', { class: 'br-progress' });
  const bmBar = h('div', { class: 'br-bm' });
  const snap = h('img', { class: 'br-snap', alt: '' });
  const views = h('div', { class: 'br-views native' }, snap);
  win.body.append(h('div', { class: 'browser' }, h('div', { class: 'br-top' }, tabsEl, h('button', { class: 'btn icon sm', onclick: () => newTab('rocket://home') }, '+')),
    h('div', { class: 'br-nav' }, bBack, bFwd, bReload, bHome, url, zoomBtn, bStar), progress, bmBar, views));
  const tabs = []; let cur = null;

  function renderBm() { bmBar.innerHTML = ''; bm.forEach(([n, u]) => bmBar.append(h('button', { class: 'bm', onclick: () => nav(u), oncontextmenu: e => { e.preventDefault(); OS.contextMenu(e.clientX, e.clientY, [{ icon: '🗑️', label: 'Remove bookmark', action: () => { bm.splice(bm.findIndex(b => b[1] === u), 1); BrowserCommon.saveBookmarks(bm); renderBm(); } }]); } }, n))); }
  renderBm();

  function homePage() {
    const online = NET.online();
    return `<style>body{font-family:system-ui;background:linear-gradient(160deg,#141a3d,#3b1f5c);color:#fff;text-align:center;padding:40px}input{width:60%;padding:12px 16px;border-radius:24px;border:0;font-size:16px}.g{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:30px}.g a{color:#ffb86c;background:#fff1;padding:16px 20px;border-radius:14px;text-decoration:none;min-width:110px}</style>
<div style="font-size:64px">🚀</div><h1>Rocket Browser</h1><p>${online ? '🟢 Online' : '🔴 Offline — connect to Wi-Fi from the top bar to browse the web.'}</p>
<form onsubmit="parent.postMessage({rocketNav:document.querySelector('input').value},'*');return false"><input placeholder="Search DuckDuckGo or type a URL" autofocus></form>
<div class="g">${bm.filter(b => !b[1].startsWith('rocket:')).map(([n, u]) => `<a href="#" onclick="parent.postMessage({rocketNav:${OS.esc(JSON.stringify(u))}},'*');return false">${OS.esc(n)}</a>`).join('')}</div>
<p style="opacity:.6;margin-top:40px">Full web engine — every site works. Downloads go to ~/Downloads.</p>`;
  }
  function newTab(u) {
    const id = 'b' + (++nativeBrowserSeq);
    const frame = h('iframe', { class: 'br-frame', sandbox: 'allow-scripts allow-forms' });
    const label = h('span', {}, 'New tab');
    const tabEl = h('div', { class: 'br-tab' }, label, h('button', { class: 'x', onclick: e => { e.stopPropagation(); close(tab); } }, '×'));
    const tab = { id, frame, tabEl, label, mode: 'page', page: 'home', created: false, url: '', title: '', canBack: false, canForward: false, loading: false, progress: 0, zoom: 1, snapshot: '' };
    tabEl.onclick = () => activate(tab);
    tabsEl.append(tabEl); views.append(frame); tabs.push(tab);
    B.on(id, ev => onEvent(tab, ev));
    activate(tab); nav(u || 'rocket://home', tab);
  }
  function onEvent(t, ev) {
    if (ev.type === 'state') {
      Object.assign(t, { url: ev.url, title: ev.title, loading: ev.loading, progress: ev.progress, canBack: ev.canBack, canForward: ev.canForward });
      t.label.textContent = ev.title || (() => { try { return new URL(ev.url).hostname; } catch { return ev.url; } })();
      if (t === cur) upd();
    } else if (ev.type === 'newtab') newTab(ev.url);
    else if (ev.type === 'focus') { win.focus(); if (cur !== t) activate(t); }
    else if (ev.type === 'snapshot') { t.snapshot = ev.data; if (t === cur) upd(); }
  }
  function showPage(t, name) {
    t.mode = 'page'; t.page = name; t.url = 'rocket://' + name; t.title = name;
    t.frame.srcdoc = name === 'home' ? homePage() : `<h2 style="font-family:system-ui">rocket://${OS.esc(name)} not found</h2>`;
    t.label.textContent = name === 'home' ? 'Home' : name;
    if (t === cur) upd();
  }
  function nav(u, t = cur) {
    u = BrowserCommon.normalize(u);
    if (u.startsWith('rocket://')) return showPage(t, u.slice(9));
    t.mode = 'web'; t.url = u; t.snapshot = '';
    if (!t.created) { t.created = true; B.post({ cmd: 'create', id: t.id, url: u }); }
    else B.post({ cmd: 'nav', id: t.id, url: u });
    if (t === cur) upd();
  }
  function activate(t) { cur = t; tabs.forEach(x => x.tabEl.classList.toggle('on', x === t)); upd(); }
  function close(t) {
    tabs.splice(tabs.indexOf(t), 1); t.frame.remove(); t.tabEl.remove(); B.off(t.id);
    if (t.created) B.post({ cmd: 'close', id: t.id });
    if (!tabs.length) return win.close();
    activate(tabs[tabs.length - 1]);
  }
  function upd() {
    if (!cur) return;
    tabs.forEach(x => x.frame.classList.toggle('on', x === cur && x.mode === 'page'));
    if (document.activeElement !== url) url.value = cur.mode === 'page' ? 'rocket://' + cur.page : cur.url;
    bBack.disabled = !(cur.mode === 'web' && cur.canBack); bFwd.disabled = !(cur.mode === 'web' && cur.canForward);
    bReload.textContent = cur.mode === 'web' && cur.loading ? '✕' : '⟳';
    bStar.textContent = bm.some(b => b[1] === cur.url) ? '★' : '☆';
    progress.style.width = cur.mode === 'web' && cur.loading ? Math.max(5, cur.progress * 100) + '%' : '0';
    snap.src = cur.mode === 'web' ? (cur.snapshot || '') : '';
    snap.style.display = cur.mode === 'web' && cur.snapshot ? '' : 'none';
    win.setTitle((cur.title || 'New tab') + ' — Rocket Browser');
  }
  url.addEventListener('keydown', e => { if (e.key === 'Enter') { nav(url.value); url.blur(); } });
  // select the whole address on the first click, like real browsers (mouseup would otherwise clear the selection)
  let selectOnUp = false;
  url.addEventListener('mousedown', () => { selectOnUp = document.activeElement !== url; });
  url.addEventListener('mouseup', e => { if (selectOnUp) { e.preventDefault(); url.select(); selectOnUp = false; } });
  url.addEventListener('focus', () => url.select());
  const onMsg = e => { if (e.data && e.data.rocketNav) { const t = tabs.find(x => x.frame.contentWindow === e.source); if (t) nav(e.data.rocketNav, t); } };
  addEventListener('message', onMsg);

  // Keep the native view glued to this window's content area; hide it whenever anything covers it.
  const coverSel = '.ctxmenu, .popup, .spotlight, .task-preview, .window.modal';
  const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  let last = {}, raf = 0;
  function visible(r) {
    if (win.closed || win.minimized || win.el.classList.contains('opening') || win.el.classList.contains('closing')) return false;
    if (!document.getElementById('lock').classList.contains('hidden') || !document.getElementById('boot').classList.contains('hidden')) return false;
    const D = document.getElementById('desktop').getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.left < D.left || r.top < D.top || r.right > D.right + 0.5 || r.bottom > D.bottom + 0.5) return false;
    const sm = document.getElementById('startmenu');
    if (!sm.classList.contains('hidden') && hit(r, sm.getBoundingClientRect())) return false;
    for (const el of document.querySelectorAll(coverSel)) if (hit(r, el.getBoundingClientRect())) return false;
    const myZ = +win.el.style.zIndex || 0;
    for (const w of WM.list()) if (w !== win && !w.minimized && (+w.el.style.zIndex || 0) > myZ && hit(r, w.el.getBoundingClientRect())) return false;
    return true;
  }
  function sync() {
    if (win.closed) return;
    const r = views.getBoundingClientRect();
    const show = visible(r);
    for (const t of tabs) {
      if (!t.created) continue;
      const v = show && t === cur && t.mode === 'web';
      const msg = { cmd: 'rect', id: t.id, visible: v, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
      const key = v ? `${msg.x},${msg.y},${msg.w},${msg.h}` : 'hidden';
      if (last[t.id] !== key) { last[t.id] = key; B.post(msg); }
    }
    raf = requestAnimationFrame(sync);
  }
  raf = requestAnimationFrame(sync);
  win.onClose(() => { cancelAnimationFrame(raf); removeEventListener('message', onMsg); tabs.forEach(t => { B.off(t.id); if (t.created) B.post({ cmd: 'close', id: t.id }); }); });
  newTab(args.url || 'rocket://home');
}
