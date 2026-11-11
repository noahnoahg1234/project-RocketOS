/* Rocket Browser — tabbed web browser (iframe-based) with built-in rocket:// pages. Needs Wi-Fi for the web. */
OS.registerApp({ id: 'browser', name: 'Rocket Browser', icon: '🌐', category: 'Internet', width: 900, height: 580, desc: 'Browse the web (requires Wi-Fi)',
  launch(win, args = {}) {
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
