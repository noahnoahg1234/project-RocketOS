/* RocketOS desktop widgets: clock, calendar, weather, system monitor, sticky note, to-do. Draggable; positions persist. */
const Widgets = (() => {
  const { h } = OS;
  let hidden = false;
  const timers = [];

  const defs = {
    clock: { title: 'Clock', icon: '🕰️', w: 200, build(body) {
      const c = h('canvas', { width: 180, height: 180 }); const label = h('div', { class: 'wg-sub center' });
      body.append(c, label);
      const ctx = c.getContext('2d');
      const draw = () => {
        const d = new Date(), R = 86; ctx.clearRect(0, 0, 180, 180); ctx.save(); ctx.translate(90, 90);
        ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fillStyle = '#0006'; ctx.fill(); ctx.strokeStyle = '#fff4'; ctx.lineWidth = 2; ctx.stroke();
        for (let i = 0; i < 60; i++) { ctx.rotate(Math.PI / 30); ctx.beginPath(); ctx.moveTo(0, -R + 6); ctx.lineTo(0, i % 5 === 4 ? -R + 16 : -R + 10); ctx.strokeStyle = i % 5 === 4 ? '#fff' : '#fff6'; ctx.lineWidth = i % 5 === 4 ? 3 : 1; ctx.stroke(); }
        const hand = (ang, len, w, col) => { ctx.save(); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -len); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore(); };
        const s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, hr = d.getHours() % 12 + m / 60;
        hand(hr * Math.PI / 6, 46, 6, '#fff'); hand(m * Math.PI / 30, 66, 4, '#fff'); hand(s * Math.PI / 30, 72, 2, getComputedStyle(document.documentElement).getPropertyValue('--accent'));
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
        label.textContent = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
      };
      draw(); return setInterval(draw, 200);
    } },
    calendar: { title: 'Calendar', icon: '📅', w: 230, build(body) {
      let ref = new Date(); ref.setDate(1);
      const render = () => { body.innerHTML = ''; body.append(Desktop.calendarGrid(ref, d => { ref = d; render(); })); };
      render();
    } },
    weather: { title: 'Weather', icon: '⛅', w: 220, build(body) {
      const render = async () => {
        body.innerHTML = '<div class="wg-sub">Loading…</div>';
        const w = await Weather.get(Weather.city());
        body.innerHTML = '';
        body.append(h('div', { class: 'wg-weather' }, h('div', { class: 'ww-icon' }, w.icon), h('div', {}, h('div', { class: 'ww-temp' }, Math.round(w.temp) + '°C'), h('div', { class: 'wg-sub' }, w.desc))),
          h('div', { class: 'wg-sub' }, `📍 ${w.city} · 💨 ${Math.round(w.wind)} km/h ${w.live ? '· live' : '· offline estimate'}`),
          h('div', { class: 'ww-days' }, ...w.days.map(d => h('div', {}, h('small', {}, d.day), h('div', {}, d.icon), h('small', {}, Math.round(d.max) + '°')))));
        body.querySelector('.wg-weather').addEventListener('click', () => OS.launch('weather'));
        restack();
      };
      render(); OS.on('net', render); return setInterval(render, 15 * 60 * 1000);
    } },
    sysmon: { title: 'System', icon: '📊', w: 220, build(body) {
      const cpuBar = h('div', { class: 'bar' }, h('i')), memBar = h('div', { class: 'bar' }, h('i'));
      const cpuT = h('span'), memT = h('span'), up = h('div', { class: 'wg-sub' }), net = h('div', { class: 'wg-sub' });
      body.append(h('div', { class: 'wg-stat' }, '⚙️ CPU ', cpuT), cpuBar, h('div', { class: 'wg-stat' }, '🧠 Memory ', memT), memBar, up, net);
      const upd = () => {
        const c = SysStats.cpu(), m = SysStats.mem();
        cpuT.textContent = Math.round(c) + '%'; cpuBar.firstChild.style.width = c + '%';
        memT.textContent = `${(m.used / 1024).toFixed(1)} / ${(m.total / 1024).toFixed(0)} GB`; memBar.firstChild.style.width = (m.used / m.total * 100) + '%';
        const s = Math.floor((Date.now() - OS.bootTime) / 1000);
        up.textContent = `⏱️ Uptime ${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m ${s % 60}s · ${OS.procs.length} processes`;
        net.innerHTML = NET.status().icon + ' ' + OS.esc(NET.status().text);
      };
      upd(); return setInterval(upd, 1500);
    } },
    notes: { title: 'Sticky Note', icon: '🗒️', w: 220, build(body) {
      const ta = h('textarea', { class: 'wg-note', placeholder: 'Write a note…' });
      ta.value = localStorage.getItem('rocketos.widget.note') || 'Remember: try making an app in App Maker! 🚀';
      ta.addEventListener('input', () => localStorage.setItem('rocketos.widget.note', ta.value));
      body.append(ta);
    } },
    todo: { title: 'To-Do', icon: '✅', w: 230, build(body) {
      const KEY = 'rocketos.widget.todo';
      let items; try { items = JSON.parse(localStorage.getItem(KEY)) || null; } catch { items = null; }
      items = items || [{ t: 'Explore RocketOS', d: true }, { t: 'Beat Snake high score', d: false }, { t: 'Publish an app', d: false }];
      const save = () => localStorage.setItem(KEY, JSON.stringify(items));
      const render = () => {
        body.innerHTML = '';
        items.forEach((it, i) => body.append(h('label', { class: 'wg-todo' + (it.d ? ' done' : '') }, h('input', { type: 'checkbox', checked: it.d, onchange: () => { it.d = !it.d; save(); render(); } }), h('span', {}, it.t), h('button', { class: 'x', onclick: e => { e.preventDefault(); items.splice(i, 1); save(); render(); } }, '×'))));
        const inp = h('input', { class: 'input sm', placeholder: '+ Add task' });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter' && inp.value.trim()) { items.push({ t: inp.value.trim(), d: false }); save(); render(); body.querySelector('input.input').focus(); } });
        body.append(inp);
      };
      render();
    } },
  };

  function render() {
    timers.splice(0).forEach(clearInterval);
    const layer = document.getElementById('widgets'); layer.innerHTML = '';
    layer.classList.toggle('hidden', hidden);
    const D = document.getElementById('desktop').getBoundingClientRect();
    let y = 12;
    Object.entries(defs).forEach(([id, def]) => {
      if (!OS.settings.widgets[id]) return;
      const pos = OS.settings.widgetPos[id] || { x: D.width - def.w - 16, y };
      const body = h('div', { class: 'wg-body' });
      const close = h('button', { class: 'wg-x', title: 'Remove widget' }, '×');
      const el = h('div', { class: 'widget', style: { left: Math.min(pos.x, D.width - 60) + 'px', top: Math.min(pos.y, D.height - 40) + 'px', width: def.w + 'px' } },
        h('div', { class: 'wg-head' }, h('span', {}, def.icon + ' ' + def.title), close), body);
      close.addEventListener('click', () => { OS.settings.widgets[id] = false; OS.saveSettings(); render(); });
      layer.append(el);
      const t = def.build(body); if (t) timers.push(t);
      if (!OS.settings.widgetPos[id]) el.dataset.auto = '1';
      const head = el.querySelector('.wg-head');
      head.addEventListener('pointerdown', e => {
        if (e.target === close) return;
        const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
        head.setPointerCapture(e.pointerId);
        const mv = ev => { el.style.left = ox + ev.clientX - sx + 'px'; el.style.top = Math.max(0, oy + ev.clientY - sy) + 'px'; };
        const up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); delete el.dataset.auto; OS.settings.widgetPos[id] = { x: el.offsetLeft, y: el.offsetTop }; OS.saveSettings(); };
        head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up);
      });
    });
    restack(); setTimeout(restack, 300); setTimeout(restack, 1500);
  }
  /** Stack widgets that have no saved position in a column on the right (re-run when async content changes size). */
  function restack() {
    const D = document.getElementById('desktop').getBoundingClientRect();
    let y = 12;
    document.querySelectorAll('#widgets .widget[data-auto]').forEach(el => { el.style.top = y + 'px'; el.style.left = (D.width - el.offsetWidth - 16) + 'px'; y += el.offsetHeight + 12; });
  }
  function toggleLayer() { hidden = !hidden; document.getElementById('widgets').classList.toggle('hidden', hidden); }
  return { render, toggleLayer, restack, defs, get hidden() { return hidden; } };
})();

