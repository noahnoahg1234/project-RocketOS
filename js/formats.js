/* RocketOS file formats:
 *  .esl  — Executable Script Layout: RocketOS application packages (metadata + html/css/js sections)
 *  .hsl  — Hyper Shortcut Link: shortcuts to apps, files, folders or URLs
 *  .log  — batch scripts: one shell command per line, run by the RocketOS shell
 */
const ESL = (() => {
  /* Format:
   *   #!esl
   *   name: My App
   *   icon: 🚀
   *   version: 1.0
   *   author: user
   *   width: 480
   *   height: 360
   *   category: Utilities
   *   description: Does things
   *   builtin: calculator       (optional — points to a native RocketOS app)
   *   ---html
   *   <h1>Hello</h1>
   *   ---css
   *   h1 { color: orange }
   *   ---js
   *   os.notify('Hi', 'from my app');
   */
  function parse(text) {
    const meta = {}, sections = { html: '', css: '', js: '' };
    const lines = String(text).replace(/\r/g, '').split('\n');
    let cur = null;
    for (const line of lines) {
      const m = line.match(/^---(html|css|js)\s*$/);
      if (m) { cur = m[1]; continue; }
      if (cur) { sections[cur] += line + '\n'; continue; }
      if (line.startsWith('#')) continue;
      const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (kv) meta[kv[1].toLowerCase()] = kv[2].trim();
    }
    meta.name = meta.name || 'Untitled App';
    meta.icon = meta.icon || '📦';
    meta.width = +meta.width || 480; meta.height = +meta.height || 360;
    return { meta, html: sections.html.trimEnd(), css: sections.css.trimEnd(), js: sections.js.trimEnd() };
  }

  function serialize({ meta = {}, html = '', css = '', js = '' }) {
    const order = ['name', 'icon', 'version', 'author', 'category', 'description', 'width', 'height', 'builtin'];
    let out = '#!esl\n';
    const keys = [...order.filter(k => meta[k] != null && meta[k] !== ''), ...Object.keys(meta).filter(k => !order.includes(k) && meta[k] != null && meta[k] !== '')];
    for (const k of keys) out += `${k}: ${String(meta[k]).replace(/\n/g, ' ')}\n`;
    if (meta.builtin) return out;
    return out + `---html\n${html}\n---css\n${css}\n---js\n${js}\n`;
  }

  // The bridge script injected into every sandboxed ESL app: exposes the `os` API.
  const BRIDGE = `
<script>
(function(){
  let seq=0; const waiting={};
  function call(method, args){ return new Promise((res,rej)=>{ const id=++seq; waiting[id]={res,rej}; parent.postMessage({__esl:1,id,method,args},'*'); }); }
  addEventListener('message', e=>{ const d=e.data; if(!d||!d.__eslReply) return; const w=waiting[d.id]; if(!w) return; delete waiting[d.id]; d.error?w.rej(new Error(d.error)):w.res(d.result); });
  window.os = {
    notify:(title,body,icon)=>call('notify',[title,body,icon]),
    alert:(msg)=>call('alert',[msg]),
    prompt:(msg,val)=>call('prompt',[msg,val]),
    open:(target)=>call('open',[target]),
    launch:(appId)=>call('launch',[appId]),
    setTitle:(t)=>call('setTitle',[t]),
    close:()=>call('close',[]),
    time:()=>call('time',[]),
    online:()=>call('online',[]),
    run:(cmd)=>call('run',[cmd]),
    fs:{ read:p=>call('fs.read',[p]), write:(p,c)=>call('fs.write',[p,c]), list:p=>call('fs.list',[p]), exists:p=>call('fs.exists',[p]), mkdir:p=>call('fs.mkdir',[p]), remove:p=>call('fs.remove',[p]) },
    storage:{ get:k=>call('storage.get',[k]), set:(k,v)=>call('storage.set',[k,v]) },
  };
  window.addEventListener('error', e=>parent.postMessage({__esl:1,id:0,method:'error',args:[String(e.message)+' (line '+e.lineno+')']},'*'));
})();
<\/script>`;

  function buildDoc(app) {
    const theme = OS.settings.theme === 'light'
      ? 'body{background:#f6f7fb;color:#1b1e28}' : 'body{background:#1a1d27;color:#e8ebf3}';
    return `<!doctype html><html><head><meta charset="utf-8">${BRIDGE}
<style>html,body{margin:0;height:100%}body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;box-sizing:border-box}${theme}
button{font:inherit;cursor:pointer;padding:6px 12px;border-radius:6px;border:1px solid #8884;background:#ff6b35;color:#fff}
input,textarea,select{font:inherit;padding:6px;border-radius:6px;border:1px solid #8886;background:transparent;color:inherit}
${app.css || ''}</style></head><body>${app.html || ''}
<script>${(app.js || '').replace(/<\/script>/gi, '<\\/script>')}<\/script></body></html>`;
  }

  const running = new Map(); // iframe.contentWindow -> {win, appName}

  addEventListener('message', async e => {
    const d = e.data; if (!d || !d.__esl) return;
    const ctx = running.get(e.source); if (!ctx) return;
    const reply = (result, error) => { try { e.source.postMessage({ __eslReply: 1, id: d.id, result, error }, '*'); } catch {} };
    const [a, b, c] = d.args || [];
    const ns = 'rocketos.esl.' + ctx.appName;
    try {
      let r;
      switch (d.method) {
        case 'notify': OS.notify(String(a || ctx.appName), String(b || ''), c || ctx.icon); break;
        case 'alert': await OS.alert(String(a), ctx.appName, ctx.icon); break;
        case 'prompt': r = await OS.prompt(String(a), b || '', ctx.appName); break;
        case 'open': if (OS.getApp(a)) OS.launch(a); else OS.openFile(VFS.normalize(a)); break;
        case 'launch': OS.launch(a); break;
        case 'setTitle': ctx.win.setTitle(String(a)); break;
        case 'close': ctx.win.close(); break;
        case 'time': r = new Date().toISOString(); break;
        case 'online': r = NET.online(); break;
        case 'run': r = await Shell.exec(String(a), { cwd: VFS.home() }); break;
        case 'fs.read': r = VFS.read(VFS.normalize(a, VFS.home())); break;
        case 'fs.write': VFS.write(VFS.normalize(a, VFS.home()), b); r = true; break;
        case 'fs.list': r = VFS.list(VFS.normalize(a || '~', VFS.home())); break;
        case 'fs.exists': r = VFS.exists(VFS.normalize(a, VFS.home())); break;
        case 'fs.mkdir': VFS.mkdir(VFS.normalize(a, VFS.home())); r = true; break;
        case 'fs.remove': VFS.rm(VFS.normalize(a, VFS.home()), true); r = true; break;
        case 'storage.get': r = JSON.parse(localStorage.getItem(ns + '.' + a) || 'null'); break;
        case 'storage.set': localStorage.setItem(ns + '.' + a, JSON.stringify(b)); r = true; break;
        case 'error': OS.notify(ctx.appName + ' error', String(a), '🐞'); return;
        default: throw new Error('Unknown os method ' + d.method);
      }
      reply(r);
    } catch (err) { reply(null, err.message); }
  });

  /** Run an ESL app from text. Returns the window. */
  function runText(text, path) {
    const app = parse(text);
    if (app.meta.builtin) return OS.launch(app.meta.builtin.trim(), { path });
    const win = WM.create({ title: app.meta.name, icon: app.meta.icon, width: app.meta.width, height: app.meta.height + 34, appId: 'esl:' + (path || app.meta.name) });
    const frame = OS.h('iframe', { class: 'esl-frame', sandbox: 'allow-scripts allow-modals allow-pointer-lock', srcdoc: buildDoc(app) });
    win.body.append(frame);
    const proc = OS.spawn(app.meta.name + '.esl', { win, appId: 'esl' });
    win.proc = proc;
    frame.addEventListener('load', () => running.set(frame.contentWindow, { win, appName: app.meta.name, icon: app.meta.icon }));
    // contentWindow exists right away for srcdoc frames, register early too so first calls aren't lost
    if (frame.contentWindow) running.set(frame.contentWindow, { win, appName: app.meta.name, icon: app.meta.icon });
    win.onClose(() => { running.delete(frame.contentWindow); const i = OS.procs.indexOf(proc); if (i >= 0) OS.procs.splice(i, 1); OS.emit('procs'); });
    OS.log(`esl: started ${app.meta.name}`);
    return win;
  }
  function run(path) { return runText(VFS.read(path), path); }

  return { parse, serialize, buildDoc, run, runText };
})();

