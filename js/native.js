/* RocketOS native bridge.
 * When RocketOS runs as a real operating system, rocket-shell injects window.ROCKET_NATIVE = {token}
 * and rocketd (on 127.0.0.1) gives access to the machine. This file swaps the simulated parts of the
 * web version for the real thing: Wi-Fi (NetworkManager), power off / reboot, CPU / memory / battery,
 * volume, and a `linux` terminal command. In a normal browser it does nothing. */
const Native = (() => {
  const cfg = window.ROCKET_NATIVE;
  const state = { on: false, net: null, sys: null, kernel: null };
  if (!cfg || !cfg.token) return { on: false, state };

  async function api(path, body) {
    const r = await fetch('/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: Object.assign({ 'X-Rocket-Token': cfg.token }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`rocketd: ${r.status}`);
    return r.json();
  }

  // ------------------------------------------------------------ Wi-Fi via NetworkManager
  let netBusy = false, lastRescan = 0;
  async function refreshNet(rescan = false) {
    if (netBusy) return; netBusy = true;
    try {
      state.net = await api('net' + (rescan ? '?rescan=1' : ''));
      if (rescan) lastRescan = Date.now();
      OS.settings.wifi.enabled = state.net.enabled;
      OS.emit('net', NET.status());
    } catch (e) { console.warn('net refresh failed', e); }
    finally { netBusy = false; }
  }
  const netInfo = () => state.net || { enabled: false, networks: [], connected: null, online: false, hasWifi: false };
  function patchNet() {
    NET.scan = () => {
      if (Date.now() - lastRescan > 20000) refreshNet(true);
      const n = netInfo();
      return n.enabled ? n.networks.map(x => Object.assign({}, x)) : [];
    };
    NET.current = () => { const c = netInfo().connected; return c ? Object.assign({ base: c.signal }, c) : null; };
    NET.online = () => !!netInfo().online;
    NET.signal = n => (n && (n.signal ?? n.base)) || 0;
    NET.status = () => {
      const n = netInfo(), c = n.connected;
      if (c && c.type === 'ethernet') return { text: 'Ethernet' + (n.online ? '' : ' (no internet)'), icon: ethIcon(), signal: 100, ssid: c.ssid };
      if (!n.enabled) return { text: n.hasWifi ? 'Wi-Fi off' : 'No Wi-Fi adapter', icon: NET.wifiIcon(0, true) };
      if (!c) return { text: 'Not connected', icon: NET.wifiIcon(0) };
      return { text: c.ssid + (n.online ? '' : ' (no internet)'), icon: NET.wifiIcon(NET.bars(c.signal)), signal: c.signal, ssid: c.ssid };
    };
    NET.info = () => { const c = netInfo().connected || {}; return { ip: c.ip || null, gateway: c.gateway || null, mac: c.mac || '—', dns: c.dns || '—', ssid: c.ssid, band: c.band, security: c.security }; };
    NET.connect = async (ssid, password) => {
      OS.emit('net', { connecting: ssid });
      const r = await api('net/connect', { ssid, password: password ?? null });
      await refreshNet();
      if (!r.ok) throw new Error((r.error || 'Could not connect').replace(/^Error: /, ''));
      OS.log(`wifi: connected to ${ssid}`);
      return ssid;
    };
    NET.disconnect = async () => { await api('net/disconnect', {}); refreshNet(); };
    NET.forget = async ssid => { await api('net/forget', { ssid }); refreshNet(); };
    NET.setEnabled = async v => { OS.settings.wifi.enabled = !!v; OS.emit('net', NET.status()); await api('net/radio', { enabled: !!v }); setTimeout(() => refreshNet(true), 1500); };
  }
  const ethIcon = () => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="9" width="16" height="10" rx="2"/><path d="M8 9V6h8v3M8 14h.01M12 14h.01M16 14h.01"/></svg>`;

  // ------------------------------------------------------------ system stats, battery, volume
  async function refreshSys() {
    try {
      state.sys = await api('sys');
      const b = state.sys.battery;
      if (b && typeof Battery !== 'undefined' && Battery.set) Battery.set((b.charging ? '⚡' : b.level < 20 ? '🪫' : '🔋') + b.level + '%');
    } catch (e) { console.warn('sys refresh failed', e); }
  }
  function patchSys() {
    SysStats.cpu = () => (state.sys ? state.sys.cpu : 0);
    SysStats.mem = () => (state.sys ? { total: state.sys.memTotal, used: state.sys.memUsed } : { total: 0, used: 0 });
    let lastVol = OS.settings.volume, t;
    OS.on('settings', s => { if (s.volume !== lastVol) { lastVol = s.volume; clearTimeout(t); t = setTimeout(() => api('volume', { level: s.volume }).catch(() => {}), 200); } });
  }

  // ------------------------------------------------------------ terminal: run real Linux commands
  function patchShell() {
    Shell.CMDS.linux = { help: 'Run a real Linux command on this machine', usage: 'linux <command>   e.g. linux uname -a, linux ip addr', fn: async ctx => {
      if (!ctx.args.length) throw new Error('usage: linux <command>');
      const r = await api('exec', { cmd: ctx.args.map(a => /^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`).join(' ') });
      if (r.out) ctx.out(r.out + '\n');
      return r.code;
    } };
    Shell.CMDS.poweroff = { help: 'Power off the computer', fn: () => power('shutdown') };
  }

  async function power(mode) {
    try { await api('power', { action: mode === 'restart' ? 'reboot' : mode }); }
    catch (e) { OS.alert('Could not ' + mode + ': ' + e.message, 'Power', '⚠️'); }
  }

  // ------------------------------------------------------------ real browser views (provided by rocket-shell)
  const features = cfg.features || [];
  const handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.rocket;
  const browserListeners = {};
  const browser = features.includes('browser') && handler ? {
    post: msg => handler.postMessage(JSON.stringify(msg)),
    on: (id, fn) => { browserListeners[id] = fn; },
    off: id => { delete browserListeners[id]; },
  } : null;
  window.__rocketNative = {
    event(ev) {
      if (ev.type === 'download') {
        if (ev.error) OS.notify('Download failed', ev.error, '⚠️');
        else OS.notify('Download complete', ev.path.split('/').pop() + ' saved to ~/Downloads (Linux)', '📥');
        return;
      }
      const fn = browserListeners[ev.id]; if (fn) fn(ev);
    },
  };

  // ------------------------------------------------------------ programs in C, Python, Rust… (App Maker / .esl runtime)
  let langCache = null;
  const programs = {
    langs: async () => langCache || (langCache = await api('langs')),
    /** Start a program. Returns {id, poll(onOutput) -> Promise<exitCode>, write(text), kill()} */
    async start(lang, code) {
      const r = await fetch('/api/proc/start', { method: 'POST', headers: { 'X-Rocket-Token': cfg.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, code }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'could not start');
      let since = 0, stopped = false;
      return {
        id: j.id,
        async poll(onOutput) {
          while (!stopped) {
            const st = await api(`proc/read?id=${j.id}&since=${since}`);
            if (st.out) onOutput(st.out.replace(/\r\n/g, '\n'));
            since = st.next;
            if (st.done) return st.code;
            await new Promise(res => setTimeout(res, st.out ? 30 : 120));
          }
          return null;
        },
        write: text => api('proc/write', { id: j.id, data: text }).catch(() => {}),
        kill: () => { api('proc/kill', { id: j.id }).catch(() => {}); },
        stop: () => { stopped = true; },
      };
    },
  };

  async function init() {
    try {
      const p = await api('ping');
      state.on = true; state.kernel = p.kernel;
      OS.kernel = `Linux ${p.kernel}`;
      OS.native = true;
      document.documentElement.dataset.native = '1';
      patchNet(); patchSys(); patchShell();
      await Promise.all([refreshNet(true), refreshSys()]);
      setInterval(() => refreshNet(false), 5000);
      setInterval(refreshSys, 2000);
      OS.log(`native: rocketd ${p.version} on ${OS.kernel}`);
    } catch (e) { console.warn('RocketOS native bridge unavailable:', e); }
  }
  init();
  return { get on() { return state.on; }, state, api, power, browser, programs };
})();
