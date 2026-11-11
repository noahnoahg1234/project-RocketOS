/* RocketOS boot: seeds the file system, shows BIOS + splash, lock screen, then the desktop. */
const Boot = (() => {
  const { h } = OS;
  const $ = s => document.querySelector(s);

  function seed() {
    const H = '/home/' + OS.settings.username;
    ['/bin', '/etc', '/apps', '/apps/games', '/apps/store', '/tmp', '/var/log', H, H + '/Desktop', H + '/Documents', H + '/Pictures', H + '/Music', H + '/Downloads', H + '/scripts', H + '/apps', H + '/.trash'].forEach(d => VFS.mkdir(d));
    VFS.write('/etc/hostname', OS.settings.hostname + '\n');
    VFS.write('/etc/os-release', `NAME="RocketOS"\nVERSION="${OS.version} (Liftoff)"\nID=rocketos\nPRETTY_NAME="RocketOS ${OS.version}"\nHOME_URL="rocket://home"\n`);
    VFS.write('/etc/motd', 'Welcome to RocketOS — the sky is not the limit. 🚀\n');
    VFS.write('/etc/passwd', `root:x:0:0:root:/root:/bin/rsh\n${OS.settings.username}:x:1000:1000:${OS.settings.username}:${H}:/bin/rsh\n`);
    VFS.write('/var/log/syslog.txt', `[${new Date().toISOString()}] RocketOS installed\n`);

    VFS.write(H + '/Desktop/Welcome.txt', `Welcome to RocketOS ${OS.version}! 🚀

Things to try:
  • Click Start (bottom-left) for the classic Start menu
  • Open the Terminal and type: help, neofetch, wifi list, ls -l /apps
  • Double-click hello.log to run a batch script
  • Build your own app in App Maker and publish it to the App Store
  • Ask Rocky AI (🤖 in the top bar) to "open snake" or "dark mode"
  • Right-click the desktop for new files, folders and shortcuts (.hsl)
  • Drag widgets around; toggle them with 🧱 in the top bar

File types:
  .esl  RocketOS application
  .log  batch script (one command per line)
  .hsl  shortcut to an app, file, folder, URL or command
`);
    VFS.write(H + '/Desktop/hello.log', `# hello.log — a RocketOS batch script
# Each line is a shell command. Double-click to run!
echo -e "\\e[93m🚀 Hello from a batch script!\\e[0m"
echo -n "Today is: "
date
echo "You are $USER on $HOSTNAME"
for planet in Mercury Venus Earth Mars; do echo "  → visiting $planet"; done
if test -d ~/Documents; then echo "Documents folder found ✓"; else echo "No documents"; fi
notify "Batch complete" "hello.log finished running"
echo Done!
`);
    const sc = (name, target, icon) => VFS.write(`${H}/Desktop/${name}.hsl`, HSL.serialize({ name, target, icon }));
    sc('Terminal', 'app:terminal', '💻'); sc('Files', 'app:files', '📁'); sc('App Store', 'app:store', '🛍️'); sc('App Maker', 'app:appmaker', '🛠️');
    sc('Rocky AI', 'app:rocky', '🤖'); sc('Browser', 'app:browser', '🌐'); sc('Games', '/apps/games', '🎮'); sc('Settings', 'app:settings', '⚙️'); sc('Trash', H + '/.trash', '🗑️');

    VFS.write(H + '/Documents/readme.md', '# My Documents\n\nFiles saved here persist in your browser.\n');
    VFS.write(H + '/Documents/todo.txt', 'buy rocket fuel\nwrite an .esl app\nbeat Snake high score\nclean the desktop\n');
    VFS.write(H + '/Documents/planets.csv', 'planet,moons,distance_au\nMercury,0,0.39\nVenus,0,0.72\nEarth,1,1.00\nMars,2,1.52\nJupiter,95,5.20\nSaturn,146,9.58\n');
    VFS.write(H + '/scripts/sysinfo.log', `# Print a system summary\nneofetch\necho\nwifi status\nfree\ndf\n`);
    VFS.write(H + '/scripts/backup.log', `# Back up ~/Documents into ~/backup\necho Backing up documents…\nmkdir -p ~/backup\ncp ~/Documents/* ~/backup\nls -l ~/backup\nnotify Backup "Documents copied to ~/backup"\n`);
    VFS.write(H + '/scripts/countdown.log', `# Usage: run countdown.log 5\nN=$1\ntest -z "$N" && N=3\necho Countdown from $N\nfor i in 10 9 8 7 6 5 4 3 2 1; do if test $i -le $N; then echo "  $i…"; sleep 1; else true; fi; done\necho 🚀 Liftoff!\n`);
    VFS.write(H + '/scripts/greet.log', `# Interactive greeting\nread -p "What's your name? " NAME\necho "Nice to meet you, $NAME! 👋"\n`);
    VFS.write(H + '/.startup.log', `# Runs automatically every time RocketOS boots.\n# Add commands like: notify "Good morning" "Have a great day"\n`);
    VFS.write(H + '/apps/Sticky Clicker.esl', ESL.serialize({ meta: { name: 'Sticky Clicker', icon: '🖱️', version: '1.0', author: OS.settings.username, width: 320, height: 260, category: 'Games', description: 'A sample app made with App Maker — open it in App Maker to see how it works!' },
      html: '<h2>🖱️ Sticky Clicker</h2>\n<div id="n">0</div>\n<button id="b">Click!</button>', css: 'body{text-align:center;padding:16px}\n#n{font-size:56px;font-weight:800}', js: "let n = 0;\nos.storage.get('clicks').then(v => { n = v || 0; show(); });\nconst show = () => document.getElementById('n').textContent = n;\nb.onclick = () => { n++; show(); os.storage.set('clicks', n); if (n % 50 === 0) os.notify('Sticky Clicker', n + ' clicks! 🎉'); };" }));
  }

  /** Make sure every built-in app has an .esl stub in /apps and every shell command has an entry in /bin. */
  function syncSystem() {
    OS.listApps().forEach(a => {
      const p = a.category === 'Games' ? `/apps/games/${a.id}.esl` : `/apps/${a.id}.esl`;
      if (!VFS.exists(p)) VFS.write(p, ESL.serialize({ meta: { name: a.name, icon: a.icon, version: OS.version, author: 'RocketOS', category: a.category, description: a.desc || '', builtin: a.id } }));
    });
    Object.keys(Shell.CMDS).forEach(c => { if (!/^[\w.-]+$/.test(c)) return; const p = '/bin/' + c; if (!VFS.exists(p)) { VFS.write(p, `#!/bin/rsh builtin\n# ${Shell.CMDS[c].help}\n`); VFS.getNode(p).mode = 'rwxr-xr-x'; } });
    VFS.save();
  }

  // ---------------- BIOS + splash
  function bootScreen(done) {
    const el = $('#boot'); el.className = ''; el.innerHTML = '';
    const bios = h('pre', { class: 'bios' });
    el.append(bios);
    const lines = ['RocketBIOS v2.6  (C) RocketOS Project', '', `CPU: Rocket Quantum ${navigator.hardwareConcurrency || 4}-core @ 4.20GHz`, 'Memory Test: 8192 MB OK', 'Detecting storage… rocketfs (localStorage) ' + OS.fmtSize(VFS.usage()), 'Detecting network… wlan0 ' + (OS.settings.wifi.enabled ? 'up' : 'down'), 'Loading rocket-kernel 1.0 …', ''];
    let i = 0, skipped = false;
    const skip = () => { if (skipped) return; skipped = true; el.removeEventListener('click', skip); removeEventListener('keydown', skip); splash(); };
    el.addEventListener('click', skip); addEventListener('keydown', skip);
    const next = () => { if (skipped) return; if (i < lines.length) { bios.textContent += lines[i++] + '\n'; setTimeout(next, 110); } else setTimeout(skip, 250); };
    next();
    function splash() {
      el.innerHTML = '';
      const bar = h('i');
      const msg = h('div', { class: 'splash-msg' }, 'Starting RocketOS…');
      el.append(h('div', { class: 'splash' }, h('div', { class: 'splash-logo' }, '🚀'), h('div', { class: 'splash-name' }, h('b', {}, 'Rocket'), 'OS'), h('div', { class: 'splash-bar' }, bar), msg));
      const steps = ['Mounting file system…', 'Starting window manager…', 'Bringing up Wi-Fi…', 'Loading apps…', 'Waking up Rocky…', 'Ready for liftoff!'];
      let k = 0;
      const iv = setInterval(() => { k++; bar.style.width = Math.min(100, k / steps.length * 100) + '%'; msg.textContent = steps[Math.min(k, steps.length - 1)]; if (k >= steps.length) { clearInterval(iv); setTimeout(() => { el.classList.add('fade'); setTimeout(() => { el.className = 'hidden'; done(); }, 400); }, 250); } }, 260);
    }
  }

  // ---------------- lock / login screen
  function lock(first = false) {
    OS.closeMenus(); Desktop.closePopup(); Desktop.toggleStart(false);
    const el = $('#lock'); el.className = ''; el.innerHTML = '';
    const bg = h('div', { class: 'lock-bg' }); bg.style.background = getComputedStyle($('#wallpaper')).background || '';
    const clock = h('div', { class: 'lock-clock' }), date = h('div', { class: 'lock-date' });
    const pw = h('input', { class: 'input lock-pw', type: 'password', placeholder: 'Password' });
    const err = h('div', { class: 'lock-err' });
    const btn = h('button', { class: 'btn primary lock-go' }, OS.settings.password ? '→' : 'Log in');
    const form = h('div', { class: 'lock-form' }, h('div', { class: 'avatar xl' }, OS.settings.avatar || '🧑‍🚀'), h('div', { class: 'lock-user' }, OS.settings.username), h('div', { class: 'row center' }, OS.settings.password ? pw : '', btn), err, OS.settings.password ? '' : h('small', { class: 'muted' }, 'Tip: set a password in Settings → Users'));
    el.append(bg, h('div', { class: 'lock-top' }, clock, date), form, h('div', { class: 'lock-foot' }, h('button', { class: 'btn sm', onclick: () => power('shutdown', true) }, '🔌'), h('button', { class: 'btn sm', onclick: () => location.reload() }, '🔄')));
    const tick = () => { const d = new Date(); clock.textContent = OS.fmtTime(d, false); date.textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }); };
    tick(); const iv = setInterval(tick, 1000);
    const go = () => {
      if (OS.settings.password && pw.value !== OS.settings.password) { err.textContent = 'Incorrect password'; form.classList.add('shake'); setTimeout(() => form.classList.remove('shake'), 400); OS.Sound.error(); pw.select(); return; }
      clearInterval(iv); el.classList.add('fade'); setTimeout(() => { el.className = 'hidden'; }, 350);
      $('#os').classList.remove('hidden');
      if (first) startDesktop();
    };
    btn.onclick = go; pw.addEventListener('keydown', e => e.key === 'Enter' && go());
    if (!OS.settings.password) { const k = e => { if (e.key === 'Enter' && !el.classList.contains('hidden')) { removeEventListener('keydown', k); go(); } }; addEventListener('keydown', k); }
    setTimeout(() => (OS.settings.password ? pw : btn).focus(), 100);
  }

  let started = false;
  function startDesktop() {
    if (started) return; started = true;
    Widgets.render();
    if (OS.settings.bootSound) OS.Sound.startup();
    OS.log('session: ' + OS.settings.username + ' logged in');
    const firstRun = !localStorage.getItem('rocketos.welcomed');
    setTimeout(() => {
      if (firstRun) { localStorage.setItem('rocketos.welcomed', '1'); OS.notify('Welcome to RocketOS! 🚀', 'Open Welcome.txt on the desktop to get started.', '🚀', { action: () => OS.openFile(VFS.home() + '/Desktop/Welcome.txt'), duration: 8000 }); }
      else OS.notify('Welcome back, ' + OS.settings.username, NET.status().text, '🚀');
      const s = VFS.home() + '/.startup.log';
      if (VFS.isFile(s) && VFS.read(s).split('\n').some(l => l.trim() && !l.trim().startsWith('#'))) new Shell.Session({ write: () => {} }).runScript(s).catch(e => console.warn(e));
    }, 600);
  }

  async function power(mode, noAsk) {
    if (!mode || !noAsk) {
      const b = await OS.dialog({ title: 'Shut Down RocketOS', icon: '🔌', message: 'What do you want the computer to do?', buttons: mode === 'restart' ? ['Restart', 'Shut down', 'Cancel'] : ['Shut down', 'Restart', 'Lock', 'Cancel'] });
      if (b === 'Cancel' || !b) return;
      if (b === 'Lock') return lock();
      mode = b === 'Restart' ? 'restart' : 'shutdown';
    }
    OS.log('power: ' + mode);
    if (OS.settings.bootSound) OS.Sound.shutdown();
    VFS.save();
    WM.closeAll();
    const el = $('#boot'); el.className = ''; el.innerHTML = '';
    el.append(h('div', { class: 'splash' }, h('div', { class: 'splash-logo' }, '🚀'), h('div', { class: 'splash-msg' }, mode === 'restart' ? 'Restarting…' : 'Shutting down…')));
    setTimeout(() => {
      if (typeof Native !== 'undefined' && Native.on) return Native.power(mode); // real power-off / reboot
      if (mode === 'restart') return location.reload();
      el.innerHTML = '';
      el.append(h('div', { class: 'safe-off' }, h('div', {}, 'It is now safe to turn off your computer.'), h('button', { class: 'btn', onclick: () => location.reload() }, '🔌 Power on')));
      $('#os').classList.add('hidden');
    }, 1300);
  }

  function start() {
    VFS.init(seed);
    if (!VFS.isDir(VFS.home())) { VFS.mkdir(VFS.home() + '/Desktop'); VFS.mkdir(VFS.home() + '/Documents'); }
    syncSystem();
    Desktop.init();
    bootScreen(() => lock(true));
  }

  return { start, lock, power, seed };
})();

window.addEventListener('DOMContentLoaded', Boot.start);
