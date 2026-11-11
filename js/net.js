/* RocketOS networking: Wi-Fi manager (simulated radios) layered on top of the browser's real connectivity. */
const NET = (() => {
  const networks = [
    { ssid: 'RocketNet-5G', security: 'WPA3', password: 'rocket123', base: 92, band: '5 GHz' },
    { ssid: 'Starlink-Orbit', security: 'WPA2', password: 'orbit2026', base: 74, band: '5 GHz' },
    { ssid: 'CoffeeShop_Free', security: 'Open', password: '', base: 58, band: '2.4 GHz' },
    { ssid: 'Library-Guest', security: 'Open', password: '', base: 41, band: '2.4 GHz' },
    { ssid: 'NeighborNet', security: 'WPA2', password: 'hunter2', base: 33, band: '2.4 GHz' },
    { ssid: 'LaunchPad_IoT', security: 'WPA2', password: 'iot-pad-77', base: 22, band: '2.4 GHz' },
  ];
  const state = () => OS.settings.wifi;
  let scanning = false;

  function signal(n) { return Math.max(5, Math.min(100, Math.round(n.base + (Math.sin(Date.now() / 7000 + n.base) * 6)))); }
  function bars(sig) { return sig > 75 ? 4 : sig > 50 ? 3 : sig > 25 ? 2 : 1; }
  function scan() {
    if (!state().enabled) return [];
    return networks.map(n => ({ ssid: n.ssid, security: n.security, band: n.band, signal: signal(n), known: !!state().known[n.ssid], connected: state().connected === n.ssid }))
      .sort((a, b) => b.signal - a.signal);
  }
  function current() { return state().enabled ? networks.find(n => n.ssid === state().connected) || null : null; }
  /** Online inside RocketOS = Wi-Fi connected AND the real browser is online. */
  function online() { return !!current() && navigator.onLine; }
  function status() {
    const c = current();
    if (!state().enabled) return { text: 'Wi-Fi off', icon: wifiIcon(0, true) };
    if (!c) return { text: 'Not connected', icon: wifiIcon(0) };
    const s = signal(c);
    return { text: c.ssid + (navigator.onLine ? '' : ' (no internet)'), icon: wifiIcon(bars(s)), signal: s, ssid: c.ssid };
  }
  function wifiIcon(level, off = false) {
    const op = i => (off ? 0.25 : i <= level ? 1 : 0.25);
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
      <path d="M2 8.5a15 15 0 0 1 20 0" opacity="${op(4)}"/><path d="M5 12a10.5 10.5 0 0 1 14 0" opacity="${op(3)}"/>
      <path d="M8.5 15.5a5.5 5.5 0 0 1 7 0" opacity="${op(2)}"/><circle cx="12" cy="19" r="1.3" fill="currentColor" opacity="${op(1)}"/>
      ${off ? '<path d="M3 3l18 18" opacity="1"/>' : ''}</svg>`;
  }

  async function connect(ssid, password) {
    const n = networks.find(x => x.ssid.toLowerCase() === String(ssid).toLowerCase());
    if (!n) throw new Error(`Network “${ssid}” not found`);
    if (!state().enabled) throw new Error('Wi-Fi is turned off');
    const pw = password != null ? password : state().known[n.ssid];
    if (n.security !== 'Open' && pw !== n.password) {
      await wait(900);
      throw new Error('Authentication failed — wrong password');
    }
    OS.emit('net', { connecting: n.ssid });
    await wait(700 + Math.random() * 600);
    state().connected = n.ssid;
    if (n.security !== 'Open') state().known[n.ssid] = pw;
    OS.saveSettings(); OS.emit('net', status());
    OS.log(`wifi: connected to ${n.ssid}`);
    return n.ssid;
  }
  function disconnect() { state().connected = null; OS.saveSettings(); OS.emit('net', status()); OS.log('wifi: disconnected'); }
  function forget(ssid) { delete state().known[ssid]; if (state().connected === ssid) state().connected = null; OS.saveSettings(); OS.emit('net', status()); }
  function setEnabled(v) { state().enabled = !!v; if (!v) state().connected = state().connected; OS.saveSettings(); OS.emit('net', status()); }
  function info() {
    const c = current();
    return { ip: c ? '192.168.' + (c.base % 10) + '.' + (40 + c.base) : null, gateway: c ? '192.168.' + (c.base % 10) + '.1' : null, mac: 'a4:c3:f0:52:9e:1b', dns: '1.1.1.1', ssid: c && c.ssid, band: c && c.band, security: c && c.security };
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  addEventListener('online', () => { OS.emit('net', status()); OS.notify('Network', 'Internet connection restored.', '🌐'); });
  addEventListener('offline', () => { OS.emit('net', status()); OS.notify('Network', 'Internet connection lost.', '📵'); });
  setInterval(() => OS.emit('net-tick', status()), 5000);

  return { scan, connect, disconnect, forget, setEnabled, status, current, online, info, wifiIcon, signal, bars, get scanning() { return scanning; } };
})();
