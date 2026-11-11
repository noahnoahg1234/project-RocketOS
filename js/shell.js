/* RocketOS desktop shell: wallpaper, desktop icons, topbar, taskbar, start menu, search, popups. */
const Desktop = (() => {
  const { h, esc } = OS;
  const $ = s => document.querySelector(s);
  const DESK = () => VFS.home() + '/Desktop';

  // ===================== WALLPAPERS =====================
  const svg = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
  const classicSVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 1000' preserveAspectRatio='xMidYMid slice'>
<defs><linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#0b1033'/><stop offset='.55' stop-color='#1d2a6b'/><stop offset='.8' stop-color='#3c3f8f'/><stop offset='1' stop-color='#f08a4b'/></linearGradient>
<radialGradient id='pl' cx='.35' cy='.35' r='.7'><stop offset='0' stop-color='#ffd29b'/><stop offset='.6' stop-color='#e8743b'/><stop offset='1' stop-color='#7a2e1c'/></radialGradient>
<linearGradient id='fl' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fff6a0'/><stop offset='1' stop-color='#ff5a1f' stop-opacity='0'/></linearGradient></defs>
<rect width='1600' height='1000' fill='url(#sky)'/>
<g fill='#fff'>${Array.from({ length: 140 }, (_, i) => { const x = (i * 337) % 1600, y = (i * 211) % 640, r = (i % 7 === 0) ? 2.2 : (i % 3 === 0 ? 1.4 : 0.8); return `<circle cx='${x}' cy='${y}' r='${r}' opacity='${0.4 + (i % 5) / 8}'/>`; }).join('')}</g>
<circle cx='1220' cy='260' r='120' fill='url(#pl)'/>
<ellipse cx='1220' cy='262' rx='210' ry='34' fill='none' stroke='#ffd9b0' stroke-width='7' opacity='.7' transform='rotate(-14 1220 262)'/>
<path d='M0 860 Q200 760 420 830 T860 820 T1300 800 T1600 830 V1000 H0Z' fill='#241a4a'/>
<path d='M0 910 Q260 840 520 900 T1040 890 T1600 900 V1000 H0Z' fill='#160f30'/>
<g transform='translate(470 360) rotate(35)'>
<path d='M-22 120 L0 220 L22 120Z' fill='url(#fl)'/>
<path d='M0 -110 C40 -60 40 40 30 120 H-30 C-40 40 -40 -60 0 -110Z' fill='#e9ecf5'/>
<path d='M0 -110 C22 -82 30 -50 33 -30 H-33 C-30 -50 -22 -82 0 -110Z' fill='#ff6b35'/>
<circle cx='0' cy='10' r='16' fill='#3a4aa8' stroke='#9aa6e8' stroke-width='5'/>
<path d='M-30 70 L-62 132 L-30 118Z M30 70 L62 132 L30 118Z' fill='#ff6b35'/></g>
<text x='800' y='975' text-anchor='middle' font-family='Verdana,sans-serif' font-size='22' fill='#ffffff' opacity='.35' letter-spacing='12'>ROCKETOS</text></svg>`;
  const sunsetSVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 1000' preserveAspectRatio='xMidYMid slice'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2b1055'/><stop offset='.5' stop-color='#d4418e'/><stop offset='1' stop-color='#ffb86c'/></linearGradient></defs><rect width='1600' height='1000' fill='url(#g)'/><circle cx='800' cy='640' r='190' fill='#ffe29a' opacity='.9'/><path d='M0 700 Q300 600 600 690 T1200 670 T1600 690 V1000 H0Z' fill='#7b2d6b'/><path d='M0 780 Q350 700 700 770 T1600 760 V1000 H0Z' fill='#4a1b4f'/><path d='M0 860 Q400 800 800 860 T1600 850 V1000 H0Z' fill='#260d2e'/></svg>`;
  const gridSVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 1000' preserveAspectRatio='xMidYMid slice'><defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#090014'/><stop offset='.55' stop-color='#3a0b5e'/><stop offset='.56' stop-color='#120022'/></linearGradient><linearGradient id='sun' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffe259'/><stop offset='1' stop-color='#ff3c8e'/></linearGradient></defs><rect width='1600' height='1000' fill='url(#s)'/><circle cx='800' cy='460' r='170' fill='url(#sun)'/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x='600' y='${470 + i * 26}' width='400' height='${4 + i * 2}' fill='#3a0b5e'/>`).join('')}<g stroke='#ff3cac' stroke-width='2' opacity='.8'>${Array.from({ length: 13 }, (_, i) => `<line x1='${800 + (i - 6) * 40}' y1='555' x2='${800 + (i - 6) * 420}' y2='1000'/>`).join('')}${Array.from({ length: 9 }, (_, i) => { const y = 555 + Math.pow(i, 2) * 6; return `<line x1='0' y1='${y}' x2='1600' y2='${y}'/>`; }).join('')}</g></svg>`;

  const wallpapers = {
    classic: { name: 'RocketOS Classic', css: svg(classicSVG) + ' center/cover' },
    teal: { name: 'Classic Teal', css: '#008080' },
    sunset: { name: 'Sunset Hills', css: svg(sunsetSVG) + ' center/cover' },
    grid: { name: 'Retro Grid', css: svg(gridSVG) + ' center/cover' },
    nebula: { name: 'Nebula', css: 'radial-gradient(ellipse at 20% 30%, #7b2ff7 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, #f107a3 0%, transparent 50%), radial-gradient(ellipse at 60% 20%, #00d2ff55 0%, transparent 40%), #0a0620' },
    ocean: { name: 'Deep Ocean', css: 'linear-gradient(160deg, #00c6fb 0%, #005bea 50%, #021b49 100%)' },
    mint: { name: 'Mint Fresh', css: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
    graphite: { name: 'Graphite', css: 'radial-gradient(circle at 50% 40%, #3a3f4b, #111318)' },
  };
  function applyWallpaper() {
    const s = OS.settings, el = $('#wallpaper');
    if (s.wallpaper === 'custom' && s.wallpaperCustom) {
      const v = s.wallpaperCustom.trim();
      el.style.background = /^(#|rgb|hsl|linear|radial)/.test(v) ? v : `url("${v.replace(/"/g, '')}") center/cover`;
    } else el.style.background = (wallpapers[s.wallpaper] || wallpapers.classic).css;
  }
  function applyTheme() {
    document.body.dataset.theme = OS.settings.theme;
    document.body.dataset.taskbar = OS.settings.taskbarStyle;
    document.documentElement.style.setProperty('--accent', OS.settings.accent);
  }

  // ===================== FILE ICONS =====================
  function fileIcon(path) {
    const st = VFS.stat(path);
    if (!st) return '❔';
    if (st.type === 'dir') {
      const b = VFS.basename(path);
      return { Desktop: '🖥️', Documents: '📂', Pictures: '🖼️', Music: '🎵', apps: '🧩', Downloads: '📥', '.trash': '🗑️' }[b] || '📁';
    }
    const e = VFS.ext(path);
    try {
      if (e === 'esl') return ESL.parse(VFS.read(path)).meta.icon;
      if (e === 'hsl') return HSL.iconFor(VFS.read(path));
    } catch {}
    return { log: '📜', txt: '📄', md: '📝', png: '🖼️', jpg: '🖼️', json: '🧾', js: '🟨', html: '🌐', css: '🎨', csv: '📊', mp3: '🎵', note: '🗒️' }[e] || '📄';
  }
  function displayName(path) {
    const b = VFS.basename(path);
    if (VFS.ext(b) === 'hsl') { try { return HSL.parse(VFS.read(path)).name || b.replace(/\.hsl$/, ''); } catch {} }
    if (VFS.ext(b) === 'esl') { try { return ESL.parse(VFS.read(path)).meta.name; } catch {} }
    return b;
  }

  // ===================== DESKTOP ICONS =====================
  let selected = null;
  function renderIcons() {
    const box = $('#desktop-icons'); box.innerHTML = '';
    if (!VFS.isDir(DESK())) VFS.mkdir(DESK());
    const items = VFS.list(DESK());
    const H = box.getBoundingClientRect().height || innerHeight - 90;
    const perCol = Math.max(1, Math.floor((H - 10) / 96));
    items.forEach((name, i) => {
      const path = VFS.join(DESK(), name);
      const pos = OS.settings.iconPos[name] || { x: 10 + Math.floor(i / perCol) * 92, y: 10 + (i % perCol) * 96 };
      const isLink = VFS.ext(name) === 'hsl';
      const el = h('div', { class: 'dicon', title: name, style: { left: pos.x + 'px', top: pos.y + 'px' } },
        h('div', { class: 'dicon-img' }, fileIcon(path), isLink ? h('span', { class: 'link-badge' }, '↗') : ''),
        h('div', { class: 'dicon-label' }, displayName(path)));
      el.addEventListener('dblclick', () => OS.openFile(path));
      el.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        select(el);
        const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop; let moved = false;
        el.setPointerCapture(e.pointerId);
        const mv = ev => { if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return; moved = true; el.style.left = ox + ev.clientX - sx + 'px'; el.style.top = oy + ev.clientY - sy + 'px'; };
        const up = () => {
          el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up);
          if (moved) {
            const x = Math.max(0, Math.round(el.offsetLeft / 92) * 92 + 10), y = Math.max(0, Math.round((el.offsetTop - 10) / 96) * 96 + 10);
            el.style.left = x + 'px'; el.style.top = y + 'px';
            OS.settings.iconPos[name] = { x, y }; OS.saveSettings();
          }
        };
        el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
      });
      el.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); select(el); iconMenu(e, path); });
      box.append(el);
    });
  }
  function select(el) { if (selected) selected.classList.remove('sel'); selected = el; if (el) el.classList.add('sel'); }

  function iconMenu(e, path) {
    const ext = VFS.ext(path);
    const items = [{ icon: '▶️', label: 'Open', action: () => OS.openFile(path) }];
    if (ext === 'esl') items.push({ icon: '🛠️', label: 'Edit in App Maker', action: () => OS.launch('appmaker', { path }) });
    if (ext === 'log') items.push({ icon: '📝', label: 'Edit script', action: () => OS.launch('editor', { path }) });
    if (ext === 'hsl') items.push({ icon: '📝', label: 'Edit shortcut', action: () => OS.launch('editor', { path }) });
    items.push('-',
      { icon: '✏️', label: 'Rename', action: () => renameFile(path) },
      { icon: '🔗', label: 'Create shortcut', action: () => { HSL.create(DESK(), displayName(path) + ' - Shortcut', path, fileIcon(path)); } },
      { icon: '🗑️', label: 'Move to Trash', action: () => trash(path) },
      '-', { icon: 'ℹ️', label: 'Properties', action: () => properties(path) });
    OS.contextMenu(e.clientX, e.clientY, items);
  }

  async function renameFile(path) {
    const n = await OS.prompt('New name:', VFS.basename(path), 'Rename');
    if (!n || n === VFS.basename(path)) return;
    try {
      const old = VFS.basename(path);
      VFS.mv(path, VFS.join(VFS.dirname(path), n));
      if (OS.settings.iconPos[old]) { OS.settings.iconPos[n] = OS.settings.iconPos[old]; delete OS.settings.iconPos[old]; OS.saveSettings(); }
    } catch (err) { OS.alert(err.message, 'Rename', '⚠️'); }
  }
  function trash(path) {
    const T = VFS.home() + '/.trash';
    VFS.mkdir(T);
    try { VFS.mv(path, VFS.uniqueName(T, VFS.basename(path).replace(/(\.[^.]+)$/, ''), (VFS.basename(path).match(/\.[^.]+$/) || [''])[0])); OS.Sound.blip(300, 0.08); }
    catch (err) { OS.alert(err.message, 'Trash', '⚠️'); }
  }
  function properties(path) {
    const st = VFS.stat(path);
    const lines = [`Name: ${VFS.basename(path)}`, `Location: ${VFS.dirname(path)}`, `Type: ${st.type === 'dir' ? 'Folder' : (VFS.ext(path) || 'file').toUpperCase() + ' file'}`,
      st.type === 'dir' ? `Items: ${st.size}` : `Size: ${OS.fmtSize(st.size)}`, `Modified: ${new Date(st.mtime).toLocaleString()}`, `Permissions: ${st.type === 'dir' ? 'd' : '-'}${st.mode}`];
    OS.alert(h('pre', { class: 'props' }, lines.join('\n')), 'Properties', fileIcon(path));
  }

  function desktopMenu(e) {
    OS.contextMenu(e.clientX, e.clientY, [
      { icon: '📁', label: 'New Folder', action: () => { VFS.mkdir(VFS.uniqueName(DESK(), 'New Folder')); } },
      { icon: '📄', label: 'New Text File', action: () => { const p = VFS.uniqueName(DESK(), 'New File', '.txt'); VFS.write(p, ''); OS.launch('editor', { path: p }); } },
      { icon: '📜', label: 'New Batch Script (.log)', action: () => { const p = VFS.uniqueName(DESK(), 'script', '.log'); VFS.write(p, '# RocketOS batch script\necho Hello from batch!\n'); OS.launch('editor', { path: p }); } },
      { icon: '🔗', label: 'New Shortcut (.hsl)…', action: newShortcut },
      { icon: '🧩', label: 'New App (.esl)…', action: () => OS.launch('appmaker') },
      '-',
      { icon: '🖼️', label: 'Change Wallpaper…', action: () => OS.launch('settings', { page: 'personalize' }) },
      { icon: '🧱', label: 'Widgets…', action: () => OS.launch('settings', { page: 'widgets' }) },
      { icon: '💻', label: 'Open Terminal here', action: () => OS.launch('terminal', { cwd: DESK() }) },
      { icon: '🔃', label: 'Arrange Icons', action: () => { OS.settings.iconPos = {}; OS.saveSettings(); renderIcons(); } },
      { icon: '🔄', label: 'Refresh', action: renderIcons },
    ]);
  }
  async function newShortcut() {
    const target = await OS.prompt('Shortcut target — an app id (e.g. app:snake), a path (/home/user/Documents) or url:https://…', 'app:calculator', 'New Shortcut', { icon: '🔗' });
    if (!target) return;
    const name = await OS.prompt('Shortcut name:', target.replace(/^(app|url):/, '').split('/').pop() || 'Shortcut', 'New Shortcut', { icon: '🔗' });
    if (!name) return;
    HSL.create(DESK(), name, target);
  }

  // ===================== POPUPS =====================
  let openPopup = null;
  function popup(anchor, content, opts = {}) {
    if (openPopup) { const same = openPopup.anchor === anchor; closePopup(); if (same) return null; }
    const p = h('div', { class: 'popup ' + (opts.class || '') }, content);
    $('#popups').append(p);
    const r = anchor.getBoundingClientRect(), pr = p.getBoundingClientRect();
    let left = opts.align === 'left' ? r.left : r.right - pr.width;
    left = Math.max(6, Math.min(left, innerWidth - pr.width - 6));
    if (opts.from === 'top') p.style.top = (r.bottom + 6) + 'px'; else p.style.bottom = (innerHeight - r.top + 6) + 'px';
    p.style.left = left + 'px';
    openPopup = { el: p, anchor, onClose: opts.onClose };
    return p;
  }
  function closePopup() { if (openPopup) { openPopup.el.remove(); openPopup.onClose && openPopup.onClose(); openPopup = null; } }
  document.addEventListener('pointerdown', e => {
    if (openPopup && !openPopup.el.contains(e.target) && !openPopup.anchor.contains(e.target)) closePopup();
    const sm = $('#startmenu');
    if (sm && !sm.classList.contains('hidden') && !sm.contains(e.target) && !e.target.closest('.start-btn')) toggleStart(false);
  });

  // ===================== TOPBAR =====================
  function buildTopbar() {
    const tb = $('#topbar'); tb.innerHTML = '';
    const logo = h('button', { class: 'tb-logo', title: 'RocketOS menu' }, '🚀');
    const appName = h('b', { class: 'tb-app' }, 'Desktop');
    const menus = h('div', { class: 'tb-menus' });
    const mk = (label, items) => { const b = h('button', { class: 'tb-menu' }, label); b.addEventListener('click', e => { const r = b.getBoundingClientRect(); OS.contextMenu(r.left, r.bottom + 2, typeof items === 'function' ? items() : items); }); return b; };
    logo.addEventListener('click', () => { const r = logo.getBoundingClientRect(); OS.contextMenu(r.left, r.bottom + 2, [
      { icon: '🚀', label: 'About RocketOS', action: () => OS.launch('about') },
      { icon: '⚙️', label: 'System Settings…', action: () => OS.launch('settings') },
      { icon: '🛍️', label: 'App Store…', action: () => OS.launch('store') },
      '-', { icon: '🔒', label: 'Lock Screen', hint: '', action: () => Boot.lock() },
      { icon: '🔄', label: 'Restart…', action: () => Boot.power('restart') },
      { icon: '🔌', label: 'Shut Down…', action: () => Boot.power('shutdown') }]); });
    menus.append(
      mk('File', () => [
        { icon: '🪟', label: 'New Window', action: () => { const f = WM.focused; f && f.appId && OS.getApp(f.appId) ? OS.launch(f.appId) : OS.launch('files'); } },
        { icon: '📂', label: 'Open File…', action: async () => { const p = await OS.prompt('Path to open:', VFS.home() + '/Documents', 'Open'); if (p) OS.openFile(VFS.normalize(p, VFS.home())); } },
        { icon: '▶️', label: 'Run…', action: runDialog },
        '-', { icon: '✖️', label: 'Close Window', hint: 'Alt+F4', disabled: !WM.focused, action: () => WM.focused && WM.focused.close() }]),
      mk('Window', () => [
        { icon: '➖', label: 'Minimize', disabled: !WM.focused, action: () => WM.focused && WM.focused.minimize() },
        { icon: '⬜', label: 'Maximize / Restore', disabled: !WM.focused, action: () => WM.focused && WM.focused.toggleMax() },
        '-', { icon: '🗂️', label: 'Cascade Windows', action: WM.cascade },
        { icon: '🔲', label: 'Tile Windows', action: WM.tile },
        { icon: '🖥️', label: 'Show Desktop', hint: 'Ctrl+Alt+D', action: WM.showDesktop },
        { icon: '🧹', label: 'Close All', action: WM.closeAll }]),
      mk('Go', () => [
        { icon: '🏠', label: 'Home', action: () => OS.launch('files', { path: VFS.home() }) },
        { icon: '🖥️', label: 'Desktop', action: () => OS.launch('files', { path: DESK() }) },
        { icon: '📂', label: 'Documents', action: () => OS.launch('files', { path: VFS.home() + '/Documents' }) },
        { icon: '🧩', label: 'Applications', action: () => OS.launch('files', { path: '/apps' }) },
        { icon: '💾', label: 'Root ( / )', action: () => OS.launch('files', { path: '/' }) }]),
      mk('Help', () => [
        { icon: '📘', label: 'RocketOS Guide', action: () => OS.launch('help') },
        { icon: '🤖', label: 'Ask Rocky AI', action: () => OS.launch('rocky') },
        { icon: '⌨️', label: 'Keyboard Shortcuts', action: () => OS.alert(h('pre', { class: 'props' }, 'Ctrl+Alt+T   Terminal\nCtrl+Alt+D   Show desktop\nAlt+F4       Close window\nCtrl+Space   Search\nMeta/Ctrl+Esc  Start menu'), 'Shortcuts', '⌨️') }]));

    const right = h('div', { class: 'tb-right' });
    const tbBtn = (html, title, fn) => { const b = h('button', { class: 'tb-btn', title, html }); b.addEventListener('click', () => fn(b)); return b; };
    const wifiBtn = tbBtn('', 'Wi-Fi', b => wifiPopup(b, 'top'));
    const batt = h('span', { class: 'tb-batt', title: 'Battery' }, '🔋');
    const clock = h('button', { class: 'tb-clock' });
    clock.addEventListener('click', () => calendarPopup(clock, 'top'));
    right.append(
      tbBtn('🔍', 'Search (Ctrl+Space)', () => Spotlight.toggle()),
      tbBtn('🧱', 'Toggle widgets', () => Widgets.toggleLayer()),
      tbBtn('🤖', 'Rocky AI assistant', () => OS.launch('rocky')),
      tbBtn('🎛️', 'Control center', b => controlCenter(b)),
      wifiBtn, batt, clock,
      tbBtn('🔔', 'Notifications', b => notifCenter(b, 'top')));
    tb.append(logo, appName, menus, h('div', { class: 'tb-spacer' }), right);

    const tick = () => {
      const d = new Date();
      clock.textContent = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + '  ' + OS.fmtTime(d);
    };
    tick(); setInterval(tick, 1000);
    const wifiUpd = () => { const s = NET.status(); wifiBtn.innerHTML = s.icon; wifiBtn.title = 'Wi-Fi: ' + s.text; };
    wifiUpd(); OS.on('net', wifiUpd); OS.on('net-tick', wifiUpd);
    OS.on('wm', () => { const f = WM.focused; appName.textContent = f ? f.title : 'Desktop'; });
    Battery.watch(t => { batt.textContent = t; });
  }

  // ===================== TASKBAR =====================
  function buildTaskbar() {
    const tb = $('#taskbar'); tb.innerHTML = '';
    const start = h('button', { class: 'start-btn' }, h('span', { class: 'start-logo' }, '🚀'), h('span', { class: 'start-label' }, 'Start'));
    start.addEventListener('click', () => toggleStart());
    const quick = h('div', { class: 'quick' });
    const tasks = h('div', { class: 'tasks' });
    const cpu = h('canvas', { class: 'cpu-meter', width: 60, height: 26, title: 'CPU usage — click for System Monitor' });
    cpu.addEventListener('click', () => OS.launch('sysmon'));
    const tray = h('div', { class: 'tray' });
    const trayBtn = (html, title, fn) => { const b = h('button', { class: 'tray-btn', title, html }); b.addEventListener('click', () => fn(b)); return b; };
    const wifi = trayBtn('', 'Wi-Fi', b => wifiPopup(b));
    const vol = trayBtn('🔊', 'Volume', b => volumePopup(b));
    const batt = h('span', { class: 'tray-batt' });
    const bell = trayBtn('🔔', 'Notifications', b => notifCenter(b));
    const ai = trayBtn('🤖', 'Rocky AI', () => OS.launch('rocky'));
    const clock = h('button', { class: 'tray-clock' }, h('div', { class: 't' }), h('div', { class: 'd' }));
    clock.addEventListener('click', () => calendarPopup(clock));
    const showDesk = h('button', { class: 'show-desktop', title: 'Show desktop' });
    showDesk.addEventListener('click', WM.showDesktop);
    tray.append(ai, wifi, vol, batt, bell);
    tb.append(start, quick, tasks, cpu, tray, clock, showDesk);

    const renderQuick = () => {
      quick.innerHTML = '';
      quick.style.display = OS.settings.quickLaunch.length ? '' : 'none';
      OS.settings.quickLaunch.forEach(id => { const a = OS.getApp(id); if (!a) return;
        const b = h('button', { class: 'ql', title: a.name }, a.icon);
        b.addEventListener('click', () => OS.launch(id));
        b.addEventListener('contextmenu', e => { e.preventDefault(); OS.contextMenu(e.clientX, e.clientY, [{ icon: '▶️', label: 'Open ' + a.name, action: () => OS.launch(id) }, { icon: '📌', label: 'Remove from Quick Launch', action: () => { OS.settings.quickLaunch = OS.settings.quickLaunch.filter(x => x !== id); OS.saveSettings(); renderQuick(); } }]); });
        quick.append(b); });
    };
    renderQuick(); OS.on('settings', renderQuick);

    // task buttons with hover preview
    let previewEl = null, previewTimer = null;
    const hidePreview = () => { clearTimeout(previewTimer); if (previewEl) { previewEl.remove(); previewEl = null; } };
    const showPreview = (btn, w) => {
      hidePreview();
      previewTimer = setTimeout(() => {
        const r = btn.getBoundingClientRect();
        const app = OS.getApp(w.appId);
        previewEl = h('div', { class: 'task-preview' },
          h('div', { class: 'tp-head' }, h('span', {}, w.icon), h('b', {}, w.title), h('button', { class: 'tp-x', onclick: () => { w.close(); hidePreview(); } }, '×')),
          h('div', { class: 'tp-body' }, h('div', { class: 'tp-big' }, w.icon), h('div', { class: 'tp-meta' }, `${app ? app.category : 'App'} · PID ${w.proc ? w.proc.pid : '—'}`, h('br'), w.minimized ? 'Minimized' : w.maximized ? 'Maximized' : 'Window')));
        previewEl.addEventListener('mouseleave', hidePreview);
        document.body.append(previewEl);
        previewEl.style.left = Math.max(4, Math.min(innerWidth - 230, r.left + r.width / 2 - 110)) + 'px';
        previewEl.style.bottom = (innerHeight - r.top + 8) + 'px';
      }, 450);
    };
    const renderTasks = () => {
      tasks.innerHTML = '';
      // pinned apps without windows show as faint buttons, running apps grouped
      const ws = WM.list().filter(w => !w.noTaskbar);
      const shownPinned = new Set();
      OS.settings.pinned.forEach(id => {
        const a = OS.getApp(id); if (!a) return;
        if (ws.some(w => w.appId === id)) return;
        shownPinned.add(id);
        const b = h('button', { class: 'task pinned', title: a.name }, h('span', { class: 'ti' }, a.icon));
        b.addEventListener('click', () => OS.launch(id));
        b.addEventListener('contextmenu', e => { e.preventDefault(); OS.contextMenu(e.clientX, e.clientY, [{ icon: '▶️', label: 'Open', action: () => OS.launch(id) }, { icon: '📍', label: 'Unpin from taskbar', action: () => { OS.settings.pinned = OS.settings.pinned.filter(x => x !== id); OS.saveSettings(); renderTasks(); } }]); });
        tasks.append(b);
      });
      ws.forEach(w => {
        const b = h('button', { class: 'task' + (w.isFocused ? ' active' : '') + (w.minimized ? ' min' : '') },
          h('span', { class: 'ti' }, w.icon), h('span', { class: 'tl' }, w.title));
        b.addEventListener('click', () => { if (w.isFocused && !w.minimized) w.minimize(); else w.restore(); });
        b.addEventListener('mouseenter', () => showPreview(b, w));
        b.addEventListener('mouseleave', e => { if (!previewEl || !previewEl.contains(e.relatedTarget)) hidePreview(); });
        b.addEventListener('contextmenu', e => {
          e.preventDefault(); hidePreview();
          const pinned = OS.settings.pinned.includes(w.appId);
          OS.contextMenu(e.clientX, e.clientY, [
            { icon: '🔼', label: 'Restore', action: () => w.restore() },
            { icon: '➖', label: 'Minimize', action: () => w.minimize() },
            { icon: '⬜', label: w.maximized ? 'Unmaximize' : 'Maximize', action: () => { w.restore(); w.toggleMax(); } },
            '-',
            w.appId && OS.getApp(w.appId) ? { icon: '📍', label: pinned ? 'Unpin from taskbar' : 'Pin to taskbar', action: () => { OS.settings.pinned = pinned ? OS.settings.pinned.filter(x => x !== w.appId) : [...OS.settings.pinned, w.appId]; OS.saveSettings(); renderTasks(); } } : { label: 'Pin unavailable', disabled: true },
            w.appId && OS.getApp(w.appId) && !OS.settings.quickLaunch.includes(w.appId) ? { icon: '⚡', label: 'Add to Quick Launch', action: () => { OS.settings.quickLaunch.push(w.appId); OS.saveSettings(); } } : null,
            { icon: '✖️', label: 'Close window', action: () => w.close() },
          ].filter(Boolean));
        });
        tasks.append(b);
      });
    };
    OS.on('wm', renderTasks); OS.on('settings', renderTasks); renderTasks();

    // tray updates
    const t = () => { const d = new Date(); clock.querySelector('.t').textContent = OS.fmtTime(d); clock.querySelector('.d').textContent = d.toLocaleDateString(); };
    t(); setInterval(t, 1000);
    const wifiUpd = () => { const s = NET.status(); wifi.innerHTML = s.icon; wifi.title = s.text; };
    wifiUpd(); OS.on('net', wifiUpd); OS.on('net-tick', wifiUpd);
    const volUpd = () => vol.textContent = OS.settings.volume == 0 ? '🔇' : OS.settings.volume < 40 ? '🔈' : OS.settings.volume < 75 ? '🔉' : '🔊';
    volUpd(); OS.on('settings', volUpd);
    Battery.watch(text => batt.textContent = text);
    const bellUpd = () => bell.textContent = OS.settings.dnd ? '🔕' : '🔔';
    bellUpd(); OS.on('settings', bellUpd);

    // cpu meter (simulated load driven by open windows + random jitter)
    const ctx = cpu.getContext('2d'); const hist = Array(30).fill(5);
    setInterval(() => {
      cpu.style.display = OS.settings.showCpuMeter ? '' : 'none';
      const load = SysStats.cpu();
      hist.push(load); hist.shift();
      ctx.clearRect(0, 0, 60, 26);
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#ff6b35';
      ctx.lineWidth = 1.5; ctx.beginPath();
      hist.forEach((v, i) => { const x = i * 2, y = 24 - v / 100 * 22; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
      ctx.fillStyle = '#fff9'; ctx.font = '9px monospace'; ctx.fillText(Math.round(load) + '%', 36, 10);
    }, 1000);
  }

  // ===================== CLASSIC START MENU =====================
  function buildStart() {
    const sm = $('#startmenu'); sm.innerHTML = '';
    const cats = {};
    OS.listApps().forEach(a => (cats[a.category] = cats[a.category] || []).push(a));
    const appItem = a => ({ icon: a.icon, label: a.name, action: () => OS.launch(a.id) });
    const eslItems = dir => { try { return VFS.list(dir).filter(n => n.endsWith('.esl')).map(n => { const p = VFS.join(dir, n); const m = ESL.parse(VFS.read(p)).meta; return { icon: m.icon, label: m.name, action: () => OS.openFile(p) }; }); } catch { return []; } };
    const order = ['Accessories', 'Internet', 'Media', 'Development', 'System', 'Games'];
    const programs = order.filter(c => cats[c]).map(c => ({ icon: { Accessories: '🧰', Internet: '🌐', Media: '🎞️', Development: '🛠️', System: '⚙️', Games: '🎮' }[c], label: c, sub: cats[c].sort((a, b) => a.name.localeCompare(b.name)).map(appItem) }));
    const mine = eslItems(VFS.home() + '/apps'), store = eslItems('/apps/store');
    programs.push({ icon: '🧩', label: 'My Apps', sub: mine.length ? mine : [{ label: '(empty — build one in App Maker)', disabled: true }] });
    if (store.length) programs.push({ icon: '🛍️', label: 'Store Apps', sub: store });
    programs.push('-', { icon: '💻', label: 'Terminal', action: () => OS.launch('terminal') }, { icon: '📁', label: 'File Manager', action: () => OS.launch('files') });
    const recent = (OS.settings.recent || []).filter(p => VFS.exists(p)).map(p => ({ icon: fileIcon(p), label: VFS.basename(p), action: () => OS.openFile(p) }));

    const items = [
      { icon: '🗂️', label: 'Programs', big: true, sub: programs },
      { icon: '📄', label: 'Documents', big: true, sub: [{ icon: '📂', label: 'My Documents', action: () => OS.launch('files', { path: VFS.home() + '/Documents' }) }, '-', ...(recent.length ? recent : [{ label: '(no recent documents)', disabled: true }])] },
      { icon: '⚙️', label: 'Settings', big: true, sub: [
        { icon: '🎛️', label: 'Control Panel', action: () => OS.launch('settings') },
        { icon: '🖼️', label: 'Wallpaper & Theme', action: () => OS.launch('settings', { page: 'personalize' }) },
        { icon: '📶', label: 'Wi-Fi & Network', action: () => OS.launch('settings', { page: 'network' }) },
        { icon: '📊', label: 'Taskbar & Start Menu', action: () => OS.launch('settings', { page: 'taskbar' }) },
        { icon: '🧱', label: 'Widgets', action: () => OS.launch('settings', { page: 'widgets' }) }] },
      { icon: '🔍', label: 'Find…', big: true, action: () => Spotlight.toggle(true) },
      { icon: '📘', label: 'Help', big: true, action: () => OS.launch('help') },
      { icon: '▶️', label: 'Run…', big: true, action: runDialog },
      '-',
      { icon: '🛍️', label: 'App Store', big: true, action: () => OS.launch('store') },
      { icon: '🤖', label: 'Rocky AI', big: true, action: () => OS.launch('rocky') },
      '-',
      { icon: '🔒', label: `Log Off ${OS.settings.username}…`, big: true, action: () => Boot.lock() },
      { icon: '🔌', label: 'Shut Down…', big: true, action: () => Boot.power() },
    ];
    const banner = h('div', { class: 'sm-banner' }, h('span', {}, h('b', {}, 'Rocket'), 'OS ', h('small', {}, OS.version)));
    sm.append(banner, buildMenuList(items, true));
  }
  function buildMenuList(items, root = false) {
    const ul = h('div', { class: 'sm-list' + (root ? ' root' : '') });
    for (const it of items) {
      if (it === '-') { ul.append(h('div', { class: 'sm-sep' })); continue; }
      const row = h('div', { class: 'sm-item' + (it.big ? ' big' : '') + (it.disabled ? ' disabled' : '') + (it.sub ? ' has-sub' : '') },
        h('span', { class: 'sm-ico' }, it.icon || ''), h('span', { class: 'sm-label' }, it.label), it.sub ? h('span', { class: 'sm-arrow' }, '▶') : '');
      if (it.sub) {
        const sub = buildMenuList(it.sub); sub.classList.add('sm-sub'); row.append(sub);
        row.addEventListener('mouseenter', () => {
          sub.style.top = '0px'; sub.style.bottom = 'auto';
          const r = sub.getBoundingClientRect();
          if (r.bottom > innerHeight - 50) { sub.style.top = 'auto'; sub.style.bottom = '0px'; }
        });
      } else if (!it.disabled) row.addEventListener('click', e => { e.stopPropagation(); toggleStart(false); it.action && it.action(); });
      ul.append(row);
    }
    return ul;
  }
  function toggleStart(force) {
    const sm = $('#startmenu');
    const show = force != null ? force : sm.classList.contains('hidden');
    if (show) { closePopup(); buildStart(); sm.classList.remove('hidden'); OS.Sound.blip(520, 0.04); }
    else sm.classList.add('hidden');
    document.querySelector('.start-btn') && document.querySelector('.start-btn').classList.toggle('pressed', show);
  }

  // ===================== POPUP PANELS =====================
  function wifiPopup(anchor, from) {
    const box = h('div', { class: 'wifi-pop' });
    const render = (msg = '') => {
      box.innerHTML = '';
      const st = OS.settings.wifi;
      const toggle = h('label', { class: 'switch-row' }, h('span', {}, '📶 Wi-Fi'), h('input', { type: 'checkbox', class: 'switch', checked: st.enabled, onchange: e => { NET.setEnabled(e.target.checked); render(); } }));
      box.append(h('div', { class: 'pop-title' }, 'Wi-Fi Networks'), toggle);
      if (msg) box.append(h('div', { class: 'wifi-msg' }, msg));
      if (!st.enabled) { box.append(h('div', { class: 'muted pad' }, 'Wi-Fi is turned off.')); return; }
      if (!navigator.onLine) box.append(h('div', { class: 'wifi-msg warn' }, '⚠️ Your device has no internet — RocketOS will be offline.'));
      NET.scan().forEach(n => {
        const row = h('div', { class: 'wifi-row' + (n.connected ? ' on' : '') },
          h('span', { class: 'wifi-ic', html: NET.wifiIcon(NET.bars(n.signal)) }),
          h('div', { class: 'wifi-name' }, h('b', {}, n.ssid), h('small', {}, `${n.connected ? 'Connected · ' : ''}${n.security === 'Open' ? '🔓 Open' : '🔒 ' + n.security} · ${n.band}`)));
        const btn = h('button', { class: 'btn sm' }, n.connected ? 'Disconnect' : 'Connect');
        btn.addEventListener('click', async () => {
          if (n.connected) { NET.disconnect(); return render(); }
          let pw;
          if (n.security !== 'Open' && !n.known) { closePopup(); pw = await OS.prompt(`Password for “${n.ssid}”:`, '', 'Wi-Fi', { password: true, icon: '🔒' }); if (pw == null) return; }
          btn.textContent = 'Connecting…'; btn.disabled = true;
          try { await NET.connect(n.ssid, pw); OS.notify('Wi-Fi', `Connected to ${n.ssid}`, '📶'); if (box.isConnected) render(); }
          catch (err) { OS.notify('Wi-Fi', err.message, '⚠️'); if (box.isConnected) render(err.message); }
        });
        row.append(btn); box.append(row);
      });
      box.append(h('button', { class: 'link-btn', onclick: () => { closePopup(); OS.launch('settings', { page: 'network' }); } }, 'Network settings…'));
    };
    render();
    popup(anchor, box, { from });
  }
  function volumePopup(anchor) {
    const val = h('span', {}, OS.settings.volume + '%');
    const slider = h('input', { type: 'range', min: 0, max: 100, value: OS.settings.volume, class: 'vslider' });
    slider.addEventListener('input', () => { OS.settings.volume = +slider.value; val.textContent = slider.value + '%'; OS.saveSettings(); });
    slider.addEventListener('change', () => OS.Sound.blip(700, 0.08));
    popup(anchor, h('div', { class: 'vol-pop' }, h('div', { class: 'pop-title' }, '🔊 Volume ', val), slider, h('button', { class: 'btn sm', onclick: () => { OS.settings.volume = 0; OS.saveSettings(); slider.value = 0; val.textContent = '0%'; } }, 'Mute')));
  }
  function calendarPopup(anchor, from) {
    let ref = new Date(); ref.setDate(1);
    const box = h('div', { class: 'cal-pop' });
    const render = () => {
      box.innerHTML = '';
      const now = new Date();
      box.append(h('div', { class: 'cal-big' }, OS.fmtTime(now, true)), h('div', { class: 'muted' }, now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })));
      box.append(calendarGrid(ref, d => { ref = d; render(); }));
    };
    render();
    const iv = setInterval(() => box.isConnected ? (box.querySelector('.cal-big').textContent = OS.fmtTime(new Date(), true)) : clearInterval(iv), 1000);
    popup(anchor, box, { from });
  }
  function calendarGrid(ref, onNav) {
    const now = new Date();
    const head = h('div', { class: 'cal-head' }, h('button', { class: 'btn sm', onclick: () => onNav(new Date(ref.getFullYear(), ref.getMonth() - 1, 1)) }, '‹'),
      h('b', {}, ref.toLocaleDateString([], { month: 'long', year: 'numeric' })), h('button', { class: 'btn sm', onclick: () => onNav(new Date(ref.getFullYear(), ref.getMonth() + 1, 1)) }, '›'));
    const grid = h('div', { class: 'cal-grid' });
    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => grid.append(h('div', { class: 'cal-dow' }, d)));
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1).getDay(), days = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    for (let i = 0; i < first; i++) grid.append(h('div'));
    for (let d = 1; d <= days; d++) grid.append(h('div', { class: 'cal-d' + (d === now.getDate() && ref.getMonth() === now.getMonth() && ref.getFullYear() === now.getFullYear() ? ' today' : '') }, d));
    return h('div', {}, head, grid);
  }
  function notifCenter(anchor, from) {
    const box = h('div', { class: 'notif-pop' });
    const render = () => {
      box.innerHTML = '';
      box.append(h('div', { class: 'pop-title' }, 'Notifications', h('button', { class: 'link-btn', onclick: () => { OS.notifications.length = 0; render(); } }, 'Clear all')));
      box.append(h('label', { class: 'switch-row' }, h('span', {}, '🔕 Do not disturb'), h('input', { type: 'checkbox', class: 'switch', checked: OS.settings.dnd, onchange: e => OS.set('dnd', e.target.checked) })));
      if (!OS.notifications.length) box.append(h('div', { class: 'muted pad center' }, 'You’re all caught up ✨'));
      OS.notifications.slice(0, 20).forEach(n => box.append(h('div', { class: 'notif-item' }, h('span', { class: 'ni-ico' }, n.icon), h('div', {}, h('b', {}, n.title), h('div', {}, n.body), h('small', { class: 'muted' }, n.time.toLocaleTimeString())))));
    };
    render(); popup(anchor, box, { from });
  }
  function controlCenter(anchor) {
    const S = OS.settings;
    const tile = (icon, label, on, fn) => { const t = h('button', { class: 'cc-tile' + (on ? ' on' : '') }, h('span', { class: 'cc-i' }, icon), h('span', {}, label)); t.addEventListener('click', () => { fn(); t.classList.toggle('on'); }); return t; };
    const bright = h('input', { type: 'range', min: 40, max: 100, value: S.brightness || 100, class: 'vslider' });
    bright.addEventListener('input', () => { S.brightness = +bright.value; document.getElementById('os').style.filter = `brightness(${bright.value / 100})`; OS.saveSettings(); });
    const vol = h('input', { type: 'range', min: 0, max: 100, value: S.volume, class: 'vslider' });
    vol.addEventListener('input', () => { S.volume = +vol.value; OS.saveSettings(); });
    const box = h('div', { class: 'cc-pop' },
      h('div', { class: 'cc-grid' },
        tile('📶', 'Wi-Fi', S.wifi.enabled, () => NET.setEnabled(!S.wifi.enabled)),
        tile('🌙', 'Dark mode', S.theme === 'dark', () => { OS.set('theme', S.theme === 'dark' ? 'light' : 'dark'); applyTheme(); }),
        tile('🔕', 'Focus', S.dnd, () => OS.set('dnd', !S.dnd)),
        tile('🧱', 'Widgets', !Widgets.hidden, () => Widgets.toggleLayer()),
        tile('🦷', 'Bluetooth', S.bt, () => OS.set('bt', !S.bt)),
        tile('✈️', 'Airplane', S.airplane, () => { OS.set('airplane', !S.airplane); NET.setEnabled(!S.airplane); })),
      h('div', { class: 'cc-sl' }, '☀️', bright), h('div', { class: 'cc-sl' }, '🔊', vol),
      h('div', { class: 'cc-foot' }, h('button', { class: 'btn sm', onclick: () => { closePopup(); OS.launch('settings'); } }, '⚙️ Settings'), h('button', { class: 'btn sm', onclick: () => { closePopup(); Boot.power(); } }, '🔌 Power')));
    popup(anchor, box, { from: 'top' });
  }

  async function runDialog() {
    const cmd = await OS.prompt('Type the name of a program, folder, file, URL or shell command:', '', 'Run', { icon: '▶️' });
    if (!cmd) return;
    const c = cmd.trim();
    if (OS.getApp(c)) return OS.launch(c);
    const app = OS.listApps().find(a => a.name.toLowerCase() === c.toLowerCase());
    if (app) return OS.launch(app.id);
    if (/^https?:\/\//.test(c)) return OS.launch('browser', { url: c });
    const p = VFS.normalize(c, VFS.home());
    if (VFS.exists(p)) return OS.openFile(p);
    OS.launch('terminal', { run: c });
  }

  // ===================== INIT =====================
  function init() {
    applyTheme(); applyWallpaper();
    if (OS.settings.brightness) document.getElementById('os').style.filter = `brightness(${OS.settings.brightness / 100})`;
    buildTopbar(); buildTaskbar(); renderIcons();
    const desk = $('#desktop');
    desk.addEventListener('contextmenu', e => { if (e.target.closest('.window') || e.target.closest('.widget')) return; e.preventDefault(); desktopMenu(e); });
    desk.addEventListener('pointerdown', e => { if (!e.target.closest('.dicon')) select(null); });
    let t; VFS.on('change', p => { if (p.startsWith(DESK()) || p.startsWith(VFS.home() + '/.trash')) { clearTimeout(t); t = setTimeout(renderIcons, 50); } });
    OS.on('settings', () => { applyTheme(); applyWallpaper(); });
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(renderIcons, 200); });
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey && e.key === 'Escape') || e.key === 'Meta') { e.preventDefault(); toggleStart(); }
      if (e.key === 'Escape') { toggleStart(false); closePopup(); }
    });
  }

  return { init, renderIcons, applyWallpaper, applyTheme, wallpapers, fileIcon, displayName, toggleStart, popup, closePopup, runDialog, trash, renameFile, properties, calendarGrid, newShortcut };
})();

