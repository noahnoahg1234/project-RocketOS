/* App Maker — create, edit, preview, save and publish .esl apps. Includes templates and a component palette. */
OS.registerApp({ id: 'appmaker', name: 'App Maker', icon: '🛠️', category: 'Development', width: 1000, height: 620, desc: 'Build .esl apps and publish them to the App Store',
  launch(win, args = {}) {
    const { h } = OS;
    let path = null, dirty = false, tab = 'html';
    const templates = {
      'Hello World': { meta: { name: 'Hello World', icon: '👋', width: 360, height: 240, category: 'Productivity', description: 'My first RocketOS app' }, html: '<h1>Hello, RocketOS! 🚀</h1>\n<button id="btn">Say hi</button>', css: 'body { text-align: center; padding: 30px; }\nh1 { color: #ff6b35; }', js: "document.getElementById('btn').onclick = () => {\n  os.notify('Hello', 'My first app works!');\n};" },
      'Counter': { meta: { name: 'Counter', icon: '🔢', width: 300, height: 260, category: 'Productivity', description: 'A persistent counter' }, html: '<div id="n">0</div>\n<button id="minus">−</button>\n<button id="plus">+</button>', css: 'body{text-align:center;padding:20px}\n#n{font-size:72px;font-weight:800;margin:10px}\nbutton{font-size:24px;width:60px}', js: "let n = 0;\nconst show = () => document.getElementById('n').textContent = n;\nos.storage.get('n').then(v => { n = v || 0; show(); });\nplus.onclick = () => { n++; show(); os.storage.set('n', n); };\nminus.onclick = () => { n--; show(); os.storage.set('n', n); };" },
      'To-Do List': { meta: { name: 'My Todos', icon: '✅', width: 380, height: 420, category: 'Productivity', description: 'A to-do list saved to a file' }, html: '<h2>✅ To-Do</h2>\n<form id="f"><input id="t" placeholder="New task"> <button>Add</button></form>\n<ul id="list"></ul>', css: 'body{padding:16px}\nul{padding:0;list-style:none}\nli{padding:8px;border-bottom:1px solid #8884;cursor:pointer}\nli.done{text-decoration:line-through;opacity:.5}', js: "const FILE = '~/Documents/todos.json';\nlet items = [];\nconst save = () => os.fs.write(FILE, JSON.stringify(items));\nfunction render() {\n  list.innerHTML = '';\n  items.forEach((it, i) => {\n    const li = document.createElement('li');\n    li.textContent = it.t; li.className = it.d ? 'done' : '';\n    li.onclick = () => { it.d = !it.d; save(); render(); };\n    list.append(li);\n  });\n}\nf.onsubmit = e => { e.preventDefault(); if (!t.value) return; items.push({ t: t.value, d: false }); t.value = ''; save(); render(); };\nos.fs.exists(FILE).then(x => x && os.fs.read(FILE).then(s => { items = JSON.parse(s); render(); }));" },
      'Canvas Game': { meta: { name: 'Bouncy', icon: '🏀', width: 480, height: 360, category: 'Games', description: 'Click the ball to score' }, html: '<canvas id="c"></canvas>\n<div id="s">Score: 0</div>', css: 'body{margin:0;overflow:hidden;background:#111}\n#s{position:fixed;top:8px;left:10px;color:#fff;font:bold 18px sans-serif}', js: "const x = c.getContext('2d');\nc.width = innerWidth; c.height = innerHeight;\nlet b = { x: 100, y: 100, vx: 3, vy: 2, r: 24 }, score = 0;\nc.onclick = e => { if (Math.hypot(e.clientX - b.x, e.clientY - b.y) < b.r) { score++; s.textContent = 'Score: ' + score; b.vx *= 1.15; b.vy *= 1.15; } };\n(function loop() {\n  b.x += b.vx; b.y += b.vy;\n  if (b.x < b.r || b.x > c.width - b.r) b.vx *= -1;\n  if (b.y < b.r || b.y > c.height - b.r) b.vy *= -1;\n  x.fillStyle = '#1118'; x.fillRect(0, 0, c.width, c.height);\n  x.beginPath(); x.arc(b.x, b.y, b.r, 0, 7); x.fillStyle = '#ff6b35'; x.fill();\n  requestAnimationFrame(loop);\n})();" },
      'File Viewer': { meta: { name: 'Folder Peek', icon: '🗂️', width: 420, height: 380, category: 'Developer', description: 'Lists files with the os.fs API' }, html: '<input id="p" value="~"> <button id="go">List</button>\n<pre id="out"></pre>', css: 'body{padding:12px}\npre{white-space:pre-wrap}', js: "go.onclick = async () => {\n  try { out.textContent = (await os.fs.list(p.value)).join('\\n'); }\n  catch (e) { out.textContent = 'Error: ' + e.message; }\n};\ngo.onclick();" },
      'Blank': { meta: { name: 'New App', icon: '✨', width: 480, height: 360, category: 'Productivity', description: '' }, html: '', css: '', js: '' },
    };
    const components = [
      ['Heading', '<h2>Heading</h2>'], ['Text', '<p>Some text</p>'], ['Button', '<button id="myButton">Click me</button>'], ['Input', '<input id="myInput" placeholder="Type…">'],
      ['Textarea', '<textarea id="myText" rows="4"></textarea>'], ['Checkbox', '<label><input type="checkbox" id="myCheck"> Option</label>'], ['Dropdown', '<select id="mySelect"><option>One</option><option>Two</option></select>'],
      ['Image', '<img src="https://picsum.photos/200" alt="" style="max-width:100%">'], ['Canvas', '<canvas id="myCanvas" width="300" height="200"></canvas>'], ['List', '<ul id="myList">\n  <li>Item</li>\n</ul>'], ['Card', '<div style="padding:12px;border-radius:12px;background:#8882">Card content</div>'],
    ];
    const snippets = [
      ['On click', "myButton.onclick = () => {\n  os.notify('Clicked!', '');\n};"], ['Notification', "os.notify('Title', 'Message');"], ['Ask user', "const name = await os.prompt('Your name?');"],
      ['Read file', "const text = await os.fs.read('~/Documents/file.txt');"], ['Write file', "await os.fs.write('~/Documents/file.txt', 'hello');"], ['Save value', "os.storage.set('key', 42);"], ['Load value', "const v = await os.storage.get('key');"],
      ['Run shell', "const out = await os.run('ls ~');"], ['Timer', "setInterval(() => {\n  // every second\n}, 1000);"], ['Open app', "os.launch('calculator');"],
    ];

    let app = JSON.parse(JSON.stringify(templates['Hello World']));
    app.meta.author = OS.settings.username; app.meta.version = '1.0';

    // ---- UI
    const fld = (key, label, type = 'text') => { const i = h('input', { class: 'input sm', type, value: app.meta[key] ?? '' }); i.addEventListener('input', () => { app.meta[key] = type === 'number' ? +i.value : i.value; changed(); }); i.dataset.key = key; return h('label', { class: 'am-field' }, h('span', {}, label), i); };
    const metaBox = h('div', { class: 'am-meta' });
    const renderMeta = () => { metaBox.innerHTML = ''; metaBox.append(h('b', {}, 'App info'), fld('name', 'Name'), fld('icon', 'Icon (emoji)'), fld('description', 'Description'), fld('category', 'Category'), fld('version', 'Version'), fld('author', 'Author'), h('div', { class: 'row' }, fld('width', 'Width', 'number'), fld('height', 'Height', 'number'))); };
    const palette = h('div', { class: 'am-palette' });
    const renderPalette = () => { palette.innerHTML = ''; palette.append(h('b', {}, tab === 'js' ? 'Code snippets' : tab === 'html' ? 'Components' : 'Styles'));
      const list = tab === 'js' ? snippets : tab === 'html' ? components : [['Center', 'body { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; margin:0; }'], ['Dark bg', 'body { background:#111; color:#eee; }'], ['Gradient', 'body { background: linear-gradient(135deg, #667eea, #764ba2); color:#fff; }'], ['Big buttons', 'button { font-size:18px; padding:10px 20px; border-radius:10px; }'], ['Card', '.card { padding:16px; border-radius:14px; box-shadow:0 4px 20px #0003; }']];
      list.forEach(([n, code]) => palette.append(h('button', { class: 'am-comp', onclick: () => insert(code) }, '＋ ' + n))); };
    const tabsEl = h('div', { class: 'seg am-tabs' });
    const code = h('textarea', { class: 'am-code', spellcheck: 'false', wrap: 'off' });
    const preview = h('iframe', { class: 'am-preview', sandbox: 'allow-scripts allow-modals' });
    const consoleEl = h('div', { class: 'am-console' });
    const autoRun = h('input', { type: 'checkbox', checked: true });
    const status = h('span', { class: 'muted small' });
    const tplSel = h('select', { class: 'input sm' }, h('option', { value: '' }, '📋 Templates…'), ...Object.keys(templates).map(k => h('option', {}, k)));
    tplSel.onchange = async () => { const k = tplSel.value; tplSel.value = ''; if (!k) return; if (dirty && !(await OS.confirm('Replace current app with the template?'))) return; app = JSON.parse(JSON.stringify(templates[k])); app.meta.author = OS.settings.username; app.meta.version = '1.0'; path = null; dirty = false; load(); };
    const tb = h('div', { class: 'am-toolbar' },
      h('button', { class: 'btn sm', onclick: () => newApp() }, '📄 New'), h('button', { class: 'btn sm', onclick: () => openApp() }, '📂 Open'), h('button', { class: 'btn sm', onclick: () => save() }, '💾 Save'), h('button', { class: 'btn sm', onclick: () => saveAs() }, 'Save As…'), tplSel,
      h('div', { class: 'tb-spacer' }), h('label', { class: 'small' }, autoRun, ' Live preview'), h('button', { class: 'btn sm', onclick: () => refresh() }, '⟳ Preview'),
      h('button', { class: 'btn sm', onclick: () => run() }, '▶ Run in window'), h('button', { class: 'btn sm', onclick: () => shortcut() }, '🔗 Desktop shortcut'),
      h('button', { class: 'btn sm', onclick: () => h('a', { href: URL.createObjectURL(new Blob([eslText()])), download: (app.meta.name || 'app').replace(/\W+/g, '-') + '.esl' }).click() }, '⬇️ Export'),
      h('button', { class: 'btn sm primary', onclick: () => publish() }, '🚀 Publish'));
    win.body.append(h('div', { class: 'appmaker' }, tb, h('div', { class: 'am-main' }, h('div', { class: 'am-left' }, metaBox, palette), h('div', { class: 'am-center' }, tabsEl, code), h('div', { class: 'am-right' }, h('div', { class: 'am-ph' }, '👁️ Preview ', status), preview, h('div', { class: 'am-ph' }, '🐞 Console'), consoleEl))));

    const renderTabs = () => { tabsEl.innerHTML = ''; [['html', 'HTML'], ['css', 'CSS'], ['js', 'JavaScript']].forEach(([k, l]) => tabsEl.append(h('button', { class: k === tab ? 'on' : '', onclick: () => { tab = k; code.value = app[k]; renderTabs(); renderPalette(); } }, l))); };
    const eslText = () => ESL.serialize(app);
    const title = () => win.setTitle(`App Maker — ${dirty ? '• ' : ''}${path ? VFS.basename(path) : app.meta.name + ' (unsaved)'}`);
    let pt; function changed() { dirty = true; title(); if (autoRun.checked) { clearTimeout(pt); pt = setTimeout(refresh, 500); } }
    function insert(s) { const st = code.selectionStart; code.setRangeText((code.value && st > 0 && code.value[st - 1] !== '\n' ? '\n' : '') + s + '\n', st, code.selectionEnd, 'end'); app[tab] = code.value; changed(); code.focus(); }
    function refresh() {
      consoleEl.innerHTML = '';
      const doc = ESL.buildDoc(app).replace('<script>', `<script>(function(){const send=(t,a)=>parent.postMessage({__amlog:1,t,a:[...a].map(x=>{try{return typeof x==='object'?JSON.stringify(x):String(x)}catch{return String(x)}}).join(' ')},'*');['log','warn','error','info'].forEach(k=>{const o=console[k];console[k]=(...a)=>{send(k,a);o.apply(console,a)}});addEventListener('error',e=>send('error',[e.message+' (line '+e.lineno+')']));})();`);
      preview.srcdoc = doc; status.textContent = `${app.meta.width}×${app.meta.height}`;
    }
    // preview's os.* calls are answered by a minimal mock so live preview never touches your files
    const onMsg = async e => {
      if (e.source !== preview.contentWindow || !e.data) return;
      const d = e.data;
      if (d.__amlog) { consoleEl.append(h('div', { class: 'am-log ' + d.t }, (d.t === 'error' ? '❌ ' : d.t === 'warn' ? '⚠️ ' : '› ') + d.a)); consoleEl.scrollTop = consoleEl.scrollHeight; return; }
      if (!d.__esl) return;
      if (d.method === 'error') { consoleEl.append(h('div', { class: 'am-log error' }, '❌ ' + d.args[0])); return; }
      let result = null, error = null;
      const [a, b] = d.args || [];
      try {
        if (d.method === 'notify') OS.notify(String(a || app.meta.name) + ' (preview)', String(b || ''), app.meta.icon);
        else if (d.method === 'alert') await OS.alert(String(a), app.meta.name);
        else if (d.method === 'prompt') result = await OS.prompt(String(a), b || '', app.meta.name);
        else if (d.method === 'storage.get') result = JSON.parse(sessionStorage.getItem('am.' + a) || 'null');
        else if (d.method === 'storage.set') { sessionStorage.setItem('am.' + a, JSON.stringify(b)); result = true; }
        else if (d.method === 'fs.read') result = VFS.read(VFS.normalize(a, VFS.home()));
        else if (d.method === 'fs.list') result = VFS.list(VFS.normalize(a || '~', VFS.home()));
        else if (d.method === 'fs.exists') result = VFS.exists(VFS.normalize(a, VFS.home()));
        else if (['fs.write', 'fs.mkdir', 'fs.remove'].includes(d.method)) { consoleEl.append(h('div', { class: 'am-log warn' }, `⚠️ ${d.method}('${a}') skipped in preview — use ▶ Run to allow file changes`)); result = true; }
        else if (d.method === 'run') result = await Shell.exec(String(a));
        else if (d.method === 'time') result = new Date().toISOString();
        else if (d.method === 'online') result = NET.online();
        else consoleEl.append(h('div', { class: 'am-log' }, `› os.${d.method}(${(d.args || []).join(', ')}) (preview)`));
      } catch (err) { error = err.message; }
      e.source.postMessage({ __eslReply: 1, id: d.id, result, error }, '*');
    };
    addEventListener('message', onMsg); win.onClose(() => removeEventListener('message', onMsg));

    code.addEventListener('input', () => { app[tab] = code.value; changed(); });
    code.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); code.setRangeText('  ', code.selectionStart, code.selectionEnd, 'end'); app[tab] = code.value; changed(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); save(); }
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); run(); }
    });
    function load() { renderMeta(); renderTabs(); renderPalette(); code.value = app[tab]; title(); refresh(); }
    async function newApp() { if (dirty && !(await OS.confirm('Discard unsaved changes?'))) return; app = JSON.parse(JSON.stringify(templates.Blank)); app.meta.author = OS.settings.username; app.meta.version = '1.0'; path = null; dirty = false; load(); }
    function loadPath(p) { try { const parsed = ESL.parse(VFS.read(p)); if (parsed.meta.builtin) { OS.alert(`${parsed.meta.name} is a built-in system app and can’t be edited. Try a template or a store app instead.`, 'App Maker', 'ℹ️'); return; } app = parsed; path = p; dirty = false; load(); } catch (e) { OS.alert(e.message, 'Open', '⚠️'); } }
    async function openApp() { const p = await OS.prompt('Open .esl file:', VFS.home() + '/apps/', 'App Maker', { icon: '📂' }); if (p) loadPath(VFS.normalize(p, VFS.home())); }
    async function save() { if (!path) return saveAs(); VFS.write(path, eslText()); dirty = false; title(); OS.notify('App Maker', `Saved ${VFS.basename(path)}`, '💾'); }
    async function saveAs() { const p = await OS.prompt('Save app as:', VFS.home() + '/apps/' + (app.meta.name || 'app').replace(/[\/]/g, '-') + '.esl', 'Save As', { icon: '💾' }); if (!p) return; path = VFS.normalize(p.endsWith('.esl') ? p : p + '.esl', VFS.home()); await save(); }
    function run() { ESL.runText(eslText(), path || app.meta.name); }
    async function shortcut() { if (!path) await saveAs(); if (!path) return; HSL.create(VFS.home() + '/Desktop', app.meta.name, path, app.meta.icon); OS.notify('App Maker', 'Shortcut added to the Desktop', '🔗'); }
    async function publish() {
      if (!app.meta.description) { const d = await OS.prompt('Describe your app for the App Store:', '', 'Publish', { icon: '🚀' }); if (d == null) return; app.meta.description = d; renderMeta(); }
      if (!(await OS.confirm(`Publish “${app.meta.name}” ${app.meta.icon} to the App Store? It will appear in the Community section.`, 'Publish', '🚀'))) return;
      try { if (path) VFS.write(path, eslText()); const e = Store.publish(eslText()); OS.notify('App Store', `🎉 ${e.name} is live in the App Store!`, '🚀', { action: () => OS.launch('store', { detail: e.id }) }); }
      catch (err) { OS.alert(err.message, 'Publish', '⚠️'); }
    }
    win.beforeClose = async () => !dirty || OS.confirm('Close App Maker without saving?');
    if (args.path) loadPath(args.path); else load();
  } });
