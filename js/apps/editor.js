/* Rocket Write — text/code editor with line numbers, find/replace, and run support for .log/.esl/.hsl */
OS.registerApp({ id: 'editor', name: 'Rocket Write', icon: '📝', category: 'Accessories', width: 720, height: 480, desc: 'Text and code editor',
  launch(win, args = {}) {
    const { h } = OS;
    let path = args.path || null, dirty = false;
    const ta = h('textarea', { class: 'ed-text', spellcheck: 'false', wrap: 'off' });
    const gutter = h('div', { class: 'ed-gutter' });
    const status = h('div', { class: 'ed-status' });
    const findBar = h('div', { class: 'ed-find hidden' });
    const fInput = h('input', { class: 'input sm', placeholder: 'Find' }), rInput = h('input', { class: 'input sm', placeholder: 'Replace' });
    findBar.append(fInput, rInput, h('button', { class: 'btn sm', onclick: () => find() }, 'Next'), h('button', { class: 'btn sm', onclick: () => replaceAll() }, 'Replace all'), h('button', { class: 'btn sm', onclick: () => findBar.classList.add('hidden') }, '×'));
    const runBtn = h('button', { class: 'btn sm primary hidden', onclick: () => run() }, '▶ Run');
    const menu = (label, items) => { const b = h('button', { class: 'ed-menu' }, label); b.onclick = () => { const r = b.getBoundingClientRect(); OS.contextMenu(r.left, r.bottom, items()); }; return b; };
    const bar = h('div', { class: 'ed-bar' },
      menu('File', () => [{ icon: '📄', label: 'New', hint: 'Ctrl+N', action: newFile }, { icon: '📂', label: 'Open…', hint: 'Ctrl+O', action: openFile }, { icon: '💾', label: 'Save', hint: 'Ctrl+S', action: save }, { icon: '💾', label: 'Save As…', action: saveAs }, '-', { icon: '⬇️', label: 'Download to computer', action: download }]),
      menu('Edit', () => [{ icon: '🔍', label: 'Find & Replace', hint: 'Ctrl+F', action: showFind }, { icon: '🔠', label: 'UPPERCASE selection', action: () => transform(s => s.toUpperCase()) }, { icon: '🔡', label: 'lowercase selection', action: () => transform(s => s.toLowerCase()) }, { icon: '🕒', label: 'Insert date/time', action: () => insert(new Date().toLocaleString()) }]),
      menu('View', () => [{ icon: '↩️', label: (ta.getAttribute('wrap') === 'off' ? 'Enable' : 'Disable') + ' word wrap', action: () => { ta.setAttribute('wrap', ta.getAttribute('wrap') === 'off' ? 'soft' : 'off'); lines(); } }, { icon: '🔤', label: 'Monospace font', action: () => ta.classList.toggle('prose') }]),
      h('div', { class: 'tb-spacer' }), runBtn);
    win.body.append(h('div', { class: 'editor' }, bar, findBar, h('div', { class: 'ed-wrap' }, gutter, ta), status));

    function lines() {
      const n = ta.value.split('\n').length;
      if (gutter.childElementCount !== n) gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
      gutter.style.display = ta.getAttribute('wrap') === 'off' ? '' : 'none';
      const pos = ta.value.slice(0, ta.selectionStart).split('\n');
      status.textContent = `${path || 'Untitled'}${dirty ? ' •' : ''}   Ln ${pos.length}, Col ${pos[pos.length - 1].length + 1}   ${ta.value.length} chars, ${ta.value.split(/\s+/).filter(Boolean).length} words   ${(VFS.ext(path || '') || 'txt').toUpperCase()}`;
    }
    function title() { win.setTitle((dirty ? '• ' : '') + (path ? VFS.basename(path) : 'Untitled') + ' — Rocket Write'); runBtn.classList.toggle('hidden', !path || !['log', 'esl', 'hsl'].includes(VFS.ext(path))); }
    function load(p) {
      try { ta.value = VFS.read(p); path = p; dirty = false; title(); lines(); OS.addRecent(p); }
      catch (e) { OS.alert(e.message, 'Open', '⚠️'); }
    }
    async function save() { if (!path) return saveAs(); try { VFS.write(path, ta.value); dirty = false; title(); lines(); } catch (e) { OS.alert(e.message, 'Save', '⚠️'); } }
    async function saveAs() { const p = await OS.prompt('Save as (path):', path || VFS.home() + '/Documents/untitled.txt', 'Save As', { icon: '💾' }); if (!p) return; path = VFS.normalize(p, VFS.home()); await save(); }
    async function openFile() { if (!(await guard())) return; const p = await OS.prompt('Open file (path):', path || VFS.home() + '/Documents/', 'Open', { icon: '📂' }); if (p) load(VFS.normalize(p, VFS.home())); }
    async function newFile() { if (!(await guard())) return; ta.value = ''; path = null; dirty = false; title(); lines(); }
    async function guard() { if (!dirty) return true; const b = await OS.dialog({ title: 'Unsaved changes', message: 'Save changes before continuing?', buttons: ['Save', "Don't save", 'Cancel'], icon: '💾' }); if (b === 'Cancel') return false; if (b === 'Save') await save(); return true; }
    function download() { const a = h('a', { href: URL.createObjectURL(new Blob([ta.value])), download: path ? VFS.basename(path) : 'untitled.txt' }); a.click(); }
    function showFind() { findBar.classList.remove('hidden'); fInput.value = ta.value.slice(ta.selectionStart, ta.selectionEnd) || fInput.value; fInput.focus(); }
    function find() { const q = fInput.value; if (!q) return; let i = ta.value.indexOf(q, ta.selectionEnd); if (i < 0) i = ta.value.indexOf(q); if (i >= 0) { ta.focus(); ta.setSelectionRange(i, i + q.length); } }
    function replaceAll() { if (!fInput.value) return; ta.value = ta.value.split(fInput.value).join(rInput.value); changed(); }
    function transform(fn) { const s = ta.selectionStart, e = ta.selectionEnd; ta.setRangeText(fn(ta.value.slice(s, e)), s, e, 'select'); changed(); }
    function insert(t) { ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, 'end'); changed(); ta.focus(); }
    async function run() { await save(); OS.openFile(path); }
    function changed() { if (!dirty) { dirty = true; title(); } lines(); }

    ta.addEventListener('input', changed);
    ta.addEventListener('click', lines); ta.addEventListener('keyup', lines);
    ta.addEventListener('scroll', () => gutter.scrollTop = ta.scrollTop);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); insert('  '); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); save(); }
      if (e.ctrlKey && e.key === 'o') { e.preventDefault(); openFile(); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); newFile(); }
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); showFind(); }
    });
    fInput.addEventListener('keydown', e => { if (e.key === 'Enter') find(); });
    win.beforeClose = async () => guard();
    if (path) load(path); else { title(); lines(); }
    ta.focus();
  } });
