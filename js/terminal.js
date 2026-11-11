/* RocketOS shell (rsh) + Terminal app.
 * Supports: pipes |, redirects > >> <, chaining ; && ||, $VARS, "quotes", 'single quotes', globs *,
 * aliases, history, tab completion, for/if one-liners, .log batch scripts, and ~70 commands. */
const Shell = (() => {
  const C = { reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m', orange: '\x1b[93m' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ------------------------------------------------------------ tokenizer
  function tokenize(line, env) {
    const toks = []; let i = 0, cur = '', quoted = false, has = false;
    const push = () => { if (has) toks.push({ t: 'w', v: cur, q: quoted }); cur = ''; quoted = false; has = false; };
    const expand = (s, j) => { // returns [value, newIndex] for $VAR / ${VAR} / $?
      if (s[j + 1] === '{') { const e = s.indexOf('}', j); const name = s.slice(j + 2, e); return [env[name] ?? '', e + 1]; }
      const m = s.slice(j + 1).match(/^(\?|\d|[A-Za-z_]\w*)/);
      if (!m) return ['$', j + 1];
      return [env[m[1]] ?? '', j + 1 + m[1].length];
    };
    while (i < line.length) {
      const c = line[i];
      if (c === '\\' && i + 1 < line.length) { cur += line[i + 1]; has = true; i += 2; continue; }
      if (c === "'") { const e = line.indexOf("'", i + 1); if (e < 0) throw new Error('unterminated quote'); cur += line.slice(i + 1, e); quoted = true; has = true; i = e + 1; continue; }
      if (c === '"') {
        let j = i + 1; quoted = true; has = true;
        while (j < line.length && line[j] !== '"') {
          if (line[j] === '\\' && j + 1 < line.length) { cur += '$`"\\'.includes(line[j + 1]) ? line[j + 1] : '\\' + line[j + 1]; j += 2; continue; }
          if (line[j] === '$') { const [v, nj] = expand(line, j); cur += v; j = nj; continue; }
          cur += line[j++];
        }
        if (j >= line.length) throw new Error('unterminated quote');
        i = j + 1; continue;
      }
      if (c === '$') { const [v, ni] = expand(line, i); cur += v; has = true; i = ni; continue; }
      if (c === '#' && !has) break;
      if (/\s/.test(c)) { push(); i++; continue; }
      const two = line.slice(i, i + 2);
      if (['&&', '||', '>>'].includes(two)) { push(); toks.push({ t: 'op', v: two }); i += 2; continue; }
      if ('|;><'.includes(c)) { push(); toks.push({ t: 'op', v: c }); i++; continue; }
      if (c === '~' && !has && (i + 1 === line.length || /[\/\s]/.test(line[i + 1]))) { cur += env.HOME; has = true; i++; continue; }
      cur += c; has = true; i++;
    }
    push();
    return toks;
  }

  function parse(toks) {
    // -> [{pipeline:[{argv:[], out, append, inp}], op}]
    const chain = []; let pipeline = [], cmd = { argv: [] };
    const endCmd = () => { if (cmd.argv.length || cmd.out || cmd.inp) pipeline.push(cmd); cmd = { argv: [] }; };
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t === 'w') { cmd.argv.push(t); continue; }
      if (t.v === '>' || t.v === '>>' || t.v === '<') {
        const f = toks[++i]; if (!f || f.t !== 'w') throw new Error('syntax error near ' + t.v);
        if (t.v === '<') cmd.inp = f.v; else { cmd.out = f.v; cmd.append = t.v === '>>'; }
        continue;
      }
      if (t.v === '|') { endCmd(); continue; }
      endCmd(); if (pipeline.length) chain.push({ pipeline, op: t.v }); pipeline = [];
    }
    endCmd(); if (pipeline.length) chain.push({ pipeline, op: null });
    return chain;
  }

  function glob(word, cwd) {
    if (word.q || !/[*?]/.test(word.v)) return [word.v];
    const full = VFS.normalize(word.v, cwd), dir = VFS.dirname(full), pat = VFS.basename(full);
    const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    let names = []; try { names = VFS.list(dir).filter(n => re.test(n) && !n.startsWith('.')); } catch {}
    if (!names.length) return [word.v];
    const rel = word.v.includes('/') ? word.v.slice(0, word.v.lastIndexOf('/') + 1) : '';
    return names.map(n => rel + n);
  }

  function flags(args, valued = []) {
    const f = {}, rest = []; let done = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (done || !a.startsWith('-') || a === '-' || /^-\d/.test(a)) { rest.push(a); continue; }
      if (a === '--') { done = true; continue; }
      if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); f[k] = v ?? true; continue; }
      for (let j = 1; j < a.length; j++) { const k = a[j]; if (valued.includes(k)) { f[k] = a.slice(j + 1) || args[++i]; break; } f[k] = true; }
    }
    return { f, rest };
  }

  // ------------------------------------------------------------ session
  class Session {
    constructor(io = {}) {
      this.io = io; // {write(text), clear(), readLine(promptText) -> Promise<string>, term}
      this.cwd = io.cwd || VFS.home();
      this.env = { HOME: VFS.home(), USER: OS.settings.username, HOSTNAME: OS.settings.hostname, PATH: '/bin:/apps:' + VFS.home() + '/apps', SHELL: '/bin/rsh', TERM: 'rocket-256color', '?': '0', PS1: '' };
      this.aliases = Object.assign({ ll: 'ls -l', la: 'ls -la', cls: 'clear', '..': 'cd ..', dir: 'ls' }, JSON.parse(localStorage.getItem('rocketos.aliases') || '{}'));
      this.history = JSON.parse(localStorage.getItem('rocketos.history') || '[]');
      this.aborted = false;
    }
    write(s) { this.io.write ? this.io.write(String(s)) : null; }
    addHistory(line) { if (line.trim() && this.history[this.history.length - 1] !== line) { this.history.push(line); if (this.history.length > 500) this.history.shift(); try { localStorage.setItem('rocketos.history', JSON.stringify(this.history)); } catch {} } }
    resolve(p) { return VFS.normalize(p, this.cwd); }
    prompt() {
      const home = this.env.HOME; let d = this.cwd; if (d === home) d = '~'; else if (d.startsWith(home + '/')) d = '~' + d.slice(home.length);
      return `${C.green}${C.bold}${OS.settings.username}@${OS.settings.hostname}${C.reset}:${C.blue}${C.bold}${d}${C.reset}$ `;
    }

    /** Split a line into statements at top-level ';' (outside quotes and outside for/if/while blocks). */
    splitStatements(line) {
      const out = []; let cur = '', q = null, depth = 0, word = '', atStart = true;
      const endWord = () => {
        if (!word) return;
        if (atStart && /^(for|if|while)$/.test(word)) depth++;
        else if (atStart && /^(done|fi)$/.test(word)) depth = Math.max(0, depth - 1);
        atStart = depth > 0 && /^(do|then|else)$/.test(word);
        word = '';
      };
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) { cur += c; if (c === q) q = null; else if (c === '\\' && q === '"') cur += line[++i] || ''; continue; }
        if (c === '"' || c === "'") { q = c; cur += c; word += c; continue; }
        if (c === '\\') { cur += c + (line[i + 1] || ''); word += 'x'; i++; continue; }
        if (/\s/.test(c)) { endWord(); cur += c; continue; }
        if (c === '&' || c === '|') { endWord(); atStart = true; cur += c; continue; }
        if (c === ';') { endWord(); atStart = true; if (depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += c; continue; }
        if (c === '#' && !word && /(^|\s)$/.test(cur)) break;
        word += c; cur += c;
      }
      endWord(); if (cur.trim()) out.push(cur.trim());
      return out;
    }

    async run(line) {
      line = line.trim();
      if (!line) return 0;
      const stmts = this.splitStatements(line);
      if (stmts.length > 1) { let code = 0; for (const st of stmts) { if (this.aborted) break; code = await this.run(st); } return code; }
      line = stmts[0] || '';
      if (!line) return 0;
      // control-flow one-liners
      let m;
      if ((m = line.match(/^for\s+(\w+)\s+in\s+(.+?);\s*do\s+(.+?);?\s*done$/))) {
        const items = (await this.capture('echo ' + m[2])).trim().split(/\s+/).filter(Boolean);
        let code = 0;
        for (const it of items) { if (this.aborted) break; this.env[m[1]] = it; code = await this.run(m[3]); }
        return code;
      }
      if ((m = line.match(/^if\s+(.+?);\s*then\s+(.+?)(?:;\s*else\s+(.+?))?;?\s*fi$/))) {
        const ok = (await this.run(m[1])) === 0;
        return ok ? this.run(m[2]) : m[3] ? this.run(m[3]) : 0;
      }
      if ((m = line.match(/^while\s+(.+?);\s*do\s+(.+?);?\s*done$/))) {
        let n = 0; while (!this.aborted && n++ < 10000 && (await this.run(m[1])) === 0) { await this.run(m[2]); await sleep(0); }
        return 0;
      }
      let chain;
      try { chain = parse(tokenize(line, this.env)); }
      catch (e) { this.write(`${C.red}rsh: ${e.message}${C.reset}\n`); return 2; }
      let code = 0;
      for (let i = 0; i < chain.length; i++) {
        if (this.aborted) break;
        const prev = i > 0 ? chain[i - 1].op : null;
        if (prev === '&&' && code !== 0) continue;
        if (prev === '||' && code === 0) continue;
        code = await this.runPipeline(chain[i].pipeline);
        this.env['?'] = String(code);
      }
      return code;
    }

    async capture(line) { const old = this.io.write; let buf = ''; this.io.write = s => buf += s; try { await this.run(line); } finally { this.io.write = old; } return buf; }

    async runPipeline(pipeline) {
      let stdin = '', code = 0;
      for (let i = 0; i < pipeline.length; i++) {
        const cmd = pipeline[i];
        const last = i === pipeline.length - 1;
        let argv = cmd.argv.flatMap(w => glob(w, this.cwd));
        if (!argv.length) continue;
        // variable assignment
        if (argv.length === 1 && /^[A-Za-z_]\w*=/.test(argv[0]) && !cmd.argv[0].q) { const k = argv[0].split('=')[0]; this.env[k] = argv[0].slice(k.length + 1); continue; }
        // aliases
        if (this.aliases[argv[0]]) { const exp = tokenize(this.aliases[argv[0]], this.env).filter(t => t.t === 'w').map(t => t.v); argv = [...exp, ...argv.slice(1)]; }
        if (cmd.inp) { try { stdin = VFS.read(this.resolve(cmd.inp)); } catch (e) { this.write(`${C.red}rsh: ${e.message}${C.reset}\n`); return 1; } }
        let buf = '';
        const toTerm = last && !cmd.out;
        const ctx = {
          args: argv.slice(1), name: argv[0], stdin, sh: this, C,
          out: s => { s = String(s); if (toTerm) this.write(s); else buf += s; },
          err: s => this.write(`${C.red}${s}${C.reset}`),
        };
        code = await this.exec(argv[0], ctx);
        if (cmd.out) {
          try { VFS.write(this.resolve(cmd.out), buf.replace(/\x1b\[[\d;]*m/g, ''), cmd.append); }
          catch (e) { this.write(`${C.red}rsh: ${e.message}${C.reset}\n`); return 1; }
        }
        stdin = buf;
      }
      return code;
    }

    async exec(name, ctx) {
      const def = CMDS[name];
      try {
        if (def) { const r = await def.fn(ctx); return typeof r === 'number' ? r : 0; }
        // executable path: ./script.log, /apps/x.esl, or bare script name in cwd
        const p = this.resolve(name);
        if ((name.includes('/') || name.endsWith('.log') || name.endsWith('.esl')) && VFS.isFile(p)) return this.execFile(p, ctx);
        // search PATH for .esl / .log
        for (const dir of (this.env.PATH || '').split(':')) {
          for (const ext of ['', '.esl', '.log']) {
            const cand = VFS.join(dir, name + ext);
            if (VFS.isFile(cand)) return this.execFile(cand, ctx);
          }
        }
        if (OS.getApp(name)) { OS.launch(name); ctx.out(`${C.gray}Launched ${OS.getApp(name).name}${C.reset}\n`); return 0; }
        ctx.err(`rsh: ${name}: command not found\n`);
        return 127;
      } catch (e) { ctx.err(`${name}: ${e.message}\n`); return 1; }
    }

    async execFile(p, ctx) {
      const e = VFS.ext(p);
      if (e === 'log') return this.runScript(p, ctx.args);
      if (e === 'esl') { ESL.run(p); ctx.out(`${C.gray}Started ${VFS.basename(p)}${C.reset}\n`); return 0; }
      if (e === 'hsl') { HSL.open(p); return 0; }
      ctx.err(`rsh: ${p}: cannot execute (not a .log/.esl/.hsl file)\n`); return 126;
    }

    /** Run a .log batch script line by line. */
    async runScript(path, args = []) {
      const text = VFS.read(path);
      const saved = {}; ['0', '1', '2', '3', '4', '5', '#', '@'].forEach(k => saved[k] = this.env[k]);
      this.env['0'] = path; args.forEach((a, i) => this.env[String(i + 1)] = a); this.env['#'] = String(args.length); this.env['@'] = args.join(' ');
      const lines = text.replace(/\r/g, '').replace(/\\\n/g, ' ').split('\n');
      let code = 0;
      OS.log(`batch: running ${path}`);
      for (let n = 0; n < lines.length; n++) {
        if (this.aborted) { this.write(`${C.yellow}^C batch aborted${C.reset}\n`); break; }
        const l = lines[n].trim();
        if (!l || l.startsWith('#') || l.startsWith('::') || /^rem\s/i.test(l)) continue;
        if (/^@?echo\s+off$/i.test(l)) continue;
        if (l === 'exit' || l.startsWith('exit ')) { code = +(l.split(/\s+/)[1] || 0); break; }
        code = await this.run(l);
      }
      Object.assign(this.env, saved);
      return code;
    }

    complete(line) {
      const parts = line.split(/\s+/); const word = parts[parts.length - 1];
      if (parts.length === 1) {
        const names = [...Object.keys(CMDS), ...Object.keys(this.aliases), ...OS.listApps().map(a => a.id)].filter(n => n.startsWith(word));
        return { word, options: [...new Set(names)].sort() };
      }
      const full = word.includes('/') ? word.slice(0, word.lastIndexOf('/') + 1) : '';
      const dir = this.resolve(full || '.'); const pre = word.slice(full.length);
      let names = []; try { names = VFS.list(dir).filter(n => n.startsWith(pre) && (pre.startsWith('.') || !n.startsWith('.'))).map(n => full + n + (VFS.isDir(VFS.join(dir, n)) ? '/' : '')); } catch {}
      return { word, options: names };
    }
  }

  // ------------------------------------------------------------ commands
  const fmtMode = (st) => (st.type === 'dir' ? 'd' : '-') + (st.mode || 'rw-r--r--');
  const colorName = (p, n) => { if (VFS.isDir(p)) return C.blue + C.bold + n + C.reset; const e = VFS.ext(n); return e === 'esl' ? C.green + C.bold + n + C.reset : e === 'log' ? C.yellow + n + C.reset : e === 'hsl' ? C.cyan + n + C.reset : n; };
  const lines = s => s.replace(/\n$/, '').split('\n');
  const needArg = (ctx, n = 1, usage = '') => { if (ctx.args.length < n) throw new Error('missing operand' + (usage ? '\nusage: ' + usage : '')); };

  const CMDS = {
    help: { help: 'List commands', fn: ctx => {
      const groups = {
        'Files': 'ls cd pwd cat less head tail touch mkdir rmdir rm cp mv find tree stat du df chmod ln file',
        'Text': 'echo printf grep sort uniq wc rev tr cut sed nl base64 seq',
        'System': 'ps top kill free uname uptime whoami hostname date cal env export unset alias unalias history which type clear sleep reboot shutdown lock theme wallpaper notify neofetch',
        'Network': 'wifi ping ifconfig curl nslookup',
        'RocketOS': 'open edit run source apps install uninstall store esl hsl ai calc games test true false exit',
        'Fun': 'cowsay fortune matrix banner lolcat yes',
      };
      ctx.out(`${C.orange}${C.bold}rsh — RocketOS shell${C.reset}  (type ${C.cyan}man <cmd>${C.reset} for details)\n\n`);
      for (const [g, cmds] of Object.entries(groups)) ctx.out(`${C.bold}${g}:${C.reset} ${cmds}\n`);
      ctx.out(`\n${C.gray}Operators: | > >> < ; && ||   Loops: for x in a b; do echo $x; done   if test -f f; then …; else …; fi${C.reset}\n`);
      ctx.out(`${C.gray}Batch: put commands in a .log file and run it with ./file.log or run file.log${C.reset}\n`);
    } },
    man: { help: 'Show manual for a command', fn: ctx => { needArg(ctx); const c = CMDS[ctx.args[0]]; if (!c) throw new Error(`No manual entry for ${ctx.args[0]}`); ctx.out(`${C.bold}${ctx.args[0].toUpperCase()}${C.reset}\n  ${c.help}\n${c.usage ? '\n  usage: ' + c.usage + '\n' : ''}`); } },
    ls: { help: 'List directory contents', usage: 'ls [-l] [-a] [path…]', fn: ctx => {
      const { f, rest } = flags(ctx.args); const paths = rest.length ? rest : ['.'];
      for (const a of paths) {
        const p = ctx.sh.resolve(a);
        if (!VFS.exists(p)) { ctx.err(`ls: ${a}: No such file or directory\n`); continue; }
        if (!VFS.isDir(p) && !f.l) { ctx.out(colorName(p, a) + '\n'); continue; }
        if (paths.length > 1 && VFS.isDir(p)) ctx.out(`${a}:\n`);
        const names = VFS.isDir(p) ? VFS.list(p).filter(n => f.a || !n.startsWith('.')) : [VFS.basename(p)];
        const base = VFS.isDir(p) ? p : VFS.dirname(p);
        if (f.l) { ctx.out(`total ${names.length}\n`); names.forEach(n => { const fp = VFS.join(base, n), st = VFS.stat(fp); ctx.out(`${fmtMode(st)} ${OS.settings.username.padEnd(6)} ${String(st.size).padStart(7)} ${new Date(st.mtime).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })} ${colorName(fp, n)}\n`); }); }
        else ctx.out(names.map(n => colorName(VFS.join(base, n), n)).join('  ') + (names.length ? '\n' : ''));
      }
    } },
    cd: { help: 'Change directory', fn: ctx => { const p = ctx.sh.resolve(ctx.args[0] || '~'); if (ctx.args[0] === '-') { const o = ctx.sh.env.OLDPWD || ctx.sh.cwd; ctx.sh.env.OLDPWD = ctx.sh.cwd; ctx.sh.cwd = o; return; } if (!VFS.isDir(p)) throw new Error(`${ctx.args[0]}: No such directory`); ctx.sh.env.OLDPWD = ctx.sh.cwd; ctx.sh.cwd = p; ctx.sh.env.PWD = p; } },
    pwd: { help: 'Print working directory', fn: ctx => ctx.out(ctx.sh.cwd + '\n') },
    cat: { help: 'Print files', usage: 'cat [-n] file…', fn: ctx => { const { f, rest } = flags(ctx.args); if (!rest.length) return ctx.out(ctx.stdin); let n = 1; rest.forEach(a => { const t = VFS.read(ctx.sh.resolve(a)); ctx.out(f.n ? lines(t).map(l => String(n++).padStart(5) + '  ' + l).join('\n') + '\n' : t + (t.endsWith('\n') || !t ? '' : '\n')); }); } },
    less: { help: 'View a file (alias of cat)', fn: ctx => CMDS.cat.fn(ctx) },
    head: { help: 'First lines', usage: 'head [-n N] [file]', fn: ctx => { const { f, rest } = flags(ctx.args, ['n']); const t = rest[0] ? VFS.read(ctx.sh.resolve(rest[0])) : ctx.stdin; ctx.out(lines(t).slice(0, +(f.n || 10)).join('\n') + '\n'); } },
    tail: { help: 'Last lines', usage: 'tail [-n N] [file]', fn: ctx => { const { f, rest } = flags(ctx.args, ['n']); const t = rest[0] ? VFS.read(ctx.sh.resolve(rest[0])) : ctx.stdin; ctx.out(lines(t).slice(-(+(f.n || 10))).join('\n') + '\n'); } },
    touch: { help: 'Create empty file / update time', fn: ctx => { needArg(ctx); ctx.args.forEach(a => { const p = ctx.sh.resolve(a); if (VFS.exists(p)) VFS.getNode(p).mtime = Date.now(), VFS.save(); else VFS.write(p, ''); }); } },
    mkdir: { help: 'Make directories', usage: 'mkdir [-p] dir…', fn: ctx => { const { f, rest } = flags(ctx.args); needArg({ args: rest }); rest.forEach(a => { const p = ctx.sh.resolve(a); if (VFS.exists(p) && !f.p) throw new Error(`${a}: File exists`); VFS.mkdir(p, !!f.p || true); }); } },
    rmdir: { help: 'Remove empty directory', fn: ctx => { needArg(ctx); ctx.args.forEach(a => VFS.rm(ctx.sh.resolve(a), false)); } },
    rm: { help: 'Remove files', usage: 'rm [-r] [-f] path…', fn: ctx => { const { f, rest } = flags(ctx.args); needArg({ args: rest }); rest.forEach(a => { const p = ctx.sh.resolve(a); if (!VFS.exists(p)) { if (!f.f) throw new Error(`${a}: No such file or directory`); return; } if (VFS.isDir(p) && !f.r && !f.R) throw new Error(`${a}: is a directory (use -r)`); if (['/', '/home', '/apps', '/bin', '/etc'].includes(p)) throw new Error(`refusing to remove system path ${p}`); VFS.rm(p, true); }); } },
    cp: { help: 'Copy', usage: 'cp src… dest', fn: ctx => { const { rest } = flags(ctx.args); needArg({ args: rest }, 2, 'cp src dest'); const dst = ctx.sh.resolve(rest.pop()); rest.forEach(a => VFS.cp(ctx.sh.resolve(a), dst)); } },
    mv: { help: 'Move / rename', usage: 'mv src… dest', fn: ctx => { needArg(ctx, 2, 'mv src dest'); const a = ctx.args.slice(); const dst = ctx.sh.resolve(a.pop()); a.forEach(s => VFS.mv(ctx.sh.resolve(s), dst)); } },
    find: { help: 'Find files', usage: 'find [path] [-name pattern] [-type f|d]', fn: ctx => {
      let base = '.', name = null, type = null; const a = ctx.args;
      for (let i = 0; i < a.length; i++) { if (a[i] === '-name') name = a[++i]; else if (a[i] === '-type') type = a[++i]; else base = a[i]; }
      const re = name ? new RegExp('^' + name.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i') : null;
      VFS.walk(ctx.sh.resolve(base), (p, n) => { if (re && !re.test(VFS.basename(p))) return; if (type === 'f' && n.type !== 'file') return; if (type === 'd' && n.type !== 'dir') return; ctx.out(p + '\n'); });
    } },
    tree: { help: 'Directory tree', fn: ctx => { const root = ctx.sh.resolve(ctx.args[0] || '.'); let d = 0, f = 0; ctx.out(C.blue + root + C.reset + '\n');
      const rec = (p, pre) => { const ns = VFS.list(p).filter(n => !n.startsWith('.')); ns.forEach((n, i) => { const fp = VFS.join(p, n), lastOne = i === ns.length - 1; ctx.out(pre + (lastOne ? '└── ' : '├── ') + colorName(fp, n) + '\n'); if (VFS.isDir(fp)) { d++; rec(fp, pre + (lastOne ? '    ' : '│   ')); } else f++; }); };
      rec(root, ''); ctx.out(`\n${d} directories, ${f} files\n`); } },
    stat: { help: 'File status', fn: ctx => { needArg(ctx); const p = ctx.sh.resolve(ctx.args[0]); const s = VFS.stat(p); if (!s) throw new Error('No such file'); ctx.out(`  File: ${p}\n  Type: ${s.type}\n  Size: ${s.size}\n  Mode: ${fmtMode(s)}\nModify: ${new Date(s.mtime).toString()}\n`); } },
    file: { help: 'Detect file type', fn: ctx => { needArg(ctx); ctx.args.forEach(a => { const p = ctx.sh.resolve(a), e = VFS.ext(p); const t = VFS.isDir(p) ? 'directory' : { esl: 'RocketOS ESL application package', log: 'RocketOS batch script', hsl: 'RocketOS HSL shortcut link', txt: 'ASCII text', md: 'Markdown text', png: 'PNG image (data URL)', json: 'JSON data' }[e] || 'data'; ctx.out(`${a}: ${t}\n`); }); } },
    du: { help: 'Disk usage', fn: ctx => { let total = 0; VFS.walk(ctx.sh.resolve(ctx.args[0] || '.'), (p, n) => { if (n.type === 'file') total += n.content.length; }); ctx.out(`${OS.fmtSize(total)}\t${ctx.args[0] || '.'}\n`); } },
    df: { help: 'Disk free', fn: ctx => { const used = VFS.usage(), tot = 5 * 1048576; ctx.out(`Filesystem      Size   Used  Avail Use% Mounted on\nrocketfs        5.0M ${OS.fmtSize(used).padStart(6)} ${OS.fmtSize(tot - used).padStart(6)} ${String(Math.round(used / tot * 100)).padStart(3)}% /\n`); } },
    chmod: { help: 'Change mode (cosmetic)', usage: 'chmod +x file', fn: ctx => { needArg(ctx, 2); const n = VFS.getNode(ctx.sh.resolve(ctx.args[1])); if (!n) throw new Error('No such file'); const m = n.mode.split(''); if (ctx.args[0].includes('+x')) { m[2] = 'x'; m[5] = 'x'; m[8] = 'x'; } if (ctx.args[0].includes('-x')) { m[2] = '-'; m[5] = '-'; m[8] = '-'; } if (/^\d{3}$/.test(ctx.args[0])) { const r = d => (d & 4 ? 'r' : '-') + (d & 2 ? 'w' : '-') + (d & 1 ? 'x' : '-'); n.mode = ctx.args[0].split('').map(Number).map(r).join(''); } else n.mode = m.join(''); VFS.save(); } },
    ln: { help: 'Create a .hsl shortcut link', usage: 'ln -s target linkname', fn: ctx => { const { rest } = flags(ctx.args); needArg({ args: rest }, 2, 'ln -s target name'); const target = OS.getApp(rest[0]) ? 'app:' + rest[0] : ctx.sh.resolve(rest[0]); const dst = ctx.sh.resolve(rest[1].endsWith('.hsl') ? rest[1] : rest[1] + '.hsl'); VFS.write(dst, HSL.serialize({ name: VFS.basename(dst).replace(/\.hsl$/, ''), target })); ctx.out(`${dst} -> ${target}\n`); } },

    echo: { help: 'Print text', usage: 'echo [-n] [-e] text', fn: ctx => { const a = ctx.args.slice(), f = {}; while (/^-[ne]+$/.test(a[0] || '')) [...a.shift().slice(1)].forEach(c => f[c] = true); let s = a.join(' '); if (f.e) s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\e/g, '\x1b'); ctx.out(s + (f.n ? '' : '\n')); } },
    printf: { help: 'Formatted print', fn: ctx => { let i = 1; const s = (ctx.args[0] || '').replace(/%[sd]/g, () => ctx.args[i++] ?? '').replace(/\\n/g, '\n').replace(/\\t/g, '\t'); ctx.out(s); } },
    grep: { help: 'Search text', usage: 'grep [-i] [-v] [-n] [-c] pattern [file…]', fn: ctx => {
      const { f, rest } = flags(ctx.args); needArg({ args: rest }); const pat = rest.shift();
      let re; try { re = new RegExp(pat, f.i ? 'i' : ''); } catch { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), f.i ? 'i' : ''); }
      const srcs = rest.length ? rest.map(a => [a, VFS.read(ctx.sh.resolve(a))]) : [['', ctx.stdin]];
      let count = 0;
      srcs.forEach(([name, t]) => lines(t).forEach((l, i) => { if (re.test(l) !== !!f.v) { count++; if (!f.c) ctx.out((srcs.length > 1 ? C.magenta + name + C.reset + ':' : '') + (f.n ? C.green + (i + 1) + C.reset + ':' : '') + (f.v ? l : l.replace(new RegExp(re.source, 'g' + (f.i ? 'i' : '')), m => C.red + C.bold + m + C.reset)) + '\n'); } }));
      if (f.c) ctx.out(count + '\n');
      return count ? 0 : 1;
    } },
    sort: { help: 'Sort lines', usage: 'sort [-r] [-n] [-u]', fn: ctx => { const { f, rest } = flags(ctx.args); const t = rest[0] ? VFS.read(ctx.sh.resolve(rest[0])) : ctx.stdin; let l = lines(t); l.sort(f.n ? (a, b) => parseFloat(a) - parseFloat(b) : (a, b) => a.localeCompare(b)); if (f.r) l.reverse(); if (f.u) l = [...new Set(l)]; ctx.out(l.join('\n') + '\n'); } },
    uniq: { help: 'Remove adjacent duplicates', usage: 'uniq [-c] [file]', fn: ctx => { const { f, rest } = flags(ctx.args); const out = []; lines(rest[0] ? VFS.read(ctx.sh.resolve(rest[0])) : ctx.stdin).forEach(l => { const last = out[out.length - 1]; if (last && last.l === l) last.c++; else out.push({ l, c: 1 }); }); ctx.out(out.map(o => (f.c ? String(o.c).padStart(4) + ' ' : '') + o.l).join('\n') + '\n'); } },
    wc: { help: 'Count lines/words/chars', usage: 'wc [-l|-w|-c] [file]', fn: ctx => { const { f, rest } = flags(ctx.args); const t = rest[0] ? VFS.read(ctx.sh.resolve(rest[0])) : ctx.stdin; const L = t ? t.split('\n').length - (t.endsWith('\n') ? 1 : 0) : 0, W = t.split(/\s+/).filter(Boolean).length, Ch = t.length; if (f.l) return ctx.out(L + '\n'); if (f.w) return ctx.out(W + '\n'); if (f.c) return ctx.out(Ch + '\n'); ctx.out(`${String(L).padStart(7)}${String(W).padStart(8)}${String(Ch).padStart(8)} ${rest[0] || ''}\n`); } },
    rev: { help: 'Reverse lines', fn: ctx => ctx.out(lines(ctx.args.length ? ctx.args.join(' ') : ctx.stdin).map(l => [...l].reverse().join('')).join('\n') + '\n') },
    tr: { help: 'Translate characters', usage: 'tr a-z A-Z', fn: ctx => { needArg(ctx, 2); const exp = s => s.replace(/(\w)-(\w)/g, (_, a, b) => { let r = ''; for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) r += String.fromCharCode(c); return r; }); const A = exp(ctx.args[0]), B = exp(ctx.args[1]); ctx.out([...ctx.stdin].map(c => { const i = A.indexOf(c); return i < 0 ? c : B[Math.min(i, B.length - 1)]; }).join('')); } },
    cut: { help: 'Cut fields', usage: 'cut -d, -f2', fn: ctx => { const { f, rest } = flags(ctx.args, ['d', 'f']); const d = f.d || '\t'; const fields = String(f.f || '1').split(',').map(Number); ctx.out(lines(rest[0] ? VFS.read(ctx.sh.resolve(rest[0])) : ctx.stdin).map(l => fields.map(i => l.split(d)[i - 1] ?? '').join(d)).join('\n') + '\n'); } },
    sed: { help: 'Stream edit (s/a/b/g only)', usage: "sed 's/old/new/g' [file]", fn: ctx => { needArg(ctx); const m = ctx.args[0].match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/); if (!m) throw new Error('only s/pattern/replacement/flags is supported'); const t = ctx.args[1] ? VFS.read(ctx.sh.resolve(ctx.args[1])) : ctx.stdin; ctx.out(t.replace(new RegExp(m[2], m[4]), m[3])); } },
    nl: { help: 'Number lines', fn: ctx => { const t = ctx.args[0] ? VFS.read(ctx.sh.resolve(ctx.args[0])) : ctx.stdin; ctx.out(lines(t).map((l, i) => String(i + 1).padStart(6) + '\t' + l).join('\n') + '\n'); } },
    base64: { help: 'Base64 encode/decode', usage: 'base64 [-d] [text]', fn: ctx => { const { f, rest } = flags(ctx.args); const t = rest.length ? rest.join(' ') : ctx.stdin; ctx.out((f.d ? decodeURIComponent(escape(atob(t.trim()))) : btoa(unescape(encodeURIComponent(t)))) + '\n'); } },
    seq: { help: 'Number sequence', usage: 'seq [start] end', fn: ctx => { needArg(ctx); const [a, b] = ctx.args.length > 1 ? [+ctx.args[0], +ctx.args[1]] : [1, +ctx.args[0]]; const out = []; for (let i = a; i <= b && out.length < 10000; i++) out.push(i); ctx.out(out.join('\n') + '\n'); } },

    ps: { help: 'Process list', fn: ctx => { ctx.out(`${C.bold}  PID  CPU%  MEM(MB)  TIME     COMMAND${C.reset}\n    1   0.1      2.0  ${fmtUp(OS.bootTime)}  init\n   42   0.3      6.4  ${fmtUp(OS.bootTime)}  rocket-wm\n`); OS.procs.forEach(p => ctx.out(`${String(p.pid).padStart(5)} ${(Math.random() * 3).toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(8)}  ${fmtUp(p.start)}  ${p.name}\n`)); } },
    top: { help: 'Live process monitor (Ctrl+C to quit)', fn: async ctx => { const term = ctx.sh.io; if (!term.clear) return CMDS.ps.fn(ctx);
      while (!ctx.sh.aborted) { term.clear(); const m = SysStats.mem(); ctx.out(`${C.bold}top - ${new Date().toLocaleTimeString()} up ${fmtUp(OS.bootTime)}, ${OS.procs.length + 2} tasks${C.reset}\n%Cpu: ${SysStats.cpu().toFixed(1)}   Mem: ${m.used}/${m.total} MB\n\n`); await CMDS.ps.fn(ctx); ctx.out(`\n${C.gray}Press Ctrl+C to exit${C.reset}\n`); await sleep(1000); } } },
    kill: { help: 'Kill a process by PID', usage: 'kill PID', fn: ctx => { needArg(ctx); ctx.args.forEach(p => { if (!OS.killProc(p.replace(/^-9$/, ''))) { if (p !== '-9') ctx.err(`kill: (${p}) - No such process\n`); } else ctx.out(`Killed ${p}\n`); }); } },
    free: { help: 'Memory usage', fn: ctx => { const m = SysStats.mem(); ctx.out(`              total        used        free\nMem:   ${String(m.total).padStart(12)}${String(m.used).padStart(12)}${String(m.total - m.used).padStart(12)}\n`); } },
    uname: { help: 'System info', usage: 'uname [-a]', fn: ctx => ctx.out(flags(ctx.args).f.a ? `RocketOS ${OS.settings.hostname} ${OS.version} rocket-kernel-1.0 #1 SMP ${navigator.platform || 'web'} rsh\n` : 'RocketOS\n') },
    uptime: { help: 'Time since boot', fn: ctx => ctx.out(`up ${fmtUp(OS.bootTime)}, 1 user, load average: ${(SysStats.cpu() / 100).toFixed(2)}\n`) },
    whoami: { help: 'Current user', fn: ctx => ctx.out(OS.settings.username + '\n') },
    hostname: { help: 'Host name', fn: ctx => { if (ctx.args[0]) { OS.set('hostname', ctx.args[0]); ctx.sh.env.HOSTNAME = ctx.args[0]; } ctx.out(OS.settings.hostname + '\n'); } },
    date: { help: 'Date and time', fn: ctx => ctx.out(new Date().toString() + '\n') },
    cal: { help: 'Calendar', fn: ctx => { const d = new Date(), y = d.getFullYear(), m = d.getMonth(); const title = d.toLocaleDateString([], { month: 'long', year: 'numeric' }); let s = title.padStart(10 + title.length / 2) + '\nSu Mo Tu We Th Fr Sa\n'; const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(); s += '   '.repeat(first); for (let i = 1; i <= days; i++) { const t = String(i).padStart(2); s += (i === d.getDate() ? C.orange + C.bold + t + C.reset : t) + ((first + i) % 7 === 0 ? '\n' : ' '); } ctx.out(s + '\n'); } },
    env: { help: 'Environment variables', fn: ctx => Object.entries(ctx.sh.env).filter(([k]) => !/^[\d?#@]$/.test(k)).forEach(([k, v]) => ctx.out(`${k}=${v}\n`)) },
    export: { help: 'Set variable', usage: 'export NAME=value', fn: ctx => ctx.args.forEach(a => { const i = a.indexOf('='); if (i > 0) ctx.sh.env[a.slice(0, i)] = a.slice(i + 1); }) },
    unset: { help: 'Unset variable', fn: ctx => ctx.args.forEach(a => delete ctx.sh.env[a]) },
    alias: { help: 'Define alias', usage: "alias name='command'", fn: ctx => { if (!ctx.args.length) return Object.entries(ctx.sh.aliases).forEach(([k, v]) => ctx.out(`alias ${k}='${v}'\n`)); const a = ctx.args.join(' '); const i = a.indexOf('='); if (i < 0) return ctx.out(`alias ${a}='${ctx.sh.aliases[a] || ''}'\n`); ctx.sh.aliases[a.slice(0, i)] = a.slice(i + 1); localStorage.setItem('rocketos.aliases', JSON.stringify(ctx.sh.aliases)); } },
    unalias: { help: 'Remove alias', fn: ctx => { ctx.args.forEach(a => delete ctx.sh.aliases[a]); localStorage.setItem('rocketos.aliases', JSON.stringify(ctx.sh.aliases)); } },
    history: { help: 'Command history', usage: 'history [-c]', fn: ctx => { if (flags(ctx.args).f.c) { ctx.sh.history.length = 0; localStorage.removeItem('rocketos.history'); return; } ctx.sh.history.slice(-50).forEach((l, i, a) => ctx.out(`${String(ctx.sh.history.length - a.length + i + 1).padStart(5)}  ${l}\n`)); } },
    which: { help: 'Locate a command', fn: ctx => { needArg(ctx); ctx.args.forEach(a => ctx.out((CMDS[a] ? `/bin/${a}` : ctx.sh.aliases[a] ? `${a}: aliased to ${ctx.sh.aliases[a]}` : OS.getApp(a) ? `/apps/${a} (app)` : `${a} not found`) + '\n')); } },
    type: { help: 'Describe a command', fn: ctx => CMDS.which.fn(ctx) },
    clear: { help: 'Clear screen', fn: ctx => { ctx.sh.io.clear && ctx.sh.io.clear(); } },
    sleep: { help: 'Wait N seconds', fn: async ctx => { const end = Date.now() + parseFloat(ctx.args[0] || 1) * 1000; while (Date.now() < end && !ctx.sh.aborted) await sleep(Math.min(100, end - Date.now())); } },
    read: { help: 'Read input into a variable', usage: 'read [-p prompt] VAR', fn: async ctx => { const { f, rest } = flags(ctx.args, ['p']); if (!ctx.sh.io.readLine) throw new Error('no terminal attached'); const v = await ctx.sh.io.readLine(f.p || ''); ctx.sh.env[rest[0] || 'REPLY'] = v ?? ''; } },
    test: { help: 'Evaluate condition', usage: 'test -f file | -d dir | -e path | a = b | a != b | n -gt m', fn: ctx => {
      const a = ctx.args.filter(x => x !== ']'); const p = x => ctx.sh.resolve(x);
      if (a[0] === '!') return CMDS.test.fn({ ...ctx, args: a.slice(1) }) === 0 ? 1 : 0;
      if (a.length === 2) { const [o, v] = a; const r = { '-f': () => VFS.isFile(p(v)), '-d': () => VFS.isDir(p(v)), '-e': () => VFS.exists(p(v)), '-z': () => !v, '-n': () => !!v }[o]; return r && r() ? 0 : 1; }
      if (a.length === 3) { const [x, o, y] = a; const r = { '=': x === y, '==': x === y, '!=': x !== y, '-eq': +x === +y, '-ne': +x !== +y, '-gt': +x > +y, '-lt': +x < +y, '-ge': +x >= +y, '-le': +x <= +y }[o]; return r ? 0 : 1; }
      return a.length === 1 && a[0] ? 0 : 1;
    } },
    '[': { help: 'Alias of test', fn: ctx => CMDS.test.fn(ctx) },
    true: { help: 'Exit 0', fn: () => 0 }, false: { help: 'Exit 1', fn: () => 1 },
    exit: { help: 'Close the terminal tab', fn: ctx => { ctx.sh.io.exit && ctx.sh.io.exit(); } },
    reboot: { help: 'Restart RocketOS', fn: () => Boot.power('restart', true) },
    shutdown: { help: 'Shut down RocketOS', fn: () => Boot.power('shutdown', true) },
    lock: { help: 'Lock the screen', fn: () => Boot.lock() },
    theme: { help: 'Switch theme', usage: 'theme dark|light', fn: ctx => { const t = ctx.args[0] || (OS.settings.theme === 'dark' ? 'light' : 'dark'); OS.set('theme', t); ctx.out(`Theme: ${t}\n`); } },
    wallpaper: { help: 'Set wallpaper', usage: 'wallpaper [name|#color|url]', fn: ctx => { if (!ctx.args[0]) return ctx.out(Object.entries(Desktop.wallpapers).map(([k, v]) => `${k.padEnd(10)} ${v.name}`).join('\n') + '\n'); const w = ctx.args.join(' '); if (Desktop.wallpapers[w]) OS.set('wallpaper', w); else { OS.settings.wallpaperCustom = w; OS.set('wallpaper', 'custom'); } ctx.out('Wallpaper updated.\n'); } },
    notify: { help: 'Show a notification', usage: 'notify title [message]', fn: ctx => { OS.notify(ctx.args[0] || 'Terminal', ctx.args.slice(1).join(' '), '💻'); } },
    neofetch: { help: 'System summary', fn: ctx => {
      const m = SysStats.mem(), o = C.orange + C.bold, r = C.reset;
      const art = ['        /\\        ', '       /  \\       ', '      | () |      ', '      |    |      ', '     /| RO |\\     ', '    / |    | \\    ', '   /__|____|__\\   ', '      /_||_\\      ', '      ( ** )      ', '       \\  /       '];
      const info = [`${o}${OS.settings.username}@${OS.settings.hostname}${r}`, '─'.repeat(18), `${o}OS:${r} RocketOS ${OS.version}`, `${o}Kernel:${r} rocket-kernel 1.0 (unix-like)`, `${o}Uptime:${r} ${fmtUp(OS.bootTime)}`, `${o}Shell:${r} rsh 2.0`, `${o}WM:${r} RocketWM`, `${o}Terminal:${r} Rocket Terminal`, `${o}Memory:${r} ${m.used}MiB / ${m.total}MiB`, `${o}Wi-Fi:${r} ${NET.status().text}`];
      art.forEach((a, i) => ctx.out(`${o}${a}${r}  ${info[i] || ''}\n`));
      ctx.out('\n' + [41, 42, 43, 44, 45, 46, 47].map(c => `\x1b[${c}m   `).join('') + C.reset + '\n');
    } },

    wifi: { help: 'Wi-Fi manager', usage: 'wifi [status|list|connect SSID [password]|disconnect|on|off|forget SSID]', fn: async ctx => {
      const [sub, ...rest] = ctx.args;
      if (!sub || sub === 'status') { const s = NET.status(), i = NET.info(); ctx.out(`Wi-Fi: ${OS.settings.wifi.enabled ? C.green + 'on' : C.red + 'off'}${C.reset}\nStatus: ${s.text}${s.signal ? ` (${s.signal}%)` : ''}\nInternet: ${NET.online() ? C.green + 'reachable' : C.red + 'unreachable'}${C.reset}\n${i.ip ? `IP: ${i.ip}\n` : ''}`); return; }
      if (sub === 'list' || sub === 'scan') { ctx.out(C.gray + 'Scanning…' + C.reset + '\n'); await sleep(500); ctx.out(`${C.bold}  SSID              SIGNAL  SECURITY  BAND${C.reset}\n`); NET.scan().forEach(n => ctx.out(`${n.connected ? C.green + '* ' : '  '}${n.ssid.padEnd(18)}${(n.signal + '%').padStart(6)}  ${n.security.padEnd(9)} ${n.band}${C.reset}\n`)); return; }
      if (sub === 'connect') { if (!rest[0]) throw new Error('usage: wifi connect SSID [password]'); ctx.out(`Connecting to ${rest[0]}…\n`); await NET.connect(rest[0], rest[1]); ctx.out(`${C.green}✓ Connected to ${rest[0]}${C.reset}\n`); return; }
      if (sub === 'disconnect') { NET.disconnect(); ctx.out('Disconnected.\n'); return; }
      if (sub === 'on' || sub === 'off') { NET.setEnabled(sub === 'on'); ctx.out(`Wi-Fi ${sub}\n`); return; }
      if (sub === 'forget') { NET.forget(rest[0]); ctx.out(`Forgot ${rest[0]}\n`); return; }
      throw new Error('unknown subcommand ' + sub);
    } },
    ifconfig: { help: 'Network interfaces', fn: ctx => { const i = NET.info(); ctx.out(`lo0: inet 127.0.0.1 netmask 255.0.0.0\nwlan0: ${i.ip ? `inet ${i.ip} netmask 255.255.255.0 gateway ${i.gateway}` : 'not connected'}\n       ether ${i.mac}${i.ssid ? `  ssid "${i.ssid}" ${i.band} ${i.security}` : ''}\n`); } },
    nslookup: { help: 'DNS lookup (simulated)', fn: ctx => { needArg(ctx); if (!NET.online()) throw new Error('no network'); const h = [...ctx.args[0]].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); ctx.out(`Server: ${NET.info().dns}\nName: ${ctx.args[0]}\nAddress: ${h % 223 + 1}.${(h >> 8) % 256}.${(h >> 16) % 256}.${(h >> 24) % 254 + 1}\n`); } },
    ping: { help: 'Ping a host', usage: 'ping [-c N] host', fn: async ctx => {
      const { f, rest } = flags(ctx.args, ['c']); needArg({ args: rest }); const host = rest[0], n = +(f.c || 4);
      if (!NET.current()) throw new Error('Network is unreachable (Wi-Fi not connected)');
      if (!navigator.onLine) throw new Error(`cannot resolve ${host}: no internet`);
      ctx.out(`PING ${host}: 56 data bytes\n`); const times = [];
      for (let i = 0; i < n && !ctx.sh.aborted; i++) {
        const t0 = performance.now(); let real = true;
        try { await Promise.race([fetch(`https://${host.replace(/^https?:\/\//, '')}/favicon.ico?${Date.now()}`, { mode: 'no-cors', cache: 'no-store' }), sleep(3000).then(() => { throw new Error('timeout'); })]); } catch { real = false; }
        let t = performance.now() - t0; if (!real) t = 15 + (100 - NET.signal(NET.current())) * 0.8 + Math.random() * 10;
        times.push(t); ctx.out(`64 bytes from ${host}: icmp_seq=${i} ttl=57 time=${t.toFixed(1)} ms\n`); await sleep(700);
      }
      if (times.length) ctx.out(`--- ${host} ping statistics ---\n${times.length} packets transmitted, ${times.length} received, 0% packet loss\nrtt min/avg/max = ${Math.min(...times).toFixed(1)}/${(times.reduce((a, b) => a + b) / times.length).toFixed(1)}/${Math.max(...times).toFixed(1)} ms\n`);
    } },
    curl: { help: 'Fetch a URL', usage: 'curl [-o file] url', fn: async ctx => {
      const { f, rest } = flags(ctx.args, ['o']); needArg({ args: rest }); let url = rest[0]; if (!/^https?:/.test(url)) url = 'https://' + url;
      if (!NET.online()) throw new Error('Could not resolve host: no internet connection (check Wi-Fi)');
      let r; try { r = await fetch(url); } catch { throw new Error('request blocked (the site may not allow cross-origin access)'); }
      const t = await r.text();
      if (f.o) { VFS.write(ctx.sh.resolve(f.o), t); ctx.out(`Saved ${t.length} bytes to ${f.o}\n`); } else ctx.out(t.slice(0, 20000) + (t.length > 20000 ? `\n${C.gray}… (${t.length} bytes, truncated)${C.reset}` : '') + '\n');
    } },

    open: { help: 'Open file, folder, app or URL', usage: 'open <path|app|url>', fn: ctx => { needArg(ctx); const a = ctx.args[0]; if (/^https?:/.test(a)) return OS.launch('browser', { url: a }); if (OS.getApp(a)) return OS.launch(a); OS.openFile(ctx.sh.resolve(a)); } },
    'xdg-open': { help: 'Alias of open', fn: ctx => CMDS.open.fn(ctx) },
    edit: { help: 'Open file in Text Editor', usage: 'edit file', fn: ctx => { needArg(ctx); const p = ctx.sh.resolve(ctx.args[0]); if (!VFS.exists(p)) VFS.write(p, ''); OS.launch('editor', { path: p }); } },
    nano: { help: 'Alias of edit', fn: ctx => CMDS.edit.fn(ctx) }, vim: { help: 'Alias of edit', fn: ctx => CMDS.edit.fn(ctx) },
    run: { help: 'Run a .log batch script', usage: 'run script.log [args]', fn: ctx => { needArg(ctx); return ctx.sh.execFile(ctx.sh.resolve(ctx.args[0]), { ...ctx, args: ctx.args.slice(1) }); } },
    source: { help: 'Run script in current shell', fn: ctx => { needArg(ctx); return ctx.sh.runScript(ctx.sh.resolve(ctx.args[0]), ctx.args.slice(1)); } },
    sh: { help: 'Run a script', fn: ctx => CMDS.source.fn(ctx) },
    apps: { help: 'List installed apps', fn: ctx => { const cats = {}; OS.listApps().forEach(a => (cats[a.category] = cats[a.category] || []).push(a)); for (const [c, as] of Object.entries(cats)) { ctx.out(`${C.bold}${c}${C.reset}\n`); as.forEach(a => ctx.out(`  ${a.icon} ${a.id.padEnd(12)} ${a.name}\n`)); } } },
    games: { help: 'List games', fn: ctx => OS.listApps().filter(a => a.category === 'Games').forEach(a => ctx.out(`${a.icon} ${a.id.padEnd(12)} ${a.name}\n`)) },
    store: { help: 'Search the App Store', usage: 'store [search term]', fn: ctx => { const q = ctx.args.join(' ').toLowerCase(); Store.catalog().filter(a => !q || (a.name + a.desc).toLowerCase().includes(q)).forEach(a => ctx.out(`${a.icon} ${C.bold}${a.id.padEnd(16)}${C.reset} ${a.name} ${C.gray}— ${a.desc}${C.reset} ${Store.isInstalled(a.id) ? C.green + '[installed]' + C.reset : ''}\n`)); } },
    install: { help: 'Install an app from the store', usage: 'install <id>', fn: async ctx => { needArg(ctx); for (const id of ctx.args) { ctx.out(`Downloading ${id}…\n`); await Store.install(id); ctx.out(`${C.green}✓ ${id} installed${C.reset}\n`); } } },
    uninstall: { help: 'Remove a store app', fn: ctx => { needArg(ctx); ctx.args.forEach(id => { Store.uninstall(id); ctx.out(`Removed ${id}\n`); }); } },
    esl: { help: 'ESL app tool', usage: 'esl new <name> | esl info <file> | esl run <file>', fn: ctx => {
      const [sub, arg] = ctx.args;
      if (sub === 'new') { if (!arg) throw new Error('usage: esl new <name>'); const p = ctx.sh.resolve(arg.endsWith('.esl') ? arg : arg + '.esl'); VFS.write(p, ESL.serialize({ meta: { name: VFS.basename(arg).replace(/\.esl$/, ''), icon: '✨', version: '1.0', author: OS.settings.username }, html: '<h1>Hello!</h1>\n<button id="b">Click me</button>', css: 'body{padding:20px;text-align:center}', js: "document.getElementById('b').onclick = () => os.notify('Hello', 'It works!');" })); ctx.out(`Created ${p}\n`); return; }
      if (sub === 'info') { const a = ESL.parse(VFS.read(ctx.sh.resolve(arg))); Object.entries(a.meta).forEach(([k, v]) => ctx.out(`${k.padEnd(12)} ${v}\n`)); ctx.out(`html: ${a.html.length}B  css: ${a.css.length}B  js: ${a.js.length}B\n`); return; }
      if (sub === 'run') { ESL.run(ctx.sh.resolve(arg)); return; }
      throw new Error('usage: esl new|info|run');
    } },
    hsl: { help: 'Shortcut tool', usage: 'hsl create <name> <target> [dir] | hsl info <file>', fn: ctx => {
      const [sub, a, b, c] = ctx.args;
      if (sub === 'create') { if (!a || !b) throw new Error('usage: hsl create <name> <target> [dir]'); const target = OS.getApp(b) ? 'app:' + b : /^(app|url|cmd):/.test(b) ? b : ctx.sh.resolve(b); ctx.out(HSL.create(c ? ctx.sh.resolve(c) : VFS.home() + '/Desktop', a, target) + '\n'); return; }
      if (sub === 'info') { ctx.out(JSON.stringify(HSL.parse(VFS.read(ctx.sh.resolve(a))), null, 2) + '\n'); return; }
      throw new Error('usage: hsl create|info');
    } },
    ai: { help: 'Ask Rocky AI', usage: 'ai <question>', fn: async ctx => { needArg(ctx); ctx.out(C.gray + 'Rocky is thinking…' + C.reset + '\n'); const r = await Rocky.ask(ctx.args.join(' '), { fromTerminal: true }); ctx.out(`${C.cyan}🤖 ${r}${C.reset}\n`); } },
    calc: { help: 'Calculator', usage: 'calc 2+2*sqrt(9)', fn: ctx => { needArg(ctx); ctx.out(Calc.eval(ctx.args.join(' ')) + '\n'); } },
    expr: { help: 'Evaluate expression', fn: ctx => CMDS.calc.fn(ctx) }, bc: { help: 'Calculator (reads stdin)', fn: ctx => ctx.out(lines(ctx.args.join(' ') || ctx.stdin).filter(Boolean).map(l => Calc.eval(l)).join('\n') + '\n') },
    js: { help: 'Evaluate JavaScript (advanced)', usage: 'js <expression>', fn: ctx => { needArg(ctx); const r = (0, eval)(ctx.args.join(' ')); ctx.out((typeof r === 'object' ? JSON.stringify(r, null, 2) : String(r)) + '\n'); } },
    sudo: { help: 'Run as superuser', fn: async ctx => { needArg(ctx); ctx.out(`${C.gray}[sudo] granted for ${OS.settings.username}${C.reset}\n`); return ctx.sh.exec(ctx.args[0], { ...ctx, args: ctx.args.slice(1) }); } },

    cowsay: { help: 'A talking cow', fn: ctx => { const t = ctx.args.join(' ') || ctx.stdin.trim() || 'Moo! Welcome to RocketOS'; ctx.out(` ${'_'.repeat(t.length + 2)}\n< ${t} >\n ${'-'.repeat(t.length + 2)}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||\n`); } },
    fortune: { help: 'Random wisdom', fn: ctx => { const f = ['The best way to predict the future is to launch it. 🚀', 'There are 10 kinds of people: those who understand binary and those who don’t.', 'A clean desktop is a sign of an unused computer.', 'Keep calm and rm -rf /tmp', 'Every great app started as a hello world.', 'In space, no one can hear your fans spin.', 'Talk is cheap. Show me the .esl.', 'To iterate is human, to recurse divine.']; ctx.out(f[Math.floor(Math.random() * f.length)] + '\n'); } },
    banner: { help: 'Big text', fn: ctx => { const t = (ctx.args.join(' ') || 'ROCKET').toUpperCase(); ctx.out(C.orange + t.split('').join(' ') + '\n' + '═'.repeat(t.length * 2) + C.reset + '\n'); } },
    lolcat: { help: 'Rainbow text', fn: ctx => { const cols = [31, 33, 32, 36, 34, 35]; ctx.out([...(ctx.args.join(' ') || ctx.stdin)].map((c, i) => c === '\n' ? c : `\x1b[${cols[i % 6]}m${c}`).join('') + C.reset + '\n'); } },
    yes: { help: 'Repeat text (Ctrl+C)', fn: async ctx => { const t = ctx.args.join(' ') || 'y'; for (let i = 0; i < 2000 && !ctx.sh.aborted; i++) { ctx.out(t + '\n'); if (i % 50 === 0) await sleep(10); } } },
    matrix: { help: 'Digital rain (Ctrl+C)', fn: async ctx => { const ch = 'ｱｲｳｴｵｶｷｸｹｺ01ROCKET$#@%'; const end = Date.now() + 8000; while (!ctx.sh.aborted && Date.now() < end) { let l = ''; for (let i = 0; i < 70; i++) l += Math.random() < 0.3 ? ch[Math.floor(Math.random() * ch.length)] : ' '; ctx.out(C.green + l + C.reset + '\n'); await sleep(50); } } },
    repeat: { help: 'Repeat a command N times', usage: 'repeat 3 echo hi', fn: async ctx => { needArg(ctx, 2); const n = Math.min(1000, +ctx.args[0]); for (let i = 0; i < n && !ctx.sh.aborted; i++) { ctx.sh.env.I = String(i + 1); await ctx.sh.run(ctx.args.slice(1).map(a => /\s/.test(a) ? `"${a}"` : a).join(' ')); } } },
  };
  function fmtUp(t) { const s = Math.floor((Date.now() - t) / 1000); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

  /** Headless execution, returns plain-text output. */
  async function exec(line, opts = {}) {
    let buf = '';
    const s = new Session({ write: t => buf += t, cwd: opts.cwd });
    await s.run(line);
    return buf.replace(/\x1b\[[\d;]*m/g, '');
  }

  return { Session, CMDS, exec, C, tokenize, parse };
})();

/* ------------------------------------------------------------ ANSI → HTML */
function ansiToHtml(s) {
  const map = { 30: '#555', 31: '#ff5c57', 32: '#5af78e', 33: '#f3f99d', 34: '#57c7ff', 35: '#ff6ac1', 36: '#9aedfe', 37: '#f1f1f0', 90: '#7a7f8c', 93: '#ffb86c' };
  const bg = { 41: '#ff5c57', 42: '#5af78e', 43: '#f3f99d', 44: '#57c7ff', 45: '#ff6ac1', 46: '#9aedfe', 47: '#f1f1f0' };
  let out = '', open = 0;
  const parts = String(s).split(/\x1b\[([\d;]*)m/);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) { out += OS.esc(parts[i]); continue; }
    const codes = parts[i].split(';').map(Number);
    for (const c of codes) {
      if (c === 0 || isNaN(c)) { out += '</span>'.repeat(open); open = 0; }
      else if (c === 1) { out += '<span style="font-weight:bold">'; open++; }
      else if (map[c]) { out += `<span style="color:${map[c]}">`; open++; }
      else if (bg[c]) { out += `<span style="background:${bg[c]}">`; open++; }
    }
  }
  return out + '</span>'.repeat(open);
}

