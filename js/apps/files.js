/* File Manager */
OS.registerApp({ id: 'files', name: 'Files', icon: '📁', category: 'System', width: 780, height: 500, desc: 'Browse and manage the file system',
  launch(win, args = {}) {
    const { h } = OS;
    let cwd = VFS.isDir(args.path || '') ? VFS.normalize(args.path) : VFS.home();
    const back = [], fwd = []; let view = localStorage.getItem('rocketos.files.view') || 'grid'; let selected = null, clip = null, showHidden = false;
    const pathInput = h('input', { class: 'input path' });
    const bBack = h('button', { class: 'btn icon', title: 'Back' }, '←'), bFwd = h('button', { class: 'btn icon', title: 'Forward' }, '→'), bUp = h('button', { class: 'btn icon', title: 'Up' }, '↑');
    const search = h('input', { class: 'input search', placeholder: '🔍 Filter' });
    const viewBtn = h('button', { class: 'btn icon', title: 'Toggle view' }, '☷');
    const newBtn = h('button', { class: 'btn' }, '＋ New');
    const toolbar = h('div', { class: 'fm-toolbar' }, bBack, bFwd, bUp, pathInput, search, newBtn, viewBtn);
    const side = h('div', { class: 'fm-side' });
    const main = h('div', { class: 'fm-main' });
    const status = h('div', { class: 'fm-status' });
    win.body.append(h('div', { class: 'fm' }, toolbar, h('div', { class: 'fm-wrap' }, side, main), status));

    const places = [['🏠', 'Home', () => VFS.home()], ['🖥️', 'Desktop', () => VFS.home() + '/Desktop'], ['📂', 'Documents', () => VFS.home() + '/Documents'], ['🖼️', 'Pictures', () => VFS.home() + '/Pictures'], ['🎵', 'Music', () => VFS.home() + '/Music'], ['📜', 'Scripts', () => VFS.home() + '/scripts'], ['🧩', 'My Apps', () => VFS.home() + '/apps'], ['📦', 'Applications', () => '/apps'], ['💾', 'Root /', () => '/'], ['🗑️', 'Trash', () => VFS.home() + '/.trash']];
    const renderSide = () => { side.innerHTML = ''; places.forEach(([i, n, p]) => { const path = p(); const el = h('div', { class: 'fm-place' + (cwd === path ? ' on' : '') }, i + ' ' + n); el.addEventListener('click', () => go(path)); side.append(el); }); };

    function go(p, push = true) {
      p = VFS.normalize(p);
      if (!VFS.isDir(p)) { if (VFS.exists(p)) return OS.openFile(p); OS.alert(`${p} is not a folder`, 'Files', '⚠️'); return; }
      if (push && p !== cwd) { back.push(cwd); fwd.length = 0; }
      cwd = p; selected = null; render();
    }
    bBack.onclick = () => { if (back.length) { fwd.push(cwd); go(back.pop(), false); } };
    bFwd.onclick = () => { if (fwd.length) { back.push(cwd); go(fwd.pop(), false); } };
    bUp.onclick = () => go(VFS.dirname(cwd));
    pathInput.addEventListener('keydown', e => { if (e.key === 'Enter') go(VFS.normalize(pathInput.value, cwd)); });
    search.addEventListener('input', () => render());
    viewBtn.onclick = () => { view = view === 'grid' ? 'list' : 'grid'; localStorage.setItem('rocketos.files.view', view); render(); };
    newBtn.onclick = e => { const r = newBtn.getBoundingClientRect(); OS.contextMenu(r.left, r.bottom, newItems()); };
    const newItems = () => [
      { icon: '📁', label: 'Folder', action: async () => { const n = await OS.prompt('Folder name:', 'New Folder'); if (n) VFS.mkdir(VFS.join(cwd, n)); } },
      { icon: '📄', label: 'Text file', action: async () => { const n = await OS.prompt('File name:', 'untitled.txt'); if (n) { VFS.write(VFS.join(cwd, n), ''); } } },
      { icon: '📜', label: 'Batch script (.log)', action: async () => { const n = await OS.prompt('Script name:', 'script.log'); if (n) VFS.write(VFS.join(cwd, n.endsWith('.log') ? n : n + '.log'), '# RocketOS batch script\necho Running $0\n'); } },
      { icon: '🔗', label: 'Shortcut (.hsl)', action: async () => { const t = await OS.prompt('Target (app:id, /path or url:…):', 'app:terminal'); if (!t) return; const n = await OS.prompt('Name:', 'Shortcut'); if (n) HSL.create(cwd, n, t); } },
      { icon: '🧩', label: 'App (.esl) in App Maker', action: () => OS.launch('appmaker') },
    ];

    function itemMenu(e, p) {
      e.preventDefault(); e.stopPropagation();
      const ext = VFS.ext(p);
      const inTrash = cwd.startsWith(VFS.home() + '/.trash');
      OS.contextMenu(e.clientX, e.clientY, [
        { icon: '▶️', label: 'Open', action: () => OS.openFile(p) },
        VFS.isFile(p) ? { icon: '📝', label: 'Open in Text Editor', action: () => OS.launch('editor', { path: p }) } : null,
        ext === 'esl' ? { icon: '🛠️', label: 'Edit in App Maker', action: () => OS.launch('appmaker', { path: p }) } : null,
        ext === 'log' ? { icon: '⚡', label: 'Run script', action: () => OS.openFile(p) } : null,
        '-',
        { icon: '✂️', label: 'Cut', action: () => clip = { p, cut: true } },
        { icon: '📋', label: 'Copy', action: () => clip = { p, cut: false } },
        { icon: '✏️', label: 'Rename', action: () => Desktop.renameFile(p) },
        { icon: '🔗', label: 'Shortcut on Desktop', action: () => HSL.create(VFS.home() + '/Desktop', VFS.basename(p), p, Desktop.fileIcon(p)) },
        inTrash ? { icon: '♻️', label: 'Restore to Home', action: () => VFS.mv(p, VFS.uniqueName(VFS.home(), VFS.basename(p))) } : null,
        inTrash ? { icon: '❌', label: 'Delete permanently', action: async () => { if (await OS.confirm(`Permanently delete ${VFS.basename(p)}?`)) VFS.rm(p, true); } } : { icon: '🗑️', label: 'Move to Trash', action: () => Desktop.trash(p) },
        '-', { icon: 'ℹ️', label: 'Properties', action: () => Desktop.properties(p) },
      ].filter(Boolean));
    }
    main.addEventListener('contextmenu', e => {
      if (e.target.closest('.fm-item')) return; e.preventDefault();
      const inTrash = cwd === VFS.home() + '/.trash';
      OS.contextMenu(e.clientX, e.clientY, [...newItems(), '-',
        { icon: '📋', label: 'Paste', disabled: !clip, action: paste },
        { icon: '👁️', label: (showHidden ? 'Hide' : 'Show') + ' hidden files', action: () => { showHidden = !showHidden; render(); } },
        { icon: '💻', label: 'Open Terminal here', action: () => OS.launch('terminal', { cwd }) },
        inTrash ? { icon: '🧹', label: 'Empty Trash', action: async () => { if (await OS.confirm('Empty the trash?')) VFS.list(cwd).forEach(n => VFS.rm(VFS.join(cwd, n), true)); } } : null,
      ].filter(Boolean));
    });
    function paste() {
      if (!clip) return;
      try { if (clip.cut) { VFS.mv(clip.p, cwd); clip = null; } else { const dst = VFS.exists(VFS.join(cwd, VFS.basename(clip.p))) ? VFS.uniqueName(cwd, VFS.basename(clip.p).replace(/\.[^.]+$/, '') + ' copy', (VFS.basename(clip.p).match(/\.[^.]+$/) || [''])[0]) : cwd; VFS.cp(clip.p, dst); } }
      catch (err) { OS.alert(err.message, 'Paste', '⚠️'); }
    }
    win.body.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Delete' && selected) Desktop.trash(selected);
      if (e.key === 'Backspace') bUp.onclick();
      if (e.ctrlKey && e.key === 'c' && selected) clip = { p: selected, cut: false };
      if (e.ctrlKey && e.key === 'x' && selected) clip = { p: selected, cut: true };
      if (e.ctrlKey && e.key === 'v') paste();
      if (e.key === 'F2' && selected) Desktop.renameFile(selected);
    });
    win.body.tabIndex = 0;

    function render() {
      if (!VFS.isDir(cwd)) cwd = VFS.home();
      renderSide();
      pathInput.value = cwd; win.setTitle('Files — ' + (VFS.basename(cwd) || '/'));
      bBack.disabled = !back.length; bFwd.disabled = !fwd.length;
      main.innerHTML = ''; main.className = 'fm-main ' + view;
      const q = search.value.toLowerCase();
      const names = VFS.list(cwd).filter(n => (showHidden || !n.startsWith('.')) && n.toLowerCase().includes(q));
      if (view === 'list') main.append(h('div', { class: 'fm-row head' }, h('span', {}, 'Name'), h('span', {}, 'Size'), h('span', {}, 'Type'), h('span', {}, 'Modified')));
      names.forEach(n => {
        const p = VFS.join(cwd, n), st = VFS.stat(p);
        const el = view === 'grid'
          ? h('div', { class: 'fm-item', title: n }, h('div', { class: 'fi-icon' }, Desktop.fileIcon(p)), h('div', { class: 'fi-name' }, n))
          : h('div', { class: 'fm-item fm-row' }, h('span', {}, Desktop.fileIcon(p) + ' ' + n), h('span', {}, st.type === 'dir' ? st.size + ' items' : OS.fmtSize(st.size)), h('span', {}, st.type === 'dir' ? 'Folder' : (VFS.ext(n) || 'file').toUpperCase()), h('span', {}, new Date(st.mtime).toLocaleString()));
        el.addEventListener('click', () => { main.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); selected = p; status.textContent = `${n} — ${st.type === 'dir' ? 'folder' : OS.fmtSize(st.size)}`; });
        el.addEventListener('dblclick', () => VFS.isDir(p) ? go(p) : OS.openFile(p));
        el.addEventListener('contextmenu', e => { el.click(); itemMenu(e, p); });
        el.draggable = true;
        el.addEventListener('dragstart', e => e.dataTransfer.setData('text/rocket-path', p));
        if (st.type === 'dir') { el.addEventListener('dragover', e => e.preventDefault()); el.addEventListener('drop', e => { e.preventDefault(); const src = e.dataTransfer.getData('text/rocket-path'); if (src && src !== p) { try { VFS.mv(src, p); } catch (err) { OS.alert(err.message); } } }); }
        main.append(el);
      });
      if (!names.length) main.append(h('div', { class: 'muted pad center' }, q ? 'No matches.' : 'This folder is empty.'));
      status.textContent = `${names.length} item${names.length === 1 ? '' : 's'} · ${cwd}`;
    }
    let t; const off = VFS.on('change', () => { clearTimeout(t); t = setTimeout(() => { if (!win.closed) render(); }, 60); });
    render();
  } });

/* Image viewer (images are stored as data: URLs in files) */
OS.registerApp({ id: 'imageviewer', name: 'Image Viewer', icon: '🖼️', category: 'Media', width: 600, height: 460, hidden: true,
  launch(win, args) {
    const src = VFS.read(args.path);
    win.setTitle(VFS.basename(args.path));
    win.body.append(OS.h('div', { class: 'imgview' }, OS.h('img', { src })));
  } });
['png', 'jpg', 'jpeg', 'gif', 'webp'].forEach(e => OS.registerOpener(e, path => OS.launch('imageviewer', { path })));
OS.registerOpener('esl', (path, opts) => ESL.run(path));
OS.registerOpener('hsl', path => HSL.open(path));