/* ---------- Battery (real Battery API when available, otherwise AC power) */
const Battery = (() => {
  const subs = []; let text = '🔌 AC';
  if (navigator.getBattery) navigator.getBattery().then(b => {
    const upd = () => { text = (b.charging ? '⚡' : b.level < 0.2 ? '🪫' : '🔋') + Math.round(b.level * 100) + '%'; subs.forEach(f => f(text)); };
    upd(); b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd);
  }).catch(() => {});
  return { watch(fn) { subs.push(fn); fn(text); }, set(t) { text = t; subs.forEach(f => f(t)); } };
})();

/* ---------- Simulated system statistics */
const SysStats = (() => {
  let last = 8;
  function cpu() {
    const base = 4 + WM.list().length * 3 + OS.procs.length;
    last = Math.max(1, Math.min(99, last * 0.6 + (base + Math.random() * 18) * 0.4));
    return last;
  }
  function mem() {
    const total = 8192;
    let used = 900 + OS.procs.reduce((s, p) => s + p.mem, 0) * 4;
    if (performance.memory) used += performance.memory.usedJSHeapSize / 1048576;
    return { total, used: Math.min(total, Math.round(used)) };
  }
  return { cpu, mem };
})();

/* ---------- Spotlight-style search */
const Spotlight = (() => {
  let el = null;
  function toggle(force) {
    if (el && force !== true) { el.remove(); el = null; return; }
    if (el) return;
    const { h } = OS;
    const input = h('input', { class: 'spot-input', placeholder: 'Search apps, files, settings…   (= for math, > for commands)' });
    const results = h('div', { class: 'spot-results' });
    el = h('div', { class: 'spotlight' }, h('div', { class: 'spot-box' }, h('div', { class: 'spot-row' }, '🔍', input), results));
    el.addEventListener('pointerdown', e => { if (e.target === el) toggle(); });
    document.getElementById('popups').append(el);
    input.focus();
    let items = [], sel = 0;
    const render = () => {
      const q = input.value.trim().toLowerCase(); results.innerHTML = ''; items = [];
      if (!q) { results.append(h('div', { class: 'muted pad' }, 'Try “snake”, “wifi”, “notes.txt”, “= 12*7” or “> ls”')); return; }
      if (q.startsWith('=')) { try { const v = Calc.eval(q.slice(1)); items.push({ icon: '🧮', label: `= ${v}`, sub: 'Calculator result — Enter to copy', act: () => navigator.clipboard && navigator.clipboard.writeText(String(v)) }); } catch { items.push({ icon: '🧮', label: '…', sub: 'Invalid expression', act: () => {} }); } }
      else if (q.startsWith('>')) items.push({ icon: '💻', label: q.slice(1).trim(), sub: 'Run in Terminal', act: () => OS.launch('terminal', { run: input.value.trim().slice(1).trim() }) });
      else {
        OS.listApps().filter(a => a.name.toLowerCase().includes(q) || a.id.includes(q) || (a.desc || '').toLowerCase().includes(q)).slice(0, 8)
          .forEach(a => items.push({ icon: a.icon, label: a.name, sub: a.category + ' · App', act: () => OS.launch(a.id) }));
        const settingsMap = [['wallpaper', 'personalize'], ['theme', 'personalize'], ['wifi', 'network'], ['network', 'network'], ['taskbar', 'taskbar'], ['widgets', 'widgets'], ['ai', 'ai'], ['password', 'users'], ['user', 'users'], ['about', 'system'], ['reset', 'system']];
        settingsMap.filter(([k]) => k.includes(q) || q.includes(k)).slice(0, 3).forEach(([k, page]) => items.push({ icon: '⚙️', label: 'Settings: ' + k, sub: 'Control Panel', act: () => OS.launch('settings', { page }) }));
        const files = [];
        VFS.walk('/', (p, n) => { if (files.length < 10 && p !== '/' && VFS.basename(p).toLowerCase().includes(q)) files.push(p); });
        files.forEach(p => items.push({ icon: Desktop.fileIcon(p), label: VFS.basename(p), sub: p, act: () => OS.openFile(p) }));
        items.push({ icon: '🤖', label: `Ask Rocky: “${input.value.trim()}”`, sub: 'AI assistant', act: () => OS.launch('rocky', { ask: input.value.trim() }) });
        items.push({ icon: '🌐', label: `Search the web for “${input.value.trim()}”`, sub: 'Rocket Browser', act: () => OS.launch('browser', { url: 'https://duckduckgo.com/?q=' + encodeURIComponent(input.value.trim()) }) });
      }
      sel = 0;
      items.forEach((it, i) => { const r = h('div', { class: 'spot-item' + (i === sel ? ' sel' : '') }, h('span', { class: 'si-ico' }, it.icon), h('div', {}, h('b', {}, it.label), h('small', {}, it.sub))); r.addEventListener('click', () => { it.act(); toggle(); }); results.append(r); });
    };
    input.addEventListener('input', render);
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') toggle();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length); [...results.children].forEach((c, i) => c.classList.toggle('sel', i === sel)); }
      if (e.key === 'Enter' && items[sel]) { items[sel].act(); toggle(); }
    });
    render();
  }
  document.addEventListener('keydown', e => { if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); toggle(); } });
  return { toggle };
})();

