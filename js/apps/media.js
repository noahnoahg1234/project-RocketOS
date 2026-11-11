/* Media apps: Paint, Rocket Tunes (synth + music player), Camera-free Sound Recorder alternative: Soundboard */
(() => {
  const { h } = OS;

  // ------------------------------------------------ Paint
  OS.registerApp({ id: 'paint', name: 'Paint', icon: '🎨', category: 'Media', width: 820, height: 560, desc: 'Draw and save pictures',
    launch(win, args = {}) {
      let tool = 'brush', color = '#ff6b35', size = 6, drawing = false, sx = 0, sy = 0, snapshot = null, path = args.path || null;
      const undo = [];
      const cv = h('canvas', { class: 'paint-canvas', width: 1000, height: 640 });
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      const tools = [['brush', '🖌️'], ['pencil', '✏️'], ['eraser', '🧽'], ['line', '📏'], ['rect', '▭'], ['circle', '◯'], ['fill', '🪣'], ['picker', '💧'], ['spray', '💨'], ['text', '🔤']];
      const tb = h('div', { class: 'paint-tools' });
      const renderTools = () => { tb.innerHTML = ''; tools.forEach(([t, i]) => tb.append(h('button', { class: 'ptool' + (tool === t ? ' on' : ''), title: t, onclick: () => { tool = t; renderTools(); } }, i))); };
      renderTools();
      const palette = ['#000000', '#ffffff', '#7f7f7f', '#c3c3c3', '#ff0000', '#ff6b35', '#ffd700', '#22c55e', '#00bcd4', '#3b82f6', '#8b5cf6', '#ec4899', '#8b4513', '#14532d'];
      const colorIn = h('input', { type: 'color', value: color, oninput: e => color = e.target.value });
      const pal = h('div', { class: 'paint-pal' }, colorIn, ...palette.map(c => h('button', { class: 'swatch', style: { background: c }, onclick: () => { color = c; colorIn.value = c; } })));
      const sizeIn = h('input', { type: 'range', min: 1, max: 60, value: size, oninput: e => size = +e.target.value });
      const bar = h('div', { class: 'paint-bar' }, h('button', { class: 'btn sm', onclick: () => newImg() }, '📄 New'), h('button', { class: 'btn sm', onclick: () => open() }, '📂 Open'), h('button', { class: 'btn sm', onclick: () => save() }, '💾 Save'), h('button', { class: 'btn sm', onclick: () => doUndo() }, '↶ Undo'), h('button', { class: 'btn sm', onclick: () => download() }, '⬇️ Export PNG'), 'Size', sizeIn, pal);
      win.body.append(h('div', { class: 'paint' }, bar, h('div', { class: 'paint-main' }, tb, h('div', { class: 'paint-area' }, cv))));
      const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
      const push = () => { undo.push(ctx.getImageData(0, 0, cv.width, cv.height)); if (undo.length > 30) undo.shift(); };
      const doUndo = () => { if (undo.length) ctx.putImageData(undo.pop(), 0, 0); };
      cv.addEventListener('pointerdown', async e => {
        const [x, y] = pos(e); push();
        if (tool === 'fill') return flood(Math.floor(x), Math.floor(y));
        if (tool === 'picker') { const d = ctx.getImageData(x, y, 1, 1).data; color = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join(''); colorIn.value = color; tool = 'brush'; renderTools(); return; }
        if (tool === 'text') { const t = await OS.prompt('Text:', '', 'Paint'); if (t) { ctx.fillStyle = color; ctx.font = `${size * 3 + 10}px sans-serif`; ctx.fillText(t, x, y); } return; }
        drawing = true; sx = x; sy = y; snapshot = ctx.getImageData(0, 0, cv.width, cv.height);
        cv.setPointerCapture(e.pointerId);
        ctx.beginPath(); ctx.moveTo(x, y);
        if (['brush', 'pencil', 'eraser'].includes(tool)) { ctx.lineTo(x + 0.1, y); stroke(); }
      });
      const stroke = () => { ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color; ctx.lineWidth = tool === 'pencil' ? 1 : tool === 'eraser' ? size * 2 : size; ctx.stroke(); };
      cv.addEventListener('pointermove', e => {
        if (!drawing) return; const [x, y] = pos(e);
        if (['brush', 'pencil', 'eraser'].includes(tool)) { ctx.lineTo(x, y); stroke(); }
        else if (tool === 'spray') { ctx.fillStyle = color; for (let i = 0; i < size * 2; i++) { const a = Math.random() * 6.28, r = Math.random() * size * 2; ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.5, 1.5); } }
        else { ctx.putImageData(snapshot, 0, 0); ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = size;
          if (tool === 'line') { ctx.moveTo(sx, sy); ctx.lineTo(x, y); }
          if (tool === 'rect') ctx.rect(sx, sy, x - sx, y - sy);
          if (tool === 'circle') ctx.ellipse((sx + x) / 2, (sy + y) / 2, Math.abs(x - sx) / 2, Math.abs(y - sy) / 2, 0, 0, 7);
          e.shiftKey ? (ctx.fillStyle = color, ctx.fill()) : ctx.stroke(); }
      });
      cv.addEventListener('pointerup', () => drawing = false);
      function flood(x, y) {
        const img = ctx.getImageData(0, 0, cv.width, cv.height), d = img.data, W = cv.width, H = cv.height;
        const i0 = (y * W + x) * 4, t = [d[i0], d[i0 + 1], d[i0 + 2]];
        const c = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
        if (t.every((v, k) => Math.abs(v - c[k]) < 3)) return;
        const match = i => Math.abs(d[i] - t[0]) < 32 && Math.abs(d[i + 1] - t[1]) < 32 && Math.abs(d[i + 2] - t[2]) < 32;
        const stack = [[x, y]];
        while (stack.length) { const [px, py] = stack.pop(); if (px < 0 || py < 0 || px >= W || py >= H) continue; const i = (py * W + px) * 4; if (!match(i)) continue; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]); }
        ctx.putImageData(img, 0, 0);
      }
      function newImg() { push(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); path = null; win.setTitle('Paint'); }
      async function save() {
        if (!path) { const p = await OS.prompt('Save picture as:', VFS.home() + '/Pictures/drawing.png', 'Paint', { icon: '💾' }); if (!p) return; path = VFS.normalize(p.endsWith('.png') ? p : p + '.png', VFS.home()); }
        try { VFS.write(path, cv.toDataURL('image/png')); OS.notify('Paint', 'Saved ' + VFS.basename(path), '🎨'); win.setTitle('Paint — ' + VFS.basename(path)); } catch (e) { OS.alert(e.message); }
      }
      async function open(p) {
        if (!p) { p = await OS.prompt('Open picture:', VFS.home() + '/Pictures/', 'Paint'); if (!p) return; p = VFS.normalize(p, VFS.home()); }
        const img = new Image(); img.onload = () => { push(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0); path = p; win.setTitle('Paint — ' + VFS.basename(p)); }; img.src = VFS.read(p);
      }
      function download() { h('a', { href: cv.toDataURL('image/png'), download: path ? VFS.basename(path) : 'drawing.png' }).click(); }
      if (path) open(path);
    } });

  // ------------------------------------------------ Rocket Tunes: piano synth + song player + drum pads
  OS.registerApp({ id: 'tunes', name: 'Rocket Tunes', icon: '🎹', category: 'Media', width: 720, height: 430, desc: 'Piano synthesizer, drum pads and a music player',
    launch(win) {
      const ac = OS.Sound.ctx(); if (ac && ac.state === 'suspended') ac.resume();
      let wave = 'triangle', octave = 4, playing = null;
      const note = (n, oct = octave, dur = 0.5, when = 0, w = wave) => { const f = 440 * Math.pow(2, (n - 9) / 12 + (oct - 4)); OS.Sound.tone(f, dur, w, 0.18, when); return f; };
      const keys = 'awsedftgyhujkolp;'; // white+black mapping across ~1.5 octaves
      const piano = h('div', { class: 'piano' });
      const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E'];
      names.forEach((n, i) => {
        const black = n.includes('#');
        const k = h('div', { class: 'pkey' + (black ? ' black' : ''), 'data-i': i }, h('small', {}, keys[i].toUpperCase()));
        k.addEventListener('pointerdown', () => { note(i % 12, octave + Math.floor(i / 12)); flash(k); });
        piano.append(k);
      });
      const flash = k => { k.classList.add('down'); setTimeout(() => k.classList.remove('down'), 150); };
      const waveSel = h('select', { class: 'input sm', onchange: e => wave = e.target.value }, ...['triangle', 'sine', 'square', 'sawtooth'].map(w => h('option', {}, w)));
      const octLbl = h('b', {}, octave);
      const drums = h('div', { class: 'drums' }, ...[['Kick', () => drum(60, 0.3)], ['Snare', () => noise(0.15)], ['Hat', () => noise(0.04, 8000)], ['Clap', () => { noise(0.05); noise(0.05, 0, 0.03); }], ['Tom', () => drum(140, 0.25)], ['Zap', () => { const c = OS.Sound.ctx(); const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(1600, c.currentTime); o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.3); g.gain.setValueAtTime(0.15 * OS.settings.volume / 100, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.3); }]].map(([n, f]) => h('button', { class: 'pad-btn', onclick: f }, n)));
      function drum(f, d) { const c = OS.Sound.ctx(); const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(f, c.currentTime); o.frequency.exponentialRampToValueAtTime(30, c.currentTime + d); g.gain.setValueAtTime(0.5 * OS.settings.volume / 100, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + d); }
      function noise(d, hp = 0, when = 0) { const c = OS.Sound.ctx(); const b = c.createBuffer(1, c.sampleRate * d, c.sampleRate); const data = b.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; const g = c.createGain(); g.gain.value = 0.3 * OS.settings.volume / 100; let node = s; if (hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; s.connect(f); node = f; } node.connect(g).connect(c.destination); s.start(c.currentTime + when); }
      // original melodies (note index, beats)
      const songs = {
        'Liftoff Theme': [[0, 1], [4, 1], [7, 1], [12, 2], [11, 1], [7, 1], [9, 2], [7, 1], [4, 1], [5, 1], [7, 3]],
        'Orbit Waltz': [[7, 1], [4, .5], [4, .5], [5, 1], [2, .5], [2, .5], [0, 1], [2, 1], [4, 1], [5, 1], [7, 1], [7, 1], [7, 2]],
        'Moon Lullaby': [[4, 1], [2, 1], [0, 1], [2, 1], [4, 1], [4, 1], [4, 2], [2, 1], [2, 1], [2, 2], [4, 1], [7, 1], [7, 2]],
        'Starfield Run': [[0, .5], [7, .5], [12, .5], [7, .5], [3, .5], [10, .5], [15, .5], [10, .5], [5, .5], [12, .5], [17, .5], [12, .5], [7, 1], [12, 2]],
      };
      const list = h('div', { class: 'songs' });
      Object.entries(songs).forEach(([name, seq]) => list.append(h('div', { class: 'song' }, h('span', {}, '🎵 ' + name), h('button', { class: 'btn sm', onclick: () => play(seq) }, '▶'))));
      list.append(h('button', { class: 'btn sm', onclick: () => { clearTimeout(playing); playing = null; } }, '⏹ Stop'));
      function play(seq, i = 0, bpm = 140) { clearTimeout(playing); if (i >= seq.length) return; const [n, b] = seq[i]; const dur = 60 / bpm * b; note(n % 12, octave + Math.floor(n / 12), dur * 0.95); const k = piano.querySelector(`[data-i="${n % 17}"]`); if (k) flash(k); playing = setTimeout(() => play(seq, i + 1, bpm), dur * 1000); }
      win.body.append(h('div', { class: 'tunes' },
        h('div', { class: 'row' }, 'Wave', waveSel, 'Octave', h('button', { class: 'btn sm', onclick: () => { octave = Math.max(1, octave - 1); octLbl.textContent = octave; } }, '−'), octLbl, h('button', { class: 'btn sm', onclick: () => { octave = Math.min(7, octave + 1); octLbl.textContent = octave; } }, '+'), h('span', { class: 'muted small' }, 'Play with your keyboard: A W S E D F T G Y H U J K O L P ;')),
        piano, h('div', { class: 'tunes-bottom' }, drums, list)));
      win.body.tabIndex = 0; win.body.focus();
      win.body.addEventListener('keydown', e => { if (e.repeat) return; const i = keys.indexOf(e.key.toLowerCase()); if (i >= 0) { note(i % 12, octave + Math.floor(i / 12)); flash(piano.children[i]); } });
      win.onClose(() => clearTimeout(playing));
    } });
})();