/* ------------------------------------------------------------ Terminal app */
OS.registerApp({ id: 'terminal', name: 'Terminal', icon: '💻', category: 'System', width: 760, height: 470, desc: 'Advanced shell with tabs, themes, pipes and batch scripts',
  launch(win, args = {}) {
    const { h } = OS;
    const themes = { rocket: 'Rocket', matrix: 'Matrix', amber: 'Retro Amber', ocean: 'Ocean', light: 'Paper' };
    let theme = localStorage.getItem('rocketos.term.theme') || 'rocket';
    let fontSize = +(localStorage.getItem('rocketos.term.font') || 14);
    const tabsBar = h('div', { class: 'term-tabs' });
    const panes = h('div', { class: 'term-panes' });
    const themeSel = h('select', { class: 'term-theme', title: 'Theme' }, ...Object.entries(themes).map(([k, v]) => h('option', { value: k, selected: k === theme }, v)));
    themeSel.addEventListener('change', () => { theme = themeSel.value; localStorage.setItem('rocketos.term.theme', theme); root.dataset.theme = theme; });
    const fontBtn = d => h('button', { class: 'term-tool', title: d > 0 ? 'Bigger text' : 'Smaller text', onclick: () => setFont(fontSize + d) }, d > 0 ? 'A+' : 'A−');
    const addBtn = h('button', { class: 'term-tool add', title: 'New tab (Ctrl+Shift+T)', onclick: () => newTab() }, '+');
    const root = h('div', { class: 'terminal', 'data-theme': theme }, h('div', { class: 'term-top' }, tabsBar, addBtn, h('div', { class: 'tb-spacer' }), fontBtn(-1), fontBtn(1), themeSel), panes);
    win.body.append(root);
    const setFont = s => { fontSize = Math.max(9, Math.min(28, s)); localStorage.setItem('rocketos.term.font', fontSize); root.style.setProperty('--tfont', fontSize + 'px'); };
    setFont(fontSize);
    const tabs = []; let active = null;

    function newTab(opts = {}) {
      const out = h('div', { class: 'term-out' });
      const promptEl = h('span', { class: 'term-prompt' });
      const input = h('input', { class: 'term-input', spellcheck: 'false', autocomplete: 'off' });
      const line = h('div', { class: 'term-line' }, promptEl, input);
      const pane = h('div', { class: 'term-pane' }, out, line);
      panes.append(pane);
      const label = h('span', {}, 'rsh');
      const tabEl = h('div', { class: 'term-tab' }, '💻 ', label, h('button', { class: 'x', onclick: e => { e.stopPropagation(); closeTab(tab); } }, '×'));
      tabEl.addEventListener('click', () => activate(tab));
      tabsBar.append(tabEl);
      let readResolve = null, busy = false, hIdx = -1, draft = '';
      const write = text => {
        const atBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 40;
        const span = document.createElement('span'); span.innerHTML = ansiToHtml(text); out.append(span);
        if (out.childNodes.length > 3000) for (let i = 0; i < 500; i++) out.firstChild.remove();
        if (atBottom || busy) pane.scrollTop = pane.scrollHeight;
      };
      const sh = new Shell.Session({ cwd: opts.cwd || args.cwd, write,
        clear: () => { out.innerHTML = ''; },
        readLine: p => new Promise(res => { promptEl.innerHTML = ansiToHtml(p); line.style.display = ''; input.value = ''; input.focus(); readResolve = res; }),
        exit: () => closeTab(tab) });
      const tab = { pane, tabEl, sh, input, label };
      const showPrompt = () => { promptEl.innerHTML = ansiToHtml(sh.prompt()); line.style.display = ''; input.focus(); pane.scrollTop = pane.scrollHeight; label.textContent = VFS.basename(sh.cwd) || '/'; };
      async function execute(cmd, echo = true) {
        if (echo) write(sh.prompt() + cmd + '\n');
        busy = true; line.style.display = 'none'; sh.aborted = false;
        try { await sh.run(cmd); } catch (e) { write(`\x1b[31m${e.message}\x1b[0m\n`); }
        busy = false; sh.aborted = false; showPrompt();
      }
      tab.execute = execute;
      input.addEventListener('keydown', async e => {
        if (readResolve) { if (e.key === 'Enter') { const v = input.value; write(promptEl.textContent + v + '\n'); const r = readResolve; readResolve = null; line.style.display = 'none'; r(v); } else if (e.key === 'c' && e.ctrlKey) { sh.aborted = true; const r = readResolve; readResolve = null; r(null); } return; }
        if (e.key === 'Enter') { const cmd = input.value; input.value = ''; hIdx = -1; sh.addHistory(cmd); if (!cmd.trim()) { write(sh.prompt() + '\n'); return; } await execute(cmd); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (!sh.history.length) return; if (hIdx === -1) { draft = input.value; hIdx = sh.history.length; } hIdx = Math.max(0, hIdx - 1); input.value = sh.history[hIdx]; }
        else if (e.key === 'ArrowDown') { e.preventDefault(); if (hIdx === -1) return; hIdx++; if (hIdx >= sh.history.length) { hIdx = -1; input.value = draft; } else input.value = sh.history[hIdx]; }
        else if (e.key === 'Tab') {
          e.preventDefault();
          const { word, options } = sh.complete(input.value);
          if (options.length === 1) input.value = input.value.slice(0, input.value.length - word.length) + options[0] + (options[0].endsWith('/') ? '' : ' ');
          else if (options.length > 1) {
            let pre = options[0]; for (const o of options) while (!o.startsWith(pre)) pre = pre.slice(0, -1);
            if (pre.length > word.length) input.value = input.value.slice(0, input.value.length - word.length) + pre;
            else write(sh.prompt() + input.value + '\n' + options.join('  ') + '\n');
          }
        }
        else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
        else if (e.key === 'c' && e.ctrlKey && input.selectionStart === input.selectionEnd) { write(sh.prompt() + input.value + '^C\n'); input.value = ''; }
      });
      pane.addEventListener('keydown', e => { if (busy && e.key === 'c' && e.ctrlKey) { sh.aborted = true; write('^C\n'); } });
      pane.tabIndex = 0;
      pane.addEventListener('mouseup', () => { if (!getSelection().toString()) (line.style.display === 'none' ? pane : input).focus(); });
      tabs.push(tab); activate(tab);
      write(`\x1b[93m\x1b[1m🚀 RocketOS Terminal\x1b[0m — rsh 2.0 · type \x1b[36mhelp\x1b[0m for commands, \x1b[36mneofetch\x1b[0m for system info\n`);
      showPrompt();
      if (opts.run) execute(opts.run);
      return tab;
    }
    function activate(tab) { active = tab; tabs.forEach(t => { t.pane.classList.toggle('active', t === tab); t.tabEl.classList.toggle('active', t === tab); }); setTimeout(() => tab.input.focus(), 0); }
    function closeTab(tab) { tab.sh.aborted = true; const i = tabs.indexOf(tab); tabs.splice(i, 1); tab.pane.remove(); tab.tabEl.remove(); if (!tabs.length) return win.close(); activate(tabs[Math.max(0, i - 1)]); }
    root.addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') { e.preventDefault(); newTab({ cwd: active && active.sh.cwd }); } if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); setFont(fontSize + 1); } if (e.ctrlKey && e.key === '-') { e.preventDefault(); setFont(fontSize - 1); } });

    newTab({ run: args.run, cwd: args.cwd });
    if (args.script) active.execute(`run "${args.script}"`);
    win.onClose(() => tabs.forEach(t => t.sh.aborted = true));
  } });

OS.registerOpener('log', (path, opts) => OS.launch('terminal', { script: path, cwd: VFS.dirname(path) }));
