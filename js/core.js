/* RocketOS core: settings, app registry, launcher, events, notifications, dialogs, helpers. */
const OS = (() => {
  const SKEY = 'rocketos.settings.v1';
  const defaults = {
    username: 'user', password: '', hostname: 'rocket',
    wallpaper: 'classic', wallpaperCustom: '', theme: 'dark', accent: '#ff6b35',
    taskbarStyle: 'modern', showCpuMeter: true, clockSeconds: false, clock24: false,
    quickLaunch: ['files', 'terminal', 'browser', 'store', 'rocky'],
    pinned: ['files', 'terminal', 'browser', 'editor', 'store', 'rocky'],
    widgets: { clock: true, calendar: true, weather: true, sysmon: true, notes: false, todo: false },
    widgetPos: {}, iconPos: {},
    aiMode: 'local', aiKey: '', volume: 70, dnd: false, recent: [], bootSound: true,
    wifi: { enabled: true, connected: 'RocketNet-5G', known: { 'RocketNet-5G': 'rocket123' } },
  };
  let settings = {};
  try { settings = Object.assign({}, defaults, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch { settings = Object.assign({}, defaults); }

  function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch {} emit('settings', settings); }
  function set(key, val) { settings[key] = val; saveSettings(); }

  // ---------- event bus
  const L = {};
  function on(ev, fn) { (L[ev] = L[ev] || []).push(fn); return () => off(ev, fn); }
  function off(ev, fn) { L[ev] = (L[ev] || []).filter(f => f !== fn); }
  function emit(ev, d) { (L[ev] || []).slice().forEach(f => { try { f(d); } catch (e) { console.error(e); } }); }

  // ---------- helpers
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
  const fmtTime = (d = new Date(), secs = settings.clockSeconds) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: secs ? '2-digit' : undefined, hour12: !settings.clock24 });

  // ---------- app registry
  const apps = {};
  /* app: {id, name, icon, category: 'System'|'Accessories'|'Games'|'Internet'|'Media'|'Development', launch(win, args), width, height, singleton, hidden, desc} */
  function registerApp(app) { apps[app.id] = Object.assign({ category: 'Accessories', width: 640, height: 440 }, app); }
  function getApp(id) { return apps[id]; }
  function listApps() { return Object.values(apps).filter(a => !a.hidden); }

  // ---------- processes
  let nextPid = 100;
  const procs = [];
  function spawn(name, extra = {}) { const p = Object.assign({ pid: nextPid++, name, start: Date.now(), cpu: 0, mem: 4 + Math.random() * 40 }, extra); procs.push(p); emit('procs'); return p; }
  function killProc(pid) {
    const p = procs.find(x => x.pid === +pid);
    if (!p) return false;
    if (p.win) p.win.close(true);
    const i = procs.indexOf(p); if (i >= 0) procs.splice(i, 1);
    emit('procs'); return true;
  }

  function launch(id, args = {}) {
    const app = apps[id];
    if (!app) { notify('RocketOS', `App “${id}” not found.`, '⚠️'); return null; }
    if (app.singleton) {
      const existing = WM.list().find(w => w.appId === id);
      if (existing) { existing.restore(); existing.focus(); if (app.onReopen) app.onReopen(existing, args); return existing; }
    }
    const win = WM.create({ title: app.name, icon: app.icon, width: app.width, height: app.height, appId: id, resizable: app.resizable !== false, minWidth: app.minWidth, minHeight: app.minHeight });
    const proc = spawn(app.name, { win, appId: id });
    win.proc = proc;
    win.onClose(() => { const i = procs.indexOf(proc); if (i >= 0) procs.splice(i, 1); emit('procs'); });
    try { app.launch(win, args); } catch (e) { console.error(e); win.body.innerHTML = `<div class="pad err">Crashed: ${esc(e.message)}</div>`; }
    emit('launch', { id, win });
    return win;
  }

  // ---------- open files by type
  const openers = {}; // ext -> fn(path)
  function registerOpener(ext, fn) { openers[ext] = fn; }
  function addRecent(path) {
    const r = (settings.recent || []).filter(p => p !== path); r.unshift(path); settings.recent = r.slice(0, 12); saveSettings();
  }
  function openFile(path, opts = {}) {
    path = VFS.normalize(path);
    if (!VFS.exists(path)) { notify('Open', `${path} does not exist.`, '⚠️'); return; }
    if (VFS.isDir(path)) return launch('files', { path });
    const e = VFS.ext(path);
    addRecent(path);
    if (openers[e] && !opts.edit) return openers[e](path, opts);
    return launch('editor', { path });
  }

  // ---------- notifications
  const notifications = [];
  function notify(title, body = '', icon = '🔔', opts = {}) {
    const n = { id: Date.now() + Math.random(), title, body, icon, time: new Date(), action: opts.action };
    notifications.unshift(n); if (notifications.length > 50) notifications.pop();
    emit('notify', n);
    if (settings.dnd && !opts.force) return n;
    const box = document.getElementById('toasts');
    if (!box) return n;
    const t = h('div', { class: 'toast' }, h('div', { class: 'toast-icon' }, icon), h('div', { class: 'toast-text' }, h('b', {}, title), h('div', {}, body)), h('button', { class: 'toast-x', onclick: e => { e.stopPropagation(); kill(); } }, '×'));
    if (n.action) t.addEventListener('click', () => { n.action(); kill(); });
    box.append(t);
    requestAnimationFrame(() => t.classList.add('show'));
    const kill = () => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); };
    setTimeout(kill, opts.duration || 4500);
    Sound.blip(660, 0.05);
    return n;
  }

  // ---------- dialogs (in-OS modal windows)
  function dialog({ title = 'RocketOS', message = '', input = null, buttons = ['OK'], icon = 'ℹ️', password = false }) {
    return new Promise(resolve => {
      const win = WM.create({ title, icon, width: 380, height: input != null ? 200 : 170, resizable: false, modal: true, noTaskbar: true });
      let field = null;
      const body = h('div', { class: 'dialog' },
        h('div', { class: 'dialog-row' }, h('div', { class: 'dialog-icon' }, icon), h('div', { class: 'dialog-msg' }, message)));
      if (input != null) { field = h('input', { class: 'input', type: password ? 'password' : 'text', value: input }); body.append(field); }
      const btns = h('div', { class: 'dialog-btns' });
      buttons.forEach((b, i) => btns.append(h('button', { class: 'btn' + (i === 0 ? ' primary' : ''), onclick: () => done(b) }, b)));
      body.append(btns);
      win.body.append(body);
      requestAnimationFrame(() => { const need = body.scrollHeight + 38; if (need > win.el.offsetHeight) win.el.style.height = Math.min(innerHeight - 120, need) + 'px'; });
      let finished = false;
      function done(b) {
        if (finished) return; finished = true;
        resolve(field ? (b === buttons[0] ? field.value : null) : b);
        win.close();
      }
      win.onClose(() => { if (!finished) { finished = true; resolve(field ? null : buttons[buttons.length - 1]); } });
      (field || btns.firstChild).focus();
      if (field) { field.select(); field.addEventListener('keydown', e => { if (e.key === 'Enter') done(buttons[0]); if (e.key === 'Escape') done('Cancel'); }); }
    });
  }
  const alert = (message, title, icon) => dialog({ message, title, icon });
  const confirm = (message, title = 'Confirm', icon = '❓') => dialog({ message, title, icon, buttons: ['OK', 'Cancel'] }).then(b => b === 'OK');
  const prompt = (message, value = '', title = 'Input', opts = {}) => dialog({ message, title, input: value, icon: opts.icon || '✏️', buttons: ['OK', 'Cancel'], password: opts.password });

  // ---------- context menu
  function contextMenu(x, y, items) {
    closeMenus();
    const m = h('div', { class: 'ctxmenu' });
    for (const it of items) {
      if (it === '-') { m.append(h('div', { class: 'sep' })); continue; }
      const row = h('div', { class: 'item' + (it.disabled ? ' disabled' : '') }, h('span', { class: 'ico' }, it.icon || ''), h('span', {}, it.label), it.hint ? h('span', { class: 'hint' }, it.hint) : '');
      if (!it.disabled) row.addEventListener('click', e => { e.stopPropagation(); closeMenus(); it.action && it.action(); });
      m.append(row);
    }
    document.getElementById('popups').append(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 4) + 'px';
    m.style.top = Math.min(y, innerHeight - r.height - 4) + 'px';
    return m;
  }
  function closeMenus() { document.querySelectorAll('.ctxmenu').forEach(m => m.remove()); }
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.ctxmenu')) closeMenus(); });

  // ---------- sound
  const Sound = (() => {
    let ctx = null;
    const ac = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } return ctx; };
    function tone(freq, dur = 0.1, type = 'sine', vol = 0.15, when = 0) {
      const c = ac(); if (!c || settings.volume <= 0) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      const v = vol * (settings.volume / 100);
      g.gain.setValueAtTime(v, c.currentTime + when);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
      o.connect(g).connect(c.destination); o.start(c.currentTime + when); o.stop(c.currentTime + when + dur + 0.02);
    }
    return { tone, ctx: ac, blip: (f = 880, d = 0.06) => tone(f, d, 'triangle', 0.08),
      startup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.12, i * 0.13)),
      shutdown: () => [784, 659, 523, 392].forEach((f, i) => tone(f, 0.35, 'triangle', 0.12, i * 0.15)),
      error: () => tone(180, 0.25, 'square', 0.08) };
  })();

  // ---------- system log
  function log(msg) { try { VFS.write('/var/log/syslog.txt', `[${new Date().toISOString()}] ${msg}\n`, true); } catch {} }

  const version = '1.0.0';
  const bootTime = Date.now();

  return { settings, saveSettings, set, defaults, on, off, emit, h, esc, fmtSize, fmtTime,
    registerApp, getApp, listApps, apps, launch, procs, spawn, killProc,
    registerOpener, openFile, addRecent, notify, notifications,
    dialog, alert, confirm, prompt, contextMenu, closeMenus, Sound, log, version, bootTime };
})();
