/* RocketOS Virtual File System — a Unix-style tree persisted in localStorage. */
const VFS = (() => {
  const KEY = 'rocketos.fs.v1';
  let root = null;
  let saveTimer = null;

  const now = () => Date.now();
  const dir = () => ({ type: 'dir', children: {}, mtime: now(), mode: 'rwxr-xr-x' });
  const file = (content = '') => ({ type: 'file', content: String(content), mtime: now(), mode: 'rw-r--r--' });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { root = JSON.parse(raw); return true; }
    } catch (e) { console.warn('VFS load failed', e); }
    return false;
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(root)); }
      catch (e) { console.warn('VFS save failed (storage full?)', e); if (window.OS) OS.notify('Storage', 'Disk is full — could not save files.', '⚠️'); }
    }, 150);
  }

  function home() { return '/home/' + ((window.OS && OS.settings && OS.settings.username) || 'user'); }

  function normalize(path, cwd = '/') {
    if (path == null || path === '') path = '.';
    path = String(path);
    if (path === '~' || path.startsWith('~/')) path = home() + path.slice(1);
    const parts = (path.startsWith('/') ? path : cwd + '/' + path).split('/');
    const out = [];
    for (const p of parts) {
      if (!p || p === '.') continue;
      if (p === '..') out.pop(); else out.push(p);
    }
    return '/' + out.join('/');
  }

  function getNode(path) {
    const p = normalize(path);
    if (p === '/') return root;
    let n = root;
    for (const part of p.slice(1).split('/')) {
      if (!n || n.type !== 'dir') return null;
      n = n.children[part];
    }
    return n || null;
  }

  function parentOf(path) {
    const p = normalize(path);
    const i = p.lastIndexOf('/');
    return { dir: i <= 0 ? '/' : p.slice(0, i), name: p.slice(i + 1) };
  }

  function basename(p) { return parentOf(p).name; }
  function dirname(p) { return parentOf(p).dir; }
  function ext(p) { const b = basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i + 1).toLowerCase() : ''; }
  function join(...a) { return normalize(a.join('/')); }

  function exists(p) { return !!getNode(p); }
  function isDir(p) { const n = getNode(p); return !!n && n.type === 'dir'; }
  function isFile(p) { const n = getNode(p); return !!n && n.type === 'file'; }

  function mkdir(p, recursive = true) {
    p = normalize(p);
    if (p === '/') return root;
    const { dir: d, name } = parentOf(p);
    let parent = getNode(d);
    if (!parent) {
      if (!recursive) throw new Error(`mkdir: ${d}: No such file or directory`);
      parent = mkdir(d, true);
    }
    if (parent.type !== 'dir') throw new Error(`mkdir: ${d}: Not a directory`);
    if (!parent.children[name]) { parent.children[name] = dir(); parent.mtime = now(); save(); emit('change', p); }
    else if (parent.children[name].type !== 'dir') throw new Error(`mkdir: ${p}: File exists`);
    return parent.children[name];
  }

  function read(p) {
    const n = getNode(p);
    if (!n) throw new Error(`${p}: No such file or directory`);
    if (n.type === 'dir') throw new Error(`${p}: Is a directory`);
    return n.content;
  }

  function write(p, content, append = false) {
    p = normalize(p);
    const { dir: d, name } = parentOf(p);
    if (!name) throw new Error('write: invalid path');
    const parent = getNode(d) || mkdir(d, true);
    if (parent.type !== 'dir') throw new Error(`${d}: Not a directory`);
    const ex = parent.children[name];
    if (ex && ex.type === 'dir') throw new Error(`${p}: Is a directory`);
    if (ex) { ex.content = append ? ex.content + String(content) : String(content); ex.mtime = now(); }
    else parent.children[name] = file(content);
    parent.mtime = now();
    save(); emit('change', p);
    return true;
  }

  function list(p) {
    const n = getNode(p);
    if (!n) throw new Error(`${p}: No such file or directory`);
    if (n.type !== 'dir') throw new Error(`${p}: Not a directory`);
    return Object.keys(n.children).sort((a, b) => {
      const da = n.children[a].type === 'dir', db = n.children[b].type === 'dir';
      if (da !== db) return da ? -1 : 1;
      return a.localeCompare(b);
    });
  }

  function stat(p) {
    const n = getNode(p);
    if (!n) return null;
    return { type: n.type, size: n.type === 'file' ? n.content.length : Object.keys(n.children).length, mtime: n.mtime, mode: n.mode || '' };
  }

  function rm(p, recursive = false) {
    p = normalize(p);
    if (p === '/') throw new Error('rm: refusing to remove /');
    const n = getNode(p);
    if (!n) throw new Error(`rm: ${p}: No such file or directory`);
    if (n.type === 'dir' && !recursive && Object.keys(n.children).length) throw new Error(`rm: ${p}: Directory not empty`);
    const { dir: d, name } = parentOf(p);
    delete getNode(d).children[name];
    save(); emit('change', p);
  }

  function clone(n) { return JSON.parse(JSON.stringify(n)); }

  function cp(src, dst) {
    const n = getNode(src);
    if (!n) throw new Error(`cp: ${src}: No such file or directory`);
    dst = normalize(dst);
    if (isDir(dst)) dst = join(dst, basename(src));
    if (dst === normalize(src)) throw new Error('cp: source and destination are the same');
    const { dir: d, name } = parentOf(dst);
    const parent = getNode(d) || mkdir(d, true);
    parent.children[name] = clone(n);
    parent.children[name].mtime = now();
    save(); emit('change', dst);
    return dst;
  }

  function mv(src, dst) {
    src = normalize(src); dst = normalize(dst);
    if (isDir(dst)) dst = join(dst, basename(src));
    if (dst === src) return dst;
    if (dst.startsWith(src + '/')) throw new Error('mv: cannot move a directory into itself');
    cp(src, dst); rm(src, true);
    return dst;
  }

  function walk(p, fn, depth = 0) {
    const n = getNode(p);
    if (!n) return;
    fn(normalize(p), n, depth);
    if (n.type === 'dir') for (const k of Object.keys(n.children)) walk(join(p, k), fn, depth + 1);
  }

  function usage() { try { return (localStorage.getItem(KEY) || '').length; } catch { return 0; } }

  function uniqueName(dirPath, base, extension = '') {
    let name = base + extension, i = 2;
    while (exists(join(dirPath, name))) name = `${base} (${i++})${extension}`;
    return join(dirPath, name);
  }

  // --- events
  const listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev, data) { (listeners[ev] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } }); }

  function reset() { localStorage.removeItem(KEY); root = null; }

  function init(seed) {
    if (!load()) {
      root = dir();
      seed && seed();
      try { localStorage.setItem(KEY, JSON.stringify(root)); } catch {}
    }
  }

  return { init, normalize, getNode, exists, isDir, isFile, mkdir, read, write, list, stat, rm, cp, mv, walk,
    basename, dirname, ext, join, home, usage, uniqueName, on, reset, save };
})();