/* ---------- Weather service: live data from open-meteo when online, deterministic estimate otherwise */
const Weather = (() => {
  const cities = { 'New York': [40.71, -74.01], London: [51.51, -0.13], Tokyo: [35.68, 139.69], Paris: [48.86, 2.35], Sydney: [-33.87, 151.21], 'Los Angeles': [34.05, -118.24], Berlin: [52.52, 13.4], Toronto: [43.65, -79.38], Mumbai: [19.08, 72.88], 'Cape Canaveral': [28.39, -80.6] };
  const codes = c => c === 0 ? ['☀️', 'Clear sky'] : c <= 2 ? ['🌤️', 'Partly cloudy'] : c === 3 ? ['☁️', 'Overcast'] : c <= 48 ? ['🌫️', 'Fog'] : c <= 57 ? ['🌦️', 'Drizzle'] : c <= 67 ? ['🌧️', 'Rain'] : c <= 77 ? ['❄️', 'Snow'] : c <= 82 ? ['🌧️', 'Showers'] : ['⛈️', 'Thunderstorm'];
  const cache = {};
  const city = () => OS.settings.weatherCity || 'Cape Canaveral';
  async function get(name) {
    const key = name + new Date().getHours();
    if (cache[key]) return cache[key];
    const [lat, lon] = cities[name] || cities['Cape Canaveral'];
    if (NET.online()) {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`);
        const j = await r.json();
        const [icon, desc] = codes(j.current.weather_code);
        return cache[key] = { city: name, temp: j.current.temperature_2m, wind: j.current.wind_speed_10m, humidity: j.current.relative_humidity_2m, icon, desc, live: true,
          days: j.daily.time.map((t, i) => ({ day: new Date(t + 'T12:00').toLocaleDateString([], { weekday: 'short' }), icon: codes(j.daily.weather_code[i])[0], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i] })) };
      } catch (e) { /* fall through to estimate */ }
    }
    // offline estimate: seasonal + latitude based, deterministic per day
    const d = new Date(), doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    const season = Math.cos((doy - 196) / 365 * 2 * Math.PI) * (lat >= 0 ? 1 : -1);
    const base = 27 - Math.abs(lat) * 0.38 + season * 9;
    const rnd = n => { const x = Math.sin(n * 9301 + lat * 49297) * 233280; return x - Math.floor(x); };
    const pick = n => [0, 1, 2, 3, 61, 80][Math.floor(rnd(n) * 6)];
    const [icon, desc] = codes(pick(doy));
    return cache[key] = { city: name, temp: base + (rnd(doy) - 0.5) * 6, wind: 5 + rnd(doy + 1) * 20, humidity: 40 + rnd(doy + 2) * 50, icon, desc, live: false,
      days: [0, 1, 2, 3, 4].map(k => { const dd = new Date(Date.now() + k * 864e5); return { day: dd.toLocaleDateString([], { weekday: 'short' }), icon: codes(pick(doy + k))[0], max: base + 3 + (rnd(doy + k) - 0.5) * 6, min: base - 5 + (rnd(doy + k + 7) - 0.5) * 4 }; }) };
  }
  return { get, cities, city };
})();
