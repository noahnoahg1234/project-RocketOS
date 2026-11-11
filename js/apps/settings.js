/* Control Panel / Settings */
OS.registerApp({ id: 'settings', name: 'Settings', icon: '⚙️', category: 'System', width: 760, height: 520, singleton: true, desc: 'Control panel: wallpaper, theme, Wi-Fi, widgets, AI, users',
  onReopen(win, args) { if (args.page && win._go) win._go(args.page); },
  launch(win, args = {}) {
    const { h } = OS, S = OS.settings;
    const pages = { personalize: ['🎨', 'Personalize'], taskbar: ['📊', 'Taskbar & Start'], widgets: ['🧱', 'Widgets'], network: ['📶', 'Wi-Fi & Network'], ai: ['🤖', 'Rocky AI'], users: ['👤', 'Users & Login'], sound: ['🔊', 'Sound'], system: ['💻', 'System'] };
    let page = pages[args.page] ? args.page : 'personalize';
    const nav = h('div', { class: 'set-nav' }), body = h('div', { class: 'set-body' });
    win.body.append(h('div', { class: 'settings' }, nav, body));
    const row = (label, ctrl, hint) => h('div', { class: 'set-row' }, h('div', {}, h('div', {}, label), hint ? h('small', { class: 'muted' }, hint) : ''), ctrl);
    const toggle = (val, fn) => h('input', { type: 'checkbox', class: 'switch', checked: !!val, onchange: e => fn(e.target.checked) });
    const go = p => { page = p; render(); };
    win._go = go;

    function render() {
      nav.innerHTML = ''; body.innerHTML = '';
      Object.entries(pages).forEach(([k, [i, n]]) => nav.append(h('div', { class: 'set-link' + (k === page ? ' on' : ''), onclick: () => go(k) }, i + '  ' + n)));
      body.append(h('h2', {}, pages[page][0] + ' ' + pages[page][1]));
      ({ personalize, taskbar, widgets, network, ai, users, sound, system })[page]();
    }

    function personalize() {
      const grid = h('div', { class: 'wp-grid' });
      Object.entries(Desktop.wallpapers).forEach(([k, w]) => {
        const t = h('div', { class: 'wp-tile' + (S.wallpaper === k ? ' on' : ''), title: w.name }, h('div', { class: 'wp-prev', style: { background: w.css } }), h('small', {}, w.name));
        t.onclick = () => { OS.set('wallpaper', k); render(); };
        grid.append(t);
      });
      const custom = h('input', { class: 'input', placeholder: 'Image URL, #hex color or CSS gradient', value: S.wallpaperCustom || '' });
      const upload = h('input', { type: 'file', accept: 'image/*', class: 'hidden' });
      upload.onchange = () => { const f = upload.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { S.wallpaperCustom = r.result; OS.set('wallpaper', 'custom'); render(); }; r.readAsDataURL(f); };
      body.append(h('h3', {}, 'Wallpaper'), grid,
        row('Custom wallpaper', h('div', { class: 'row' }, custom, h('button', { class: 'btn', onclick: () => { S.wallpaperCustom = custom.value; OS.set('wallpaper', 'custom'); } }, 'Apply'), h('button', { class: 'btn', onclick: () => upload.click() }, 'Upload…'), upload)),
        h('h3', {}, 'Appearance'),
        row('Theme', h('div', { class: 'seg' }, ...['dark', 'light'].map(t => h('button', { class: S.theme === t ? 'on' : '', onclick: () => { OS.set('theme', t); render(); } }, t === 'dark' ? '🌙 Dark' : '☀️ Light')))),
        row('Accent color', h('div', { class: 'row' }, ...['#ff6b35', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#eab308', '#14b8a6'].map(c => h('button', { class: 'swatch big' + (S.accent === c ? ' on' : ''), style: { background: c }, onclick: () => { OS.set('accent', c); render(); } })), h('input', { type: 'color', value: S.accent, onchange: e => OS.set('accent', e.target.value) }))));
    }
    function taskbar() {
      body.append(
        row('Taskbar style', h('div', { class: 'seg' }, ...[['modern', '✨ Modern glass'], ['classic', '🪟 Classic']].map(([k, l]) => h('button', { class: S.taskbarStyle === k ? 'on' : '', onclick: () => { OS.set('taskbarStyle', k); render(); } }, l)))),
        row('Show CPU meter', toggle(S.showCpuMeter, v => OS.set('showCpuMeter', v)), 'Live usage graph in the taskbar'),
        row('Show seconds on clock', toggle(S.clockSeconds, v => OS.set('clockSeconds', v))),
        row('24-hour clock', toggle(S.clock24, v => OS.set('clock24', v))),
        h('h3', {}, 'Quick Launch & pinned apps'));
      const list = h('div', { class: 'pin-list' });
      OS.listApps().sort((a, b) => a.name.localeCompare(b.name)).forEach(a => list.append(h('div', { class: 'pin-row' }, h('span', {}, a.icon + ' ' + a.name),
        h('label', {}, h('input', { type: 'checkbox', checked: S.quickLaunch.includes(a.id), onchange: e => { S.quickLaunch = e.target.checked ? [...S.quickLaunch, a.id] : S.quickLaunch.filter(x => x !== a.id); OS.saveSettings(); } }), ' Quick launch'),
        h('label', {}, h('input', { type: 'checkbox', checked: S.pinned.includes(a.id), onchange: e => { S.pinned = e.target.checked ? [...S.pinned, a.id] : S.pinned.filter(x => x !== a.id); OS.saveSettings(); } }), ' Pinned'))));
      body.append(list);
    }
    function widgets() {
      body.append(h('p', { class: 'muted' }, 'Widgets live on the desktop. Drag them by their title bar. Toggle all widgets from the 🧱 button in the top bar.'));
      Object.entries(Widgets.defs).forEach(([id, d]) => body.append(row(d.icon + ' ' + d.title, toggle(S.widgets[id], v => { S.widgets[id] = v; OS.saveSettings(); Widgets.render(); }))));
      body.append(row('Weather city', h('select', { class: 'input', onchange: e => { OS.set('weatherCity', e.target.value); Widgets.render(); } }, ...Object.keys(Weather.cities).map(c => h('option', { selected: c === Weather.city() }, c)))),
        h('button', { class: 'btn', onclick: () => { S.widgetPos = {}; OS.saveSettings(); Widgets.render(); } }, 'Reset widget positions'));
    }
    function network() {
      const st = NET.status(), info = NET.info();
      body.append(row('Wi-Fi', toggle(S.wifi.enabled, v => { NET.setEnabled(v); render(); })),
        h('div', { class: 'card' }, h('div', { html: `<b>${st.icon} ${OS.esc(st.text)}</b>` }), info.ip ? h('small', { class: 'muted' }, `IP ${info.ip} · Gateway ${info.gateway} · DNS ${info.dns} · ${info.band} · ${info.security}`) : '',
          h('div', {}, 'Internet: ', NET.online() ? '✅ reachable' : navigator.onLine ? '❌ not connected to Wi-Fi' : '❌ your device is offline')),
        h('h3', {}, 'Available networks'));
      NET.scan().forEach(n => body.append(h('div', { class: 'set-row' }, h('div', { html: `${NET.wifiIcon(NET.bars(n.signal))} <b>${OS.esc(n.ssid)}</b> <small class="muted">${n.signal}% · ${n.security} · ${n.band}${n.known ? ' · saved' : ''}</small>` }),
        h('div', { class: 'row' }, n.connected ? h('button', { class: 'btn', onclick: () => { NET.disconnect(); render(); } }, 'Disconnect') : h('button', { class: 'btn primary', onclick: async () => {
          let pw; if (n.security !== 'Open' && !n.known) { pw = await OS.prompt(`Password for ${n.ssid}:`, '', 'Wi-Fi', { password: true, icon: '🔒' }); if (pw == null) return; }
          try { await NET.connect(n.ssid, pw); OS.notify('Wi-Fi', 'Connected to ' + n.ssid, '📶'); } catch (e) { OS.alert(e.message, 'Wi-Fi', '⚠️'); } render(); } }, 'Connect'),
          n.known ? h('button', { class: 'btn', onclick: () => { NET.forget(n.ssid); render(); } }, 'Forget') : ''))));
    }
    function ai() {
      const key = h('input', { class: 'input', type: 'password', placeholder: 'sk-ant-…', value: S.aiKey || '' });
      body.append(
        h('p', {}, 'Rocky is RocketOS’s assistant. In ', h('b', {}, 'Local'), ' mode it understands commands like “open paint”, “dark mode” or “what is 12*7” offline. ', h('b', {}, 'Cloud'), ' mode sends your messages to Claude (Anthropic) for full conversations — it needs Wi-Fi and an API key.'),
        row('Mode', h('div', { class: 'seg' }, ...[['local', '💡 Local'], ['cloud', '☁️ Cloud (Claude)']].map(([k, l]) => h('button', { class: S.aiMode === k ? 'on' : '', onclick: () => { OS.set('aiMode', k); render(); } }, l)))),
        row('Anthropic API key', h('div', { class: 'row' }, key, h('button', { class: 'btn primary', onclick: () => { OS.set('aiKey', key.value.trim()); OS.notify('Rocky AI', 'API key saved', '🤖'); } }, 'Save')), 'Stored only in this browser’s local storage. Requests go directly from your browser to api.anthropic.com.'),
        row('Clear conversation history', h('button', { class: 'btn', onclick: () => { localStorage.removeItem('rocketos.rocky'); OS.notify('Rocky AI', 'History cleared', '🧹'); } }, 'Clear')));
    }
    function users() {
      const name = h('input', { class: 'input', value: S.username }), host = h('input', { class: 'input', value: S.hostname });
      const pw = h('input', { class: 'input', type: 'password', placeholder: S.password ? '•••••• (set)' : 'No password' });
      body.append(
        h('div', { class: 'card row' }, h('div', { class: 'avatar big' }, (S.avatar || '🧑‍🚀')), h('div', {}, h('b', {}, S.username), h('div', { class: 'muted' }, 'Administrator'))),
        row('Avatar', h('div', { class: 'row' }, ...['🧑‍🚀', '👩‍💻', '👨‍💻', '🦊', '🐱', '🤖', '👾', '🐼'].map(a => h('button', { class: 'btn icon' + (S.avatar === a ? ' primary' : ''), onclick: () => { OS.set('avatar', a); render(); } }, a)))),
        row('User name', h('div', { class: 'row' }, name, h('button', { class: 'btn', onclick: async () => { const n = name.value.trim().replace(/[^\w-]/g, ''); if (!n || n === S.username) return; const oldHome = VFS.home(); OS.settings.username = n; if (!VFS.exists(VFS.home())) VFS.mv(oldHome, VFS.home()); OS.saveSettings(); Desktop.renderIcons(); OS.notify('Users', 'Renamed to ' + n + '. Home is now ' + VFS.home(), '👤'); render(); } }, 'Rename')), 'Also renames your home folder'),
        row('Computer name', h('div', { class: 'row' }, host, h('button', { class: 'btn', onclick: () => OS.set('hostname', host.value.trim() || 'rocket') }, 'Save'))),
        row('Login password', h('div', { class: 'row' }, pw, h('button', { class: 'btn', onclick: () => { OS.set('password', pw.value); OS.notify('Users', pw.value ? 'Password set' : 'Password removed', '🔒'); render(); } }, 'Set')), 'Leave empty to log in without a password'));
    }
    function sound() {
      const vol = h('input', { type: 'range', min: 0, max: 100, value: S.volume, oninput: e => OS.set('volume', +e.target.value) });
      body.append(row('Master volume', vol), row('Startup sound', toggle(S.bootSound, v => OS.set('bootSound', v))), row('Test', h('button', { class: 'btn', onclick: () => OS.Sound.startup() }, '🔔 Play test sound')));
    }
    function system() {
      const m = SysStats.mem();
      body.append(h('div', { class: 'card' }, h('b', {}, `RocketOS ${OS.version}`), h('div', { class: 'muted' }, `rocket-kernel 1.0 · ${navigator.userAgent.split(') ')[0].split(' (')[1] || 'web'}`), h('div', {}, `Memory ${m.used}/${m.total} MB · Storage ${OS.fmtSize(VFS.usage())} of ~5 MB · ${OS.listApps().length} apps`)),
        row('Export my files', h('button', { class: 'btn', onclick: () => { h('a', { href: URL.createObjectURL(new Blob([localStorage.getItem('rocketos.fs.v1') || ''], { type: 'application/json' })), download: 'rocketos-backup.json' }).click(); } }, '⬇️ Download backup')),
        row('Import backup', (() => { const f = h('input', { type: 'file', accept: '.json', class: 'hidden' }); f.onchange = () => { const r = new FileReader(); r.onload = async () => { try { JSON.parse(r.result); if (await OS.confirm('Replace all files with this backup? RocketOS will restart.')) { localStorage.setItem('rocketos.fs.v1', r.result); location.reload(); } } catch { OS.alert('That is not a valid RocketOS backup.'); } }; r.readAsText(f.files[0]); }; return h('div', {}, f, h('button', { class: 'btn', onclick: () => f.click() }, '⬆️ Restore…')); })()),
        row('Factory reset', h('button', { class: 'btn danger', onclick: async () => { if (await OS.confirm('Erase ALL files, settings and apps and restart RocketOS?', 'Factory reset', '⚠️')) { Object.keys(localStorage).filter(k => k.startsWith('rocketos.')).forEach(k => localStorage.removeItem(k)); location.reload(); } } }, '⚠️ Reset RocketOS'), 'Deletes everything stored by RocketOS in this browser'));
    }
    render();
  } });