/* ---------- Safe math evaluator (used by calculator, spotlight, terminal) */
const Calc = (() => {
  const fns = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sqrt: Math.sqrt, abs: Math.abs, log: Math.log10, ln: Math.log, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round, min: Math.min, max: Math.max, pow: Math.pow };
  const consts = { pi: Math.PI, e: Math.E };
  function evaluate(src) {
    const s = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/\s+/g, '');
    let i = 0;
    const peek = () => s[i], eat = c => { if (s[i] === c) { i++; return true; } return false; };
    function expr() { let v = term(); for (;;) { if (eat('+')) v += term(); else if (eat('-')) v -= term(); else return v; } }
    function term() { let v = factor(); for (;;) { if (eat('*')) v *= factor(); else if (eat('/')) v /= factor(); else if (eat('%')) v %= factor(); else return v; } }
    function factor() { let v = unary(); if (eat('^')) v = Math.pow(v, factor()); return v; }
    function unary() { if (eat('-')) return -unary(); if (eat('+')) return unary(); return postfix(primary()); }
    function postfix(v) { while (eat('!')) { let r = 1; for (let k = 2; k <= v; k++) r *= k; v = r; } return v; }
    function primary() {
      if (eat('(')) { const v = expr(); if (!eat(')')) throw new Error('Missing )'); return v; }
      let m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
      if (m) { i += m[0].length; return parseFloat(m[0]); }
      m = s.slice(i).match(/^[a-z]+/i);
      if (m) {
        const name = m[0].toLowerCase(); i += m[0].length;
        if (name in consts) return consts[name];
        if (fns[name]) { if (!eat('(')) throw new Error('Expected ('); const args = [expr()]; while (eat(',')) args.push(expr()); if (!eat(')')) throw new Error('Missing )'); return fns[name](...args); }
        throw new Error('Unknown: ' + name);
      }
      throw new Error('Unexpected ' + (peek() || 'end'));
    }
    const v = expr();
    if (i < s.length) throw new Error('Unexpected ' + s[i]);
    return Math.round(v * 1e12) / 1e12;
  }
  return { eval: evaluate };
})();
