/* Utility apps: Calculator, Clock, Calendar, System Monitor, Notes, Weather, About, Help */
(() => {
  const { h } = OS;

  // ------------------------------------------------ Calculator
  OS.registerApp({ id: 'calculator', name: 'Calculator', icon: '🧮', category: 'Accessories', width: 320, height: 470, desc: 'Standard & scientific calculator', minWidth: 280,
    launch(win) {
      let expr = '', sci = false, last = null, mem = 0;
      const disp = h('div', { class: 'calc-disp' }), sub = h('div', { class: 'calc-sub' });
      const pad = h('div', { class: 'calc-pad' });
      const hist = h('div', { class: 'calc-hist' });
      win.body.append(h('div', { class: 'calc' }, h('div', { class: 'calc-screen' }, sub, disp), pad, hist));
      const basic = ['MC', 'MR', 'M+', 'SCI', 'C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '±', '0', '.', '='];
      const sciKeys = ['sin(', 'cos(', 'tan(', 'sqrt(', 'ln(', 'log(', '^', '!', '(', ')', 'π', 'e'];
      const show = () => { disp.textContent = expr || '0'; try { const v = expr ? Calc.eval(expr) : ''; sub.textContent = v !== '' && String(v) !== expr ? '= ' + v : ''; } catch { sub.textContent = ''; } };
      const press = k => {
        OS.Sound.blip(1200, 0.02);
        if (k === 'C') expr = '';
        else if (k === '⌫') expr = expr.slice(0, -1);
        else if (k === '=') { try { const v = Calc.eval(expr); hist.prepend(h('div', {}, `${expr} = ${v}`)); last = v; expr = String(v); } catch { sub.textContent = 'Error'; return; } }
        else if (k === '±') expr = expr.startsWith('-') ? expr.slice(1) : '-' + expr;
        else if (k === 'SCI') { sci = !sci; build(); win.setRect({ width: sci ? 440 : 320, height: 470 }); return; }
        else if (k === 'MC') mem = 0; else if (k === 'MR') expr += mem; else if (k === 'M+') { try { mem += Calc.eval(expr || '0'); } catch {} }
        else expr += k;
        show();
      };
      const build = () => {
        pad.innerHTML = ''; pad.style.gridTemplateColumns = `repeat(${sci ? 6 : 4}, 1fr)`;
        const keys = sci ? [].concat(...Array.from({ length: 6 }, (_, r) => [...sciKeys.slice(r * 2, r * 2 + 2), ...basic.slice(r * 4, r * 4 + 4)])) : basic;
        keys.forEach(k => pad.append(h('button', { class: 'calc-k' + (/[÷×\-+=]/.test(k) && k.length === 1 ? ' op' : '') + (k === '=' ? ' eq' : '') + (k === 'SCI' && sci ? ' on' : ''), onclick: () => press(k) }, k.length > 1 ? k.replace('(', '') : k)));
      };
      build(); show();
      win.body.tabIndex = 0; win.body.focus();
      win.body.addEventListener('keydown', e => {
        const map = { '*': '×', '/': '÷', Enter: '=', Backspace: '⌫', Escape: 'C' };
        const k = map[e.key] || e.key;
        if (/^[\d.+\-×÷%()^!]$/.test(k) || ['=', '⌫', 'C'].includes(k)) { e.preventDefault(); press(k); }
      });
    } });

  // ------------------------------------------------ Clock (world clock, stopwatch, timer, alarm)
  OS.registerApp({ id: 'clock', name: 'Clock', icon: '⏰', category: 'Accessories', width: 460, height: 420, desc: 'World clock, stopwatch, timer and alarms',
    launch(win) {
      const tabs = ['World', 'Stopwatch', 'Timer', 'Alarm']; let tab = 'World';
      const nav = h('div', { class: 'seg' }), body = h('div', { class: 'clock-body' });
      win.body.append(h('div', { class: 'pad' }, nav, body));
      let iv = null;
      const zones = [['Local', undefined], ['New York', 'America/New_York'], ['London', 'Europe/London'], ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'], ['Cape Canaveral', 'America/New_York'], ['Dubai', 'Asia/Dubai']];
      let sw = { t: 0, run: false, start: 0, laps: [] }, timer = { left: 300, run: false, end: 0 };
      const render = () => {
        clearInterval(iv); nav.innerHTML = ''; body.innerHTML = '';
        tabs.forEach(t => nav.append(h('button', { class: t === tab ? 'on' : '', onclick: () => { tab = t; render(); } }, t)));
        if (tab === 'World') {
          const list = h('div', { class: 'zones' }); body.append(list);
          const upd = () => { list.innerHTML = ''; zones.forEach(([n, z]) => list.append(h('div', { class: 'zone' }, h('span', {}, n), h('b', {}, new Date().toLocaleTimeString([], { timeZone: z, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !OS.settings.clock24 }))))); };
          upd(); iv = setInterval(upd, 1000);
        } else if (tab === 'Stopwatch') {
          const d = h('div', { class: 'big-time' }), laps = h('div', { class: 'laps' });
          const fmt = ms => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(Math.floor(ms / 10) % 100).padStart(2, '0')}`;
          const cur = () => sw.run ? sw.t + Date.now() - sw.start : sw.t;
          const ss = h('button', { class: 'btn primary', onclick: () => { if (sw.run) { sw.t = cur(); sw.run = false; } else { sw.start = Date.now(); sw.run = true; } render(); } }, sw.run ? 'Stop' : 'Start');
          body.append(d, h('div', { class: 'row center' }, ss, h('button', { class: 'btn', onclick: () => { if (sw.run) sw.laps.unshift(cur()); else sw = { t: 0, run: false, start: 0, laps: [] }; render(); } }, sw.run ? 'Lap' : 'Reset')), laps);
          sw.laps.forEach((l, i) => laps.append(h('div', {}, `Lap ${sw.laps.length - i}: ${fmt(l)}`)));
          const upd = () => d.textContent = fmt(cur()); upd(); iv = setInterval(upd, 31);
        } else if (tab === 'Timer') {
          const d = h('div', { class: 'big-time' });
          const left = () => timer.run ? Math.max(0, timer.end - Date.now()) : timer.left * 1000;
          const fmt = ms => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
          const presets = h('div', { class: 'row center' }, ...[1, 3, 5, 10, 25].map(m => h('button', { class: 'btn sm', onclick: () => { timer = { left: m * 60, run: false }; render(); } }, m + 'm')));
          body.append(d, presets, h('div', { class: 'row center' }, h('button', { class: 'btn primary', onclick: () => { if (timer.run) { timer.left = left() / 1000; timer.run = false; } else { timer.end = Date.now() + left(); timer.run = true; } render(); } }, timer.run ? 'Pause' : 'Start'), h('button', { class: 'btn', onclick: () => { timer = { left: 300, run: false }; render(); } }, 'Reset')));
          const upd = () => { d.textContent = fmt(left()); if (timer.run && left() <= 0) { timer.run = false; timer.left = 0; OS.notify('Timer', '⏰ Time is up!', '⏰'); [0, .3, .6].forEach(w => OS.Sound.tone(880, .2, 'square', .1, w)); render(); } };
          upd(); iv = setInterval(upd, 200);
        } else {
          const alarms = JSON.parse(localStorage.getItem('rocketos.alarms') || '[]');
          const inp = h('input', { type: 'time', class: 'input' }), lbl = h('input', { class: 'input', placeholder: 'Label' });
          body.append(h('div', { class: 'row' }, inp, lbl, h('button', { class: 'btn primary', onclick: () => { if (!inp.value) return; alarms.push({ t: inp.value, l: lbl.value || 'Alarm', on: true }); localStorage.setItem('rocketos.alarms', JSON.stringify(alarms)); render(); } }, 'Add')));
          alarms.forEach((a, i) => body.append(h('div', { class: 'zone' }, h('b', {}, a.t), h('span', {}, a.l), h('input', { type: 'checkbox', class: 'switch', checked: a.on, onchange: e => { a.on = e.target.checked; localStorage.setItem('rocketos.alarms', JSON.stringify(alarms)); } }), h('button', { class: 'btn sm', onclick: () => { alarms.splice(i, 1); localStorage.setItem('rocketos.alarms', JSON.stringify(alarms)); render(); } }, '🗑️'))));
          if (!alarms.length) body.append(h('div', { class: 'muted pad center' }, 'No alarms. Alarms ring even when this window is closed.'));
        }
      };
      render(); win.onClose(() => clearInterval(iv));
    } });
  // background alarm checker
  let lastAlarm = '';
  setInterval(() => {
    const d = new Date(), t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (t === lastAlarm) return;
    let alarms = []; try { alarms = JSON.parse(localStorage.getItem('rocketos.alarms') || '[]'); } catch {}
    alarms.filter(a => a.on && a.t === t).forEach(a => { lastAlarm = t; OS.notify('⏰ Alarm', a.l + ' — ' + t, '⏰', { force: true, duration: 10000 }); [0, .25, .5, .75].forEach(w => OS.Sound.tone(988, .18, 'square', .1, w)); });
  }, 5000);

  // ------------------------------------------------ Calendar with events
  OS.registerApp({ id: 'calendar', name: 'Calendar', icon: '📅', category: 'Accessories', width: 560, height: 470, desc: 'Monthly calendar with events',
    launch(win) {
      const KEY = 'rocketos.events';
      let events = JSON.parse(localStorage.getItem(KEY) || '{}');
      let ref = new Date(); ref.setDate(1); let sel = new Date().toDateString();
      const wrap = h('div', { class: 'calapp' }); win.body.append(wrap);
      const keyOf = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const render = () => {
        wrap.innerHTML = '';
        const head = h('div', { class: 'cal-head' }, h('button', { class: 'btn sm', onclick: () => { ref = new Date(ref.getFullYear(), ref.getMonth() - 1, 1); render(); } }, '‹'), h('b', {}, ref.toLocaleDateString([], { month: 'long', year: 'numeric' })), h('button', { class: 'btn sm', onclick: () => { ref = new Date(ref.getFullYear(), ref.getMonth() + 1, 1); render(); } }, '›'), h('button', { class: 'btn sm', onclick: () => { ref = new Date(); ref.setDate(1); sel = new Date().toDateString(); render(); } }, 'Today'));
        const grid = h('div', { class: 'cal-grid big' });
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => grid.append(h('div', { class: 'cal-dow' }, d)));
        const first = ref.getDay(), days = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
        for (let i = 0; i < first; i++) grid.append(h('div'));
        for (let d = 1; d <= days; d++) {
          const date = new Date(ref.getFullYear(), ref.getMonth(), d), ev = events[keyOf(date)] || [];
          const c = h('div', { class: 'cal-d' + (date.toDateString() === new Date().toDateString() ? ' today' : '') + (date.toDateString() === sel ? ' sel' : '') }, h('span', {}, d), ev.length ? h('i', { class: 'dot' }) : '');
          c.onclick = () => { sel = date.toDateString(); render(); };
          grid.append(c);
        }
        const sd = new Date(sel), list = events[keyOf(sd)] || [];
        const inp = h('input', { class: 'input', placeholder: 'New event…' });
        const add = () => { if (!inp.value.trim()) return; (events[keyOf(sd)] = events[keyOf(sd)] || []).push(inp.value.trim()); localStorage.setItem(KEY, JSON.stringify(events)); render(); };
        inp.addEventListener('keydown', e => e.key === 'Enter' && add());
        const side = h('div', { class: 'cal-side' }, h('b', {}, sd.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })),
          ...list.map((t, i) => h('div', { class: 'cal-ev' }, '• ' + t, h('button', { class: 'x', onclick: () => { list.splice(i, 1); localStorage.setItem(KEY, JSON.stringify(events)); render(); } }, '×'))),
          list.length ? '' : h('div', { class: 'muted' }, 'No events'), h('div', { class: 'row' }, inp, h('button', { class: 'btn primary', onclick: add }, 'Add')));
        wrap.append(head, h('div', { class: 'cal-main' }, grid, side));
      };
      render();
    } });

  // ------------------------------------------------ System monitor / task manager
  OS.registerApp({ id: 'sysmon', name: 'System Monitor', icon: '📊', category: 'System', width: 620, height: 460, desc: 'Processes, CPU and memory', singleton: true,
    launch(win) {
      const cv = h('canvas', { width: 580, height: 110, class: 'sm-graph' });
      const stats = h('div', { class: 'sm-stats' });
      const table = h('div', { class: 'sm-table' });
      win.body.append(h('div', { class: 'pad sysmon' }, cv, stats, table));
      const cpuH = Array(120).fill(0), memH = Array(120).fill(0);
      const ctx = cv.getContext('2d');
      const upd = () => {
        const c = SysStats.cpu(), m = SysStats.mem();
        cpuH.push(c); cpuH.shift(); memH.push(m.used / m.total * 100); memH.shift();
        const W = cv.width = cv.clientWidth || 580, H = cv.height;
        ctx.clearRect(0, 0, W, H); ctx.strokeStyle = '#8883'; for (let y = 0; y < H; y += H / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        const line = (arr, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); arr.forEach((v, i) => { const x = i / (arr.length - 1) * W, y = H - v / 100 * (H - 4) - 2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
        line(memH, '#57c7ff'); line(cpuH, getComputedStyle(document.documentElement).getPropertyValue('--accent'));
        stats.innerHTML = `<span style="color:var(--accent)">■ CPU ${c.toFixed(1)}%</span><span style="color:#57c7ff">■ Memory ${m.used} / ${m.total} MB</span><span>💾 Disk ${OS.fmtSize(VFS.usage())}</span><span>${NET.status().icon} ${OS.esc(NET.status().text)}</span>`;
        table.innerHTML = '';
        table.append(h('div', { class: 'sm-row head' }, h('span', {}, 'PID'), h('span', {}, 'Name'), h('span', {}, 'CPU'), h('span', {}, 'Memory'), h('span', {}, '')));
        OS.procs.forEach(p => { p.cpu = Math.max(0, p.cpu * 0.5 + Math.random() * 4); table.append(h('div', { class: 'sm-row' }, h('span', {}, p.pid), h('span', {}, p.name), h('span', {}, p.cpu.toFixed(1) + '%'), h('span', {}, p.mem.toFixed(1) + ' MB'), h('button', { class: 'btn sm', onclick: () => OS.killProc(p.pid) }, 'End task'))); });
      };
      upd(); const iv = setInterval(upd, 1000); win.onClose(() => clearInterval(iv));
    } });

  // ------------------------------------------------ Notes
  OS.registerApp({ id: 'notes', name: 'Notes', icon: '🗒️', category: 'Accessories', width: 640, height: 440, desc: 'Quick notes saved to ~/Documents/Notes',
    launch(win) {
      const dir = VFS.home() + '/Documents/Notes'; VFS.mkdir(dir);
      let cur = null;
      const list = h('div', { class: 'notes-list' }), ta = h('textarea', { class: 'notes-text', placeholder: 'Start typing…' });
      win.body.append(h('div', { class: 'notes' }, h('div', { class: 'notes-side' }, h('button', { class: 'btn primary', onclick: async () => { const n = await OS.prompt('Note title:', 'New note'); if (n) { const p = VFS.uniqueName(dir, n, '.txt'); VFS.write(p, ''); cur = p; render(); } } }, '＋ New note'), list), ta));
      const render = () => {
        list.innerHTML = '';
        const files = VFS.list(dir).filter(n => n.endsWith('.txt'));
        if (!cur && files.length) cur = VFS.join(dir, files[0]);
        files.forEach(n => { const p = VFS.join(dir, n); const el = h('div', { class: 'note-item' + (p === cur ? ' on' : '') }, h('b', {}, n.replace(/\.txt$/, '')), h('small', {}, (VFS.read(p).split('\n')[0] || 'Empty').slice(0, 40)));
          el.onclick = () => { cur = p; render(); };
          el.oncontextmenu = e => { e.preventDefault(); OS.contextMenu(e.clientX, e.clientY, [{ icon: '🗑️', label: 'Delete', action: () => { VFS.rm(p); if (cur === p) cur = null; render(); } }]); };
          list.append(el); });
        ta.disabled = !cur; ta.value = cur ? VFS.read(cur) : '';
      };
      let t; ta.addEventListener('input', () => { clearTimeout(t); const p = cur; t = setTimeout(() => { VFS.write(p, ta.value); const el = list.querySelector('.on small'); if (el) el.textContent = (ta.value.split('\n')[0] || 'Empty').slice(0, 40); }, 300); });
      if (!VFS.list(dir).length) VFS.write(dir + '/Welcome.txt', 'Welcome to Notes!\n\nNotes autosave to ~/Documents/Notes as .txt files.');
      render();
    } });

  // ------------------------------------------------ Weather
  OS.registerApp({ id: 'weather', name: 'Weather', icon: '⛅', category: 'Internet', width: 520, height: 420, desc: 'Live forecast (needs Wi-Fi)',
    launch(win) {
      const sel = h('select', { class: 'input' }, ...Object.keys(Weather.cities).map(c => h('option', { selected: c === Weather.city() }, c)));
      const box = h('div', { class: 'weather' });
      win.body.append(h('div', { class: 'pad' }, h('div', { class: 'row' }, '📍', sel), box));
      const render = async () => {
        box.innerHTML = '<div class="muted pad">Loading…</div>';
        const w = await Weather.get(sel.value);
        box.innerHTML = '';
        box.append(h('div', { class: 'w-now' }, h('div', { class: 'w-icon' }, w.icon), h('div', {}, h('div', { class: 'w-temp' }, Math.round(w.temp) + '°C'), h('div', {}, w.desc), h('small', { class: 'muted' }, `Wind ${Math.round(w.wind)} km/h · Humidity ${Math.round(w.humidity)}% · ${w.live ? 'Live data from open-meteo.com' : '⚠️ Offline estimate — connect Wi-Fi for live data'}`))),
          h('div', { class: 'w-days' }, ...w.days.map(d => h('div', { class: 'w-day' }, h('b', {}, d.day), h('div', { class: 'w-di' }, d.icon), h('div', {}, `${Math.round(d.max)}° / ${Math.round(d.min)}°`)))));
      };
      sel.onchange = () => { OS.set('weatherCity', sel.value); render(); };
      render();
    } });

  // ------------------------------------------------ About
  OS.registerApp({ id: 'about', name: 'About RocketOS', icon: '🚀', category: 'System', width: 440, height: 400, resizable: false, singleton: true,
    launch(win) {
      const m = SysStats.mem();
      win.body.append(h('div', { class: 'about' },
        h('div', { class: 'about-logo' }, '🚀'), h('h2', {}, 'RocketOS'), h('div', { class: 'muted' }, `Version ${OS.version} “Liftoff”`),
        h('div', { class: 'about-grid' },
          h('b', {}, 'Kernel'), h('span', {}, 'rocket-kernel 1.0 (Unix-like)'), h('b', {}, 'Shell'), h('span', {}, 'rsh 2.0'),
          h('b', {}, 'User'), h('span', {}, OS.settings.username + '@' + OS.settings.hostname), h('b', {}, 'Memory'), h('span', {}, `${m.used} / ${m.total} MB`),
          h('b', {}, 'Storage'), h('span', {}, OS.fmtSize(VFS.usage()) + ' used'), h('b', {}, 'Apps'), h('span', {}, OS.listApps().length + ' installed'),
          h('b', {}, 'Formats'), h('span', {}, '.esl apps · .log batch · .hsl shortcuts')),
        h('div', { class: 'muted small' }, 'A Unix-inspired desktop that runs in your browser.')));
    } });

  // ------------------------------------------------ Help / Guide
  OS.registerApp({ id: 'help', name: 'RocketOS Guide', icon: '📘', category: 'System', width: 700, height: 520, desc: 'How to use RocketOS, .esl, .log and .hsl',
    launch(win) {
      const pages = {
        'Welcome': `<h2>🚀 Welcome to RocketOS</h2><p>RocketOS is a Unix-inspired desktop operating system. Everything lives in a real file tree (<code>/home/${OS.esc(OS.settings.username)}</code>, <code>/apps</code>, <code>/etc</code>…) that is saved in your browser.</p>
<ul><li><b>Start menu</b> (bottom-left) — classic cascading menus: Programs, Documents, Settings, Find, Help, Run.</li><li><b>Taskbar</b> — quick launch, pinned apps, window buttons with previews (hover) and right-click menus, live CPU meter, system tray, clock.</li><li><b>Top bar</b> — app menus, search (Ctrl+Space), widgets, Rocky AI, control center, Wi-Fi, battery and notifications.</li><li><b>Widgets</b> — drag them around the desktop; add more in Settings → Widgets.</li><li>Drag windows to the top edge to maximize or to the sides to snap.</li></ul>`,
        '.esl Apps': `<h2>🧩 .esl — RocketOS applications</h2><p>An <code>.esl</code> file is a self-contained app: a metadata header followed by <code>---html</code>, <code>---css</code> and <code>---js</code> sections. Double-click one to run it in a sandbox.</p>
<pre>#!esl
name: Hello
icon: 👋
version: 1.0
width: 360
height: 240
---html
&lt;h1&gt;Hello!&lt;/h1&gt;&lt;button id="b"&gt;Greet&lt;/button&gt;
---css
body { text-align:center; padding:20px }
---js
b.onclick = () =&gt; os.notify('Hi', 'From my app');</pre>
<p>Apps get an <code>os</code> API: <code>os.notify(title, body)</code>, <code>os.alert(msg)</code>, <code>await os.prompt(msg)</code>, <code>os.fs.read/write/list/exists/mkdir/remove(path)</code>, <code>os.storage.get/set(key, value)</code>, <code>os.open(pathOrAppId)</code>, <code>os.launch(appId)</code>, <code>await os.run('ls ~')</code>, <code>os.setTitle(t)</code>, <code>os.close()</code>.</p><p>Build apps visually in <b>App Maker</b>, then <b>Publish</b> them to the App Store.</p>`,
        '.log Batch': `<h2>📜 .log — batch scripts</h2><p>A <code>.log</code> file is a batch script: one shell command per line. Lines starting with <code>#</code>, <code>::</code> or <code>rem</code> are comments. Arguments are available as <code>$1 $2 … $@ $#</code>.</p>
<pre># backup.log — copy documents to a backup folder
echo Backing up $HOME/Documents…
mkdir -p ~/backup
cp ~/Documents/* ~/backup
for f in one two three; do echo item $f; done
if test -d ~/backup; then notify Backup "Done!"; else echo failed; fi</pre><p>Run with a double-click, <code>./backup.log</code>, or <code>run backup.log</code> in the Terminal. <code>~/.startup.log</code> runs automatically at boot.</p>`,
        '.hsl Shortcuts': `<h2>🔗 .hsl — shortcuts</h2><p>An <code>.hsl</code> file points to an app, a file, a folder, a URL or a command:</p>
<pre>[Shortcut]
name=Snake
icon=🐍
target=app:snake</pre><p>Targets: <code>app:&lt;id&gt;</code>, <code>/absolute/path</code>, <code>url:https://…</code>, <code>cmd:&lt;shell command&gt;</code>. Create one by right-clicking the desktop → New Shortcut, with <code>hsl create &lt;name&gt; &lt;target&gt;</code> or <code>ln -s target name</code> in the Terminal.</p>`,
        'Terminal': `<h2>💻 Terminal</h2><p>The Terminal runs <b>rsh</b>, a Unix-style shell with tabs (Ctrl+Shift+T), themes, font zoom (Ctrl +/−), history (↑/↓), tab completion, pipes <code>|</code>, redirects <code>&gt; &gt;&gt; &lt;</code>, chaining <code>; &amp;&amp; ||</code>, variables, aliases, globs and loops. Type <code>help</code> to see all ~90 commands, e.g. <code>ls -l | grep esl</code>, <code>wifi list</code>, <code>neofetch</code>, <code>top</code>, <code>install pomodoro</code>, <code>ai what time is it</code>.</p>`,
        'Wi-Fi': `<h2>📶 Wi-Fi</h2><p>Click the Wi-Fi icon in the top bar or tray to see nearby networks. Secured networks need a password (the home network <b>RocketNet-5G</b> uses <code>rocket123</code>; <b>Starlink-Orbit</b> uses <code>orbit2026</code>). App Store downloads need a Wi-Fi connection. Web features — the browser, live weather and the AI cloud mode — need both a Wi-Fi connection and a real internet connection on your device.</p>`,
        'Rocky AI': `<h2>🤖 Rocky AI</h2><p>Rocky is RocketOS's built-in assistant. It can open apps (“open snake”), change settings (“dark mode”, “wallpaper sunset”), run commands (“run ls ~”), do math, create notes and answer questions about RocketOS. For full conversational answers, add an Anthropic API key in Settings → AI to enable Cloud mode, which uses Claude.</p>`,
      };
      let cur = 'Welcome';
      const nav = h('div', { class: 'help-nav' }), content = h('div', { class: 'help-content' });
      win.body.append(h('div', { class: 'help' }, nav, content));
      const render = () => { nav.innerHTML = ''; Object.keys(pages).forEach(k => nav.append(h('div', { class: 'help-link' + (k === cur ? ' on' : ''), onclick: () => { cur = k; render(); } }, k))); content.innerHTML = pages[cur]; };
      render();
    } });
})();
