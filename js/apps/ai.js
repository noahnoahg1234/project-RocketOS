/* Rocky — RocketOS's AI assistant.
 * Local mode: an offline intent engine that can control the OS.
 * Cloud mode: conversations powered by Claude via the official Anthropic SDK (loaded from a CDN, called from the browser). */
const Rocky = (() => {
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.39.0/+esm';
  const MODEL = 'claude-opus-5-5';
  let sdkPromise = null;

  const jokes = ['Why did the rocket lose its job? It got fired. 🚀', 'I would tell you a UDP joke, but you might not get it.', 'Why do programmers prefer dark mode? Because light attracts bugs. 🐛', 'There’s no place like 127.0.0.1.', 'My code doesn’t have bugs — it just develops random features.', 'Why was the computer cold? It left its Windows open.'];
  const findApp = q => {
    q = q.toLowerCase().replace(/^(the|a|an|my)\s+/, '').replace(/\s+(app|game|please)$/g, '').trim();
    const apps = OS.listApps();
    return apps.find(a => a.id === q || a.name.toLowerCase() === q) || apps.find(a => a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase()) || a.id.includes(q.replace(/\s/g, '')));
  };

  // ---------------------------------------------------------------- local engine
  async function local(text) {
    const t = text.trim(), l = t.toLowerCase().replace(/[?!.]+$/, '');
    let m;
    if (/^(hi|hello|hey|yo|sup|howdy|good (morning|afternoon|evening))\b/.test(l)) return `Hey ${OS.settings.username}! 👋 I’m Rocky. I can open apps, change settings, run commands, do math and explain RocketOS. Try “open snake”, “dark mode” or “what’s the weather”.`;
    if (/(what can you do|^help$|commands|abilities)/.test(l)) return 'Here’s what I can do:\n• Open apps & games — “open paint”, “play snake”\n• Settings — “dark mode”, “wallpaper sunset”, “volume 40”, “wifi off”\n• Shell — “run ls -l ~”\n• Math — “what is 15% of 80”, “sqrt(144)+2”\n• Files — “create a note called groceries”, “find readme”\n• Reminders — “remind me in 5 minutes to stretch”\n• Info — time, date, weather, system info, how .esl/.log/.hsl work\nAdd an API key in Settings → AI for full Claude-powered conversations.';
    if (/\b(time)\b/.test(l) && !/timer/.test(l)) return `It’s ${new Date().toLocaleTimeString()} ⏰`;
    if (/\b(date|day is it|today)\b/.test(l)) return `Today is ${new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} 📅`;
    if ((m = l.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/))) return `${m[1]}% of ${m[2]} is ${Calc.eval(`${m[1]}*${m[2]}/100`)} 🧮`;
    { const expr = l.replace(/^(what is|what's|whats|calculate|calc|compute|solve)\s+/, '').replace(/\btimes\b/g, '*').replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-').replace(/\bdivided by\b/g, '/').replace(/(\d)\s*x\s*(?=\d)/g, '$1*');
      if (/\d/.test(expr) && /^[\d\s+\-*/().^%!a-z,]*$/.test(expr) && /[+\-*/^!(]/.test(expr)) { try { return `${expr.trim()} = ${Calc.eval(expr)} 🧮`; } catch {} } }
    if ((m = l.match(/^(?:run|execute|exec|terminal|shell)\s+[`'"]?(.+?)[`'"]?$/))) { const out = await Shell.exec(t.replace(/^\S+\s+/, '').replace(/^[`'"]|[`'"]$/g, '')); return '```\n' + (out.trim() || '(no output)').slice(0, 3000) + '\n```'; }
    if (/(close|kill) (all|every)( the)? windows?/.test(l)) { WM.closeAll(); return 'Closed all windows 🧹'; }
    if (/(show|go to) (the )?desktop/.test(l)) { WM.showDesktop(); return 'Here’s your desktop 🖥️'; }
    if (/(dark|night) (mode|theme)/.test(l) || l === 'dark') { OS.set('theme', 'dark'); return 'Switched to dark mode 🌙'; }
    if (/(light|day) (mode|theme)/.test(l) || l === 'light') { OS.set('theme', 'light'); return 'Switched to light mode ☀️'; }
    if ((m = l.match(/wallpaper\s*(?:to)?\s*(.*)$/))) {
      const w = Object.entries(Desktop.wallpapers).find(([k, v]) => m[1] && (k.includes(m[1]) || v.name.toLowerCase().includes(m[1])));
      if (w) { OS.set('wallpaper', w[0]); return `Wallpaper set to ${w[1].name} 🖼️`; }
      OS.launch('settings', { page: 'personalize' }); return `I opened wallpaper settings. Available: ${Object.values(Desktop.wallpapers).map(v => v.name).join(', ')}.`;
    }
    if ((m = l.match(/(?:volume|sound)\s*(?:to)?\s*(\d+)/))) { OS.set('volume', Math.min(100, +m[1])); return `Volume set to ${Math.min(100, +m[1])}% 🔊`; }
    if (/\bmute\b/.test(l)) { OS.set('volume', 0); return 'Muted 🔇'; }
    if (/wi-?fi (off|disable)/.test(l)) { NET.setEnabled(false); return 'Wi-Fi turned off 📴'; }
    if (/wi-?fi (on|enable)/.test(l)) { NET.setEnabled(true); return 'Wi-Fi turned on 📶'; }
    if (/(wi-?fi|internet|network|online|connected)/.test(l)) { const s = NET.status(); return `Wi-Fi: ${s.text}. Internet ${NET.online() ? 'is reachable ✅' : 'is not reachable ❌'}. ${NET.current() ? '' : 'Open the Wi-Fi menu in the top bar to connect (home network RocketNet-5G, password rocket123).'}`; }
    if (/weather|temperature|forecast/.test(l)) { const w = await Weather.get(Weather.city()); return `${w.icon} ${w.city}: ${Math.round(w.temp)}°C, ${w.desc.toLowerCase()}, wind ${Math.round(w.wind)} km/h${w.live ? '' : ' (offline estimate — connect Wi-Fi for live data)'}.`; }
    if ((m = l.match(/remind me in (\d+)\s*(second|sec|minute|min|hour)s?\s*(?:to\s+)?(.*)/))) {
      const ms = +m[1] * (m[2].startsWith('h') ? 3600e3 : m[2].startsWith('m') ? 60e3 : 1e3);
      setTimeout(() => { OS.notify('⏰ Reminder from Rocky', m[3] || 'Time’s up!', '🤖', { force: true, duration: 12000 }); OS.Sound.tone(880, 0.3, 'triangle', 0.15); }, ms);
      return `Okay! I’ll remind you in ${m[1]} ${m[2]}${+m[1] > 1 ? 's' : ''}${m[3] ? ' to ' + m[3] : ''} ⏰`;
    }
    if ((m = t.match(/(?:create|make|new|write) (?:a )?note(?: called| named)? ["“]?([^"”:]+?)["”]?(?:\s*[:,-]\s*(.*))?$/i)) || (m = t.match(/^note:\s*(.*)$/i))) {
      const title = (m[2] !== undefined ? m[1] : 'Quick note').trim().slice(0, 40), body = (m[2] !== undefined ? m[2] : m[1]) || '';
      const p = VFS.uniqueName(VFS.home() + '/Documents/Notes', title.replace(/[\/]/g, '-'), '.txt'); VFS.write(p, body);
      return `Created note “${VFS.basename(p)}” in ~/Documents/Notes 🗒️`;
    }
    if ((m = l.match(/^(?:find|search(?: for)?|where is)\s+(?:file\s+)?(.+)/))) { const r = []; VFS.walk('/', p => { if (r.length < 8 && VFS.basename(p).toLowerCase().includes(m[1])) r.push(p); }); return r.length ? 'I found:\n' + r.map(p => '• ' + p).join('\n') : `No files matching “${m[1]}”.`; }
    if ((m = l.match(/^install\s+(.+)/))) { const app = Store.catalog().find(a => a.id === m[1].trim() || a.name.toLowerCase().includes(m[1].trim())); if (!app) return `I couldn’t find “${m[1]}” in the App Store.`; try { await Store.install(app.id); return `Installed ${app.icon} ${app.name}! Find it in Start → Programs → Store Apps.`; } catch (e) { return 'Install failed: ' + e.message; } }
    if ((m = l.match(/^(?:open|launch|start|play|run app|show)\s+(.+)/))) {
      const app = findApp(m[1]);
      if (app) { OS.launch(app.id); return `Opening ${app.icon} ${app.name}…`; }
      const p = VFS.normalize(m[1], VFS.home()); if (VFS.exists(p)) { OS.openFile(p); return `Opening ${p}`; }
      return `I couldn’t find an app called “${m[1]}”. Try “list apps”.`;
    }
    if (/(list|show|what) (all )?(apps|programs|applications)/.test(l)) return 'Installed apps:\n' + OS.listApps().map(a => `${a.icon} ${a.name}`).join('\n');
    if (/(list|show|what) (all )?games/.test(l)) return 'Games:\n' + OS.listApps().filter(a => a.category === 'Games').map(a => `${a.icon} ${a.name}`).join('\n');
    if (/joke|funny|laugh/.test(l)) return jokes[Math.floor(Math.random() * jokes.length)];
    if (/(system|computer|pc) (info|stats|status)|neofetch|specs|memory|cpu/.test(l)) { const mm = SysStats.mem(); return `🚀 RocketOS ${OS.version} · CPU ${SysStats.cpu().toFixed(0)}% · Memory ${mm.used}/${mm.total} MB · Storage ${OS.fmtSize(VFS.usage())} · ${OS.procs.length} processes · ${WM.list().length} windows.`; }
    if (/\.?esl\b|make (an |a )?app|create (an |a )?app|build (an |a )?app/.test(l)) return '🧩 .esl files are RocketOS apps: a header (name, icon, size…) plus ---html, ---css and ---js sections. The easiest way to build one is App Maker (I can open it — say “open app maker”). From there you can Run, Save to ~/apps, and Publish to the App Store.';
    if (/\.?log\b|batch|script/.test(l)) return '📜 .log files are batch scripts — one shell command per line, # for comments, $1 $2 for arguments, plus for/if one-liners. Run them by double-clicking, or with ./file.log in the Terminal. ~/.startup.log runs at every boot.';
    if (/\.?hsl\b|shortcut/.test(l)) return '🔗 .hsl files are shortcuts. They contain name=, icon= and target= (app:id, /path, url:https://… or cmd:command). Right-click the desktop → New Shortcut, or run: hsl create Snake app:snake';
    if (/who are you|your name|what are you/.test(l)) return 'I’m Rocky 🤖, the assistant built into RocketOS. In Local mode I work offline; in Cloud mode I’m powered by Claude.';
    if (/(thank|thanks|thx)/.test(l)) return 'Anytime! 🚀';
    if (/(rocketos|this os|operating system)/.test(l)) return 'RocketOS is a Unix-inspired desktop OS with a real file tree, the rsh shell, .esl apps, .log batch scripts, .hsl shortcuts, an App Store you can publish to, App Maker, widgets, Wi-Fi and 10 games. Open the Guide (Help → RocketOS Guide) to learn more.';
    const app = findApp(l); if (app && l.split(' ').length <= 3) { OS.launch(app.id); return `Opening ${app.icon} ${app.name}…`; }
    return null;
  }

  // ---------------------------------------------------------------- cloud (Claude)
  function systemPrompt() {
    return `You are Rocky, the friendly built-in AI assistant of RocketOS — a Unix-inspired desktop operating system that runs in the user's web browser. Keep answers concise (a few sentences, short lists) and use plain text with an occasional emoji.

RocketOS facts: file formats are .esl (apps: metadata header + ---html/---css/---js sections, with an "os" JS API), .log (batch scripts, one shell command per line), .hsl (shortcuts: name=, icon=, target=app:<id>|/path|url:…|cmd:…). The shell is "rsh" with pipes, redirects, for/if one-liners. Users can build apps in App Maker and publish them to the App Store. The current user is "${OS.settings.username}". Wi-Fi status: ${NET.status().text}.

You can control the OS by including action tags anywhere in your reply. They are executed and hidden from the user:
[[open:<appId>]] launches an app. Available app ids: ${OS.listApps().map(a => a.id).join(', ')}.
[[run:<shell command>]] runs a command in a new Terminal window.
[[theme:dark]] or [[theme:light]]. [[wallpaper:<${Object.keys(Desktop.wallpapers).join('|')}>]].
[[notify:<text>]] shows a notification.
Only use actions when the user asks for something to happen.`;
  }
  async function cloud(history) {
    if (!OS.settings.aiKey) throw new Error('No API key set. Add one in Settings → Rocky AI, or switch to Local mode.');
    if (!NET.online()) throw new Error('Cloud mode needs internet — connect to Wi-Fi first.');
    sdkPromise = sdkPromise || import(SDK_URL);
    const { default: Anthropic } = await sdkPromise;
    const client = new Anthropic({ apiKey: OS.settings.aiKey, dangerouslyAllowBrowser: true });
    const msgs = history.slice(-20).map(m => ({ role: m.role, content: m.content }));
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    const res = await client.beta.messages.create({
      model: MODEL, max_tokens: 4096, system: systemPrompt(), messages: msgs,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    });
    if (res.stop_reason === 'refusal') return 'Sorry, I can’t help with that one. 🙏';
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return text || '(no reply)';
  }
  function runActions(text) {
    return text.replace(/\[\[(\w+):([^\]]+)\]\]/g, (_, k, v) => {
      v = v.trim();
      try {
        if (k === 'open') OS.launch(v);
        else if (k === 'run') OS.launch('terminal', { run: v });
        else if (k === 'theme') OS.set('theme', v === 'light' ? 'light' : 'dark');
        else if (k === 'wallpaper' && Desktop.wallpapers[v]) OS.set('wallpaper', v);
        else if (k === 'notify') OS.notify('Rocky', v, '🤖');
      } catch (e) { console.warn(e); }
      return '';
    }).replace(/\n{3,}/g, '\n\n').trim();
  }

  /** Ask Rocky. Returns reply text. history: optional [{role, content}] including the new user message. */
  async function ask(text, opts = {}) {
    const history = opts.history || [{ role: 'user', content: text }];
    if (OS.settings.aiMode === 'cloud') {
      try { return runActions(await cloud(history)); }
      catch (e) { const fb = await local(text); return (fb ? fb + '\n\n' : '') + `☁️ Cloud mode unavailable: ${e.message}`; }
    }
    const r = await local(text);
    return r || `Hmm, I’m not sure about that one in Local mode. 🤔 Try “help” to see what I can do, or turn on Cloud mode in Settings → Rocky AI for full answers powered by Claude.`;
  }
  return { ask, local };
})();

OS.registerApp({ id: 'rocky', name: 'Rocky AI', icon: '🤖', category: 'Accessories', width: 440, height: 580, singleton: true, desc: 'Your AI assistant',
  onReopen(win, args) { if (args.ask && win._send) win._send(args.ask); },
  launch(win, args = {}) {
    const { h } = OS;
    let history = []; try { history = JSON.parse(localStorage.getItem('rocketos.rocky') || '[]'); } catch {}
    const log = h('div', { class: 'rk-log' });
    const input = h('textarea', { class: 'rk-input', rows: 1, placeholder: 'Ask Rocky anything…' });
    const send = h('button', { class: 'btn primary rk-send' }, '➤');
    const mode = h('span', { class: 'rk-mode' });
    const chips = h('div', { class: 'rk-chips' }, ...['What can you do?', 'Open snake', 'Dark mode', 'What’s the weather?', 'run neofetch', 'Tell me a joke', 'How do I make an app?'].map(c => h('button', { class: 'chip', onclick: () => go(c) }, c)));
    win.body.append(h('div', { class: 'rocky' },
      h('div', { class: 'rk-head' }, h('div', { class: 'rk-avatar' }, '🤖'), h('div', {}, h('b', {}, 'Rocky'), h('div', {}, mode)), h('div', { class: 'tb-spacer' }), h('button', { class: 'btn sm', title: 'Clear chat', onclick: () => { history = []; save(); render(); } }, '🧹'), h('button', { class: 'btn sm', title: 'AI settings', onclick: () => OS.launch('settings', { page: 'ai' }) }, '⚙️')),
      log, chips, h('div', { class: 'rk-bar' }, input, send)));
    const updMode = () => mode.textContent = OS.settings.aiMode === 'cloud' ? '☁️ Cloud · Claude' + (NET.online() ? '' : ' (offline)') : '💡 Local mode';
    updMode(); const off = OS.on('settings', updMode); win.onClose(off);
    const save = () => { try { localStorage.setItem('rocketos.rocky', JSON.stringify(history.slice(-60))); } catch {} };
    const bubble = (role, text) => {
      const b = h('div', { class: 'rk-msg ' + role });
      // tiny markdown: code fences + bold
      b.innerHTML = OS.esc(text).replace(/```\n?([\s\S]*?)```/g, '<pre>$1</pre>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
      log.append(b); log.scrollTop = log.scrollHeight; return b;
    };
    const render = () => { log.innerHTML = ''; if (!history.length) bubble('assistant', `Hi ${OS.settings.username}! I’m Rocky 🤖 — your RocketOS assistant. Ask me to open apps, change settings, run commands, or explain how things work.`); history.forEach(m => bubble(m.role, m.content)); };
    async function go(text) {
      text = text.trim(); if (!text) return;
      input.value = ''; history.push({ role: 'user', content: text }); bubble('user', text);
      const typing = bubble('assistant typing', '…'); send.disabled = true;
      let reply;
      try { reply = await Rocky.ask(text, { history }); } catch (e) { reply = 'Error: ' + e.message; }
      typing.remove(); send.disabled = false;
      history.push({ role: 'assistant', content: reply }); bubble('assistant', reply); save();
      input.focus();
    }
    win._send = go;
    send.onclick = () => go(input.value);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(input.value); } });
    render(); input.focus();
    if (args.ask) go(args.ask);
  } });
