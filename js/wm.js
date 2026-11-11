/* RocketOS Window Manager: drag, resize (8 edges), snap, minimize, maximize, focus, z-order. */
const WM = (() => {
  const wins = [];
  let z = 10, nextId = 1, focused = null;
  const area = () => document.getElementById('windows');

  function create(opts) {
    const { h } = OS;
    const id = nextId++;
    const D = document.getElementById('desktop').getBoundingClientRect();
    const width = Math.min(opts.width || 640, D.width - 20);
    const height = Math.min(opts.height || 440, D.height - 20);
    const offset = (wins.filter(w => !w.modal).length % 8) * 26;
    let x = opts.x != null ? opts.x : Math.max(10, (D.width - width) / 2 - 100 + offset);
    let y = opts.y != null ? opts.y : Math.max(10, (D.height - height) / 2 - 60 + offset);
    if (opts.modal) { x = (D.width - width) / 2; y = (D.height - height) / 2 - 40; }

    const titleEl = h('span', { class: 'wtitle' }, opts.title || 'Window');
    const iconEl = h('span', { class: 'wicon' }, opts.icon || '🪟');
    const btn = (cls, label, title, fn) => h('button', { class: 'wbtn ' + cls, title, onclick: e => { e.stopPropagation(); fn(); } }, label);
    const bar = h('div', { class: 'wbar' }, iconEl, titleEl, h('div', { class: 'wbtns' },
      opts.modal ? '' : btn('min', '–', 'Minimize', () => win.minimize()),
      opts.modal || opts.resizable === false ? '' : btn('max', '□', 'Maximize', () => win.toggleMax()),
      btn('close', '×', 'Close', () => win.close())));
    const body = h('div', { class: 'wbody' });
    const el = h('div', { class: 'window opening' + (opts.modal ? ' modal' : ''), 'data-wid': id }, bar, body);
    el.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;`;
    if (opts.resizable !== false) ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(d => el.append(h('div', { class: 'rz rz-' + d, 'data-dir': d })));
    area().append(el);
    setTimeout(() => el.classList.remove('opening'), 200);

    const closeFns = [], resizeFns = [];
    const win = {
      id, el, body, bar, appId: opts.appId, icon: opts.icon, title: opts.title, modal: !!opts.modal, noTaskbar: !!opts.noTaskbar,
      minimized: false, maximized: false, snapped: null, prev: null,
      minWidth: opts.minWidth || 240, minHeight: opts.minHeight || 120,
      setTitle(t) { win.title = t; titleEl.textContent = t; OS.emit('wm'); },
      setIcon(i) { win.icon = i; iconEl.textContent = i; OS.emit('wm'); },
      onClose(fn) { closeFns.push(fn); },
      onResize(fn) { resizeFns.push(fn); },
      beforeClose: null,
      async close(force) {
        if (!force && win.beforeClose) { const ok = await win.beforeClose(); if (ok === false) return; }
        if (win.closed) return; win.closed = true;
        el.classList.add('closing');
        closeFns.forEach(f => { try { f(); } catch (e) { console.error(e); } });
        setTimeout(() => el.remove(), 150);
        wins.splice(wins.indexOf(win), 1);
        if (focused === win) { focused = null; const top = topmost(); if (top) top.focus(); }
        OS.emit('wm');
      },
      focus() {
        if (win.closed) return;
        if (focused && focused !== win) focused.el.classList.remove('focused');
        focused = win; el.classList.add('focused'); el.style.zIndex = win.modal ? 100000 + (++z) : ++z;
        OS.emit('wm');
      },
      minimize() { win.minimized = true; el.classList.add('minimized'); if (focused === win) { el.classList.remove('focused'); focused = null; const t = topmost(); if (t) t.focus(); } OS.emit('wm'); },
      restore() { if (win.minimized) { win.minimized = false; el.classList.remove('minimized'); } win.focus(); OS.emit('wm'); },
      toggleMax() { win.maximized ? win.unmax() : win.max(); },
      max() { if (!win.maximized && !win.snapped) win.prev = rect(); win.maximized = true; win.snapped = null; el.classList.add('maximized'); fireResize(); OS.emit('wm'); },
      unmax() { win.maximized = false; win.snapped = null; el.classList.remove('maximized', 'snap-left', 'snap-right'); if (win.prev) Object.assign(el.style, px(win.prev)); fireResize(); OS.emit('wm'); },
      snap(side) { if (!win.maximized && !win.snapped) win.prev = rect(); win.snapped = side; el.classList.remove('maximized', 'snap-left', 'snap-right'); el.classList.add('snap-' + side); fireResize(); },
      setRect(r) { Object.assign(el.style, px(r)); fireResize(); },
      get isFocused() { return focused === win; },
    };
    function rect() { return { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight }; }
    function px(r) { const o = {}; for (const k in r) o[k] = r[k] + 'px'; return o; }
    function fireResize() { setTimeout(() => resizeFns.forEach(f => f()), 180); }

    // focus on any pointerdown
    el.addEventListener('pointerdown', () => win.focus(), true);

    // dragging
    bar.addEventListener('dblclick', () => { if (opts.resizable !== false && !opts.modal) win.toggleMax(); });
    bar.addEventListener('pointerdown', e => {
      if (e.target.closest('.wbtn') || e.button !== 0) return;
      const D = document.getElementById('desktop').getBoundingClientRect();
      let sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop, moved = false, snapHint = null;
      const ghost = document.getElementById('snap-ghost') || document.getElementById('desktop').appendChild(h('div', { id: 'snap-ghost' }));
      bar.setPointerCapture(e.pointerId);
      const move = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        if (!moved && (win.maximized || win.snapped)) {
          // pull out of maximized state, keep cursor proportionally on bar
          const w = win.prev ? win.prev.width : el.offsetWidth;
          win.maximized = false; win.snapped = null; el.classList.remove('maximized', 'snap-left', 'snap-right');
          el.style.width = w + 'px'; if (win.prev) el.style.height = win.prev.height + 'px';
          ox = ev.clientX - D.left - w / 2; oy = 0; sx = ev.clientX; sy = ev.clientY;
          OS.emit('wm');
        }
        moved = true; el.classList.add('dragging');
        el.style.left = (ox + ev.clientX - sx) + 'px';
        el.style.top = Math.max(0, oy + ev.clientY - sy) + 'px';
        if (opts.resizable === false || opts.modal) return;
        const cx = ev.clientX - D.left, cy = ev.clientY - D.top;
        snapHint = cy < 6 ? 'max' : cx < 6 ? 'left' : cx > D.width - 6 ? 'right' : null;
        ghost.className = snapHint ? 'show ' + snapHint : '';
      };
      const up = () => {
        bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up);
        el.classList.remove('dragging'); ghost.className = '';
        if (snapHint === 'max') win.max(); else if (snapHint) win.snap(snapHint);
      };
      bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up);
    });

    // resizing
    el.querySelectorAll('.rz').forEach(handle => handle.addEventListener('pointerdown', e => {
      if (win.maximized) return;
      e.stopPropagation(); e.preventDefault();
      const dir = handle.dataset.dir, sx = e.clientX, sy = e.clientY, r = rect();
      handle.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      const move = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy; const n = { ...r };
        if (dir.includes('e')) n.width = Math.max(win.minWidth, r.width + dx);
        if (dir.includes('s')) n.height = Math.max(win.minHeight, r.height + dy);
        if (dir.includes('w')) { n.width = Math.max(win.minWidth, r.width - dx); n.left = r.left + r.width - n.width; }
        if (dir.includes('n')) { n.height = Math.max(win.minHeight, r.height - dy); n.top = Math.max(0, r.top + r.height - n.height); }
        Object.assign(el.style, px(n));
        resizeFns.forEach(f => f());
      };
      const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); el.classList.remove('dragging'); win.snapped = null; el.classList.remove('snap-left', 'snap-right'); };
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up);
    }));

    wins.push(win);
    win.focus();
    return win;
  }

  function topmost() { return wins.filter(w => !w.minimized).sort((a, b) => (+b.el.style.zIndex) - (+a.el.style.zIndex))[0] || null; }
  function list() { return wins.slice(); }
  function showDesktop() {
    const anyVisible = wins.some(w => !w.minimized && !w.modal);
    if (anyVisible) { wins.forEach(w => { if (!w.modal && !w.minimized) { w._sd = true; w.minimize(); } }); }
    else wins.forEach(w => { if (w._sd) { w._sd = false; w.restore(); } });
  }
  function cascade() { wins.filter(w => !w.modal).forEach((w, i) => { w.restore(); w.unmax(); w.setRect({ left: 30 + i * 30, top: 20 + i * 30, width: 640, height: 440 }); }); }
  function tile() {
    const ws = wins.filter(w => !w.modal && !w.minimized); if (!ws.length) return;
    const D = document.getElementById('desktop').getBoundingClientRect();
    const cols = Math.ceil(Math.sqrt(ws.length)), rows = Math.ceil(ws.length / cols);
    ws.forEach((w, i) => { w.unmax(); w.setRect({ left: (i % cols) * D.width / cols, top: Math.floor(i / cols) * D.height / rows, width: D.width / cols, height: D.height / rows }); });
  }
  function closeAll() { wins.slice().forEach(w => w.close(true)); }

  // keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.altKey && e.key === 'F4' && focused) { e.preventDefault(); focused.close(); }
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 't') { e.preventDefault(); OS.launch('terminal'); }
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'd') { e.preventDefault(); showDesktop(); }
  });

  return { create, list, get focused() { return focused; }, showDesktop, cascade, tile, closeAll, topmost };
})();