const HSL = (() => {
  /* Format (INI-style):
   *   [Shortcut]
   *   name=Terminal
   *   icon=💻
   *   target=app:terminal        (app:<id> | /absolute/path | url:https://…)
   *   args=
   */
  function parse(text) {
    const o = {};
    String(text).replace(/\r/g, '').split('\n').forEach(l => {
      const m = l.match(/^\s*([\w-]+)\s*=\s*(.*)$/); if (m) o[m[1].toLowerCase()] = m[2].trim();
    });
    return o;
  }
  function serialize(o) { return `[Shortcut]\nname=${o.name || ''}\nicon=${o.icon || ''}\ntarget=${o.target || ''}\nargs=${o.args || ''}\n`; }
  function iconFor(text) {
    const s = parse(text);
    if (s.icon) return s.icon;
    if (s.target && s.target.startsWith('app:')) { const a = OS.getApp(s.target.slice(4)); if (a) return a.icon; }
    if (s.target && s.target.startsWith('url:')) return '🌐';
    return '🔗';
  }
  function open(path) {
    const s = parse(VFS.read(path));
    const t = s.target || '';
    if (t.startsWith('app:')) return OS.launch(t.slice(4), s.args ? { args: s.args } : {});
    if (t.startsWith('url:')) return OS.launch('browser', { url: t.slice(4) });
    if (t.startsWith('cmd:')) return OS.launch('terminal', { run: t.slice(4) });
    if (t && VFS.exists(t)) return OS.openFile(t);
    OS.alert(`The shortcut target “${t}” could not be found.`, 'Broken shortcut', '🔗');
  }
  function create(dir, name, target, icon = '') {
    const p = VFS.uniqueName(dir, name, '.hsl');
    VFS.write(p, serialize({ name, target, icon }));
    return p;
  }
  return { parse, serialize, open, create, iconFor };
})();

/* .log batch files are executed by the shell (see terminal.js → Shell.runScript). */
