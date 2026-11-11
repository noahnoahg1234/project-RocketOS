/* Arcade games: Snake, Block Drop, Paddle Duel, Brick Smash, Rocket Hop, Star Blaster */
const GameKit = (() => {
  const { h } = OS;
  function hi(id, score) {
    const k = 'rocketos.hi.' + id, best = +(localStorage.getItem(k) || 0);
    if (score != null && score > best) { localStorage.setItem(k, score); return score; }
    return best;
  }
  /** Sets up a canvas game in a window. Returns {cv, ctx, keys, setHud, overlay, loop, onKey}. */
  function setup(win, W, H, id) {
    const cv = h('canvas', { class: 'game-canvas', width: W, height: H });
    const hud = h('div', { class: 'game-hud' });
    const ov = h('div', { class: 'game-overlay' });
    const wrap = h('div', { class: 'game', tabindex: 0 }, hud, h('div', { class: 'game-stage' }, cv, ov));
    win.body.append(wrap);
    const keys = {}; const keyFns = [];
    wrap.addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault(); keys[e.key] = true; keyFns.forEach(f => f(e)); });
    wrap.addEventListener('keyup', e => keys[e.key] = false);
    wrap.addEventListener('pointerdown', () => wrap.focus());
    setTimeout(() => wrap.focus(), 50);
    let raf = 0, last = 0, running = false;
    const api = {
      cv, ctx: cv.getContext('2d'), keys, wrap,
      setHud(html) { hud.innerHTML = html + `<span class="hi">🏆 Best ${hi(id)}</span>`; },
      overlay(title, sub, btn, cb) {
        if (!title) { ov.classList.remove('show'); return; }
        ov.innerHTML = ''; ov.append(h('h2', {}, title), sub ? h('p', {}, sub) : '', btn ? h('button', { class: 'btn primary', onclick: () => { ov.classList.remove('show'); wrap.focus(); cb && cb(); } }, btn) : '');
        ov.classList.add('show');
      },
      get overlayShown() { return ov.classList.contains('show'); },
      onKey(f) { keyFns.push(f); },
      loop(fn) { running = true; last = performance.now(); const step = t => { if (!running) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; fn(dt); raf = requestAnimationFrame(step); }; cancelAnimationFrame(raf); raf = requestAnimationFrame(step); },
      stop() { running = false; cancelAnimationFrame(raf); },
      hi: s => hi(id, s),
      pos(e) { const r = cv.getBoundingClientRect(); const sc = Math.min(r.width / W, r.height / H); const ox = (r.width - W * sc) / 2, oy = (r.height - H * sc) / 2; return [(e.clientX - r.left - ox) / sc, (e.clientY - r.top - oy) / sc]; },
    };
    win.onClose(() => api.stop());
    return api;
  }
  const beep = (f, d = 0.05, t = 'square') => OS.Sound.tone(f, d, t, 0.06);
  return { setup, hi, beep };
})();

// ------------------------------------------------------------------ Snake
OS.registerApp({ id: 'snake', name: 'Snake', icon: '🐍', category: 'Games', width: 520, height: 470, desc: 'Eat apples, grow longer, don’t bite yourself',
  launch(win) {
    const C = 20, GW = 25, GH = 19, g = GameKit.setup(win, GW * C, GH * C, 'snake'), x = g.ctx;
    let snake, dir, next, food, score, speed, acc, alive = false, bonus = null;
    const place = () => { let p; do p = { x: Math.floor(Math.random() * GW), y: Math.floor(Math.random() * GH) }; while (snake.some(s => s.x === p.x && s.y === p.y)); return p; };
    const reset = () => { snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }]; dir = next = { x: 1, y: 0 }; food = place(); score = 0; speed = 8; acc = 0; alive = true; bonus = null; hud(); };
    const hud = () => g.setHud(`<span>🍎 Score <b>${score}</b></span><span>⚡ Speed ${speed.toFixed(0)}</span>`);
    g.onKey(e => { const k = e.key.toLowerCase(); const d = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] }[k]; if (d && (d[0] !== -dir.x || d[1] !== -dir.y)) next = { x: d[0], y: d[1] }; if (k === ' ' && !alive && g.overlayShown) { g.overlay(); start(); } if (k === 'p' && alive) paused = !paused; });
    let paused = false;
    function tick() {
      dir = next; const head = { x: (snake[0].x + dir.x + GW) % GW, y: (snake[0].y + dir.y + GH) % GH };
      if (snake.some(s => s.x === head.x && s.y === head.y)) { alive = false; GameKit.beep(110, 0.4); g.hi(score); g.overlay('Game over', `Score: ${score} · Best: ${g.hi()}`, 'Play again', start); hud(); return; }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) { score += 10; speed = Math.min(22, speed + 0.4); food = place(); GameKit.beep(880); if (Math.random() < 0.25) bonus = { ...place(), t: 6 }; hud(); }
      else if (bonus && head.x === bonus.x && head.y === bonus.y) { score += 50; bonus = null; GameKit.beep(1320, 0.1); hud(); }
      else snake.pop();
    }
    function draw() {
      x.fillStyle = '#0d1b12'; x.fillRect(0, 0, GW * C, GH * C);
      x.fillStyle = '#12261a'; for (let i = 0; i < GW; i++) for (let j = 0; j < GH; j++) if ((i + j) % 2) x.fillRect(i * C, j * C, C, C);
      x.font = '17px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('🍎', food.x * C + C / 2, food.y * C + C / 2 + 1);
      if (bonus) x.fillText('⭐', bonus.x * C + C / 2, bonus.y * C + C / 2 + 1);
      snake.forEach((s, i) => { x.fillStyle = i === 0 ? '#7dff9a' : `hsl(${140 - i * 2}, 70%, ${55 - Math.min(25, i)}%)`; x.beginPath(); x.roundRect(s.x * C + 1, s.y * C + 1, C - 2, C - 2, 5); x.fill(); });
      const hd = snake[0]; x.fillStyle = '#000'; x.fillRect(hd.x * C + C / 2 + dir.x * 4 - 2 + dir.y * 4, hd.y * C + C / 2 + dir.y * 4 - 2 + dir.x * 4, 3, 3); x.fillRect(hd.x * C + C / 2 + dir.x * 4 - 2 - dir.y * 4, hd.y * C + C / 2 + dir.y * 4 - 2 - dir.x * 4, 3, 3);
      if (paused) { x.fillStyle = '#0008'; x.fillRect(0, 0, GW * C, GH * C); x.fillStyle = '#fff'; x.font = 'bold 28px sans-serif'; x.fillText('Paused', GW * C / 2, GH * C / 2); }
    }
    function start() { reset(); g.loop(dt => { if (alive && !paused) { acc += dt; while (acc > 1 / speed && alive) { acc -= 1 / speed; tick(); } if (bonus && (bonus.t -= dt) <= 0) bonus = null; } draw(); }); }
    reset(); draw(); g.overlay('🐍 Snake', 'Arrows / WASD to steer · P to pause · ⭐ = bonus', 'Start', start);
  } });

// ------------------------------------------------------------------ Block Drop (falling blocks puzzle)
OS.registerApp({ id: 'blockdrop', name: 'Block Drop', icon: '🧱', category: 'Games', width: 420, height: 560, desc: 'Fit the falling blocks and clear lines',
  launch(win) {
    const C = 24, COLS = 10, ROWS = 20, W = COLS * C + 150, H = ROWS * C, g = GameKit.setup(win, W, H, 'blockdrop'), x = g.ctx;
    const SH = { I: [[1, 1, 1, 1]], O: [[1, 1], [1, 1]], T: [[0, 1, 0], [1, 1, 1]], S: [[0, 1, 1], [1, 1, 0]], Z: [[1, 1, 0], [0, 1, 1]], J: [[1, 0, 0], [1, 1, 1]], L: [[0, 0, 1], [1, 1, 1]] };
    const COL = { I: '#22d3ee', O: '#facc15', T: '#a855f7', S: '#22c55e', Z: '#ef4444', J: '#3b82f6', L: '#f97316' };
    let board, cur, nextP, score, lines, level, acc, over = true, bag = [];
    const rand = () => { if (!bag.length) bag = Object.keys(SH).sort(() => Math.random() - 0.5); const t = bag.pop(); return { t, m: SH[t].map(r => r.slice()), x: 3, y: 0 }; };
    const fits = (m, px, py) => m.every((r, j) => r.every((v, i) => !v || (px + i >= 0 && px + i < COLS && py + j < ROWS && (py + j < 0 || !board[py + j][px + i]))));
    const rot = m => m[0].map((_, i) => m.map(r => r[i]).reverse());
    const hud = () => g.setHud(`<span>Score <b>${score}</b></span><span>Lines ${lines}</span><span>Level ${level}</span>`);
    function reset() { board = Array.from({ length: ROWS }, () => Array(COLS).fill(null)); bag = []; cur = rand(); nextP = rand(); score = 0; lines = 0; level = 1; acc = 0; over = false; hud(); }
    function lock() {
      cur.m.forEach((r, j) => r.forEach((v, i) => { if (v && cur.y + j >= 0) board[cur.y + j][cur.x + i] = cur.t; }));
      let cleared = 0;
      for (let j = ROWS - 1; j >= 0; j--) if (board[j].every(Boolean)) { board.splice(j, 1); board.unshift(Array(COLS).fill(null)); cleared++; j++; }
      if (cleared) { score += [0, 100, 300, 500, 800][cleared] * level; lines += cleared; level = 1 + Math.floor(lines / 10); GameKit.beep(660 + cleared * 110, 0.12); } else GameKit.beep(200, 0.03);
      cur = nextP; nextP = rand(); cur.x = Math.floor((COLS - cur.m[0].length) / 2); cur.y = 0;
      if (!fits(cur.m, cur.x, cur.y)) { over = true; g.hi(score); g.overlay('Game over', `Score ${score} · Lines ${lines} · Best ${g.hi()}`, 'Play again', start); }
      hud();
    }
    const drop = () => { if (fits(cur.m, cur.x, cur.y + 1)) cur.y++; else lock(); };
    g.onKey(e => {
      if (over) { if (e.key === ' ' && g.overlayShown) { g.overlay(); start(); } return; }
      if (e.key === 'ArrowLeft' && fits(cur.m, cur.x - 1, cur.y)) cur.x--;
      if (e.key === 'ArrowRight' && fits(cur.m, cur.x + 1, cur.y)) cur.x++;
      if (e.key === 'ArrowDown') { drop(); score++; }
      if (e.key === 'ArrowUp' || e.key === 'x') { const r = rot(cur.m); for (const k of [0, -1, 1, -2, 2]) if (fits(r, cur.x + k, cur.y)) { cur.m = r; cur.x += k; break; } }
      if (e.key === ' ') { while (fits(cur.m, cur.x, cur.y + 1)) { cur.y++; score += 2; } lock(); }
    });
    const cell = (i, j, col, a = 1) => { x.globalAlpha = a; x.fillStyle = col; x.fillRect(i * C + 1, j * C + 1, C - 2, C - 2); x.fillStyle = '#ffffff40'; x.fillRect(i * C + 1, j * C + 1, C - 2, 4); x.globalAlpha = 1; };
    function draw() {
      x.fillStyle = '#10131c'; x.fillRect(0, 0, W, H); x.fillStyle = '#171b27'; x.fillRect(0, 0, COLS * C, H);
      x.strokeStyle = '#ffffff08'; for (let i = 0; i <= COLS; i++) { x.beginPath(); x.moveTo(i * C, 0); x.lineTo(i * C, H); x.stroke(); }
      board.forEach((r, j) => r.forEach((v, i) => v && cell(i, j, COL[v])));
      if (!over) { let gy = cur.y; while (fits(cur.m, cur.x, gy + 1)) gy++; cur.m.forEach((r, j) => r.forEach((v, i) => { if (v) { cell(cur.x + i, gy + j, COL[cur.t], 0.2); cell(cur.x + i, cur.y + j, COL[cur.t]); } })); }
      x.fillStyle = '#fff'; x.font = 'bold 14px sans-serif'; x.textAlign = 'left'; x.fillText('NEXT', COLS * C + 20, 30);
      nextP.m.forEach((r, j) => r.forEach((v, i) => { if (v) { x.fillStyle = COL[nextP.t]; x.fillRect(COLS * C + 24 + i * 20, 46 + j * 20, 18, 18); } }));
      x.fillStyle = '#aab'; x.font = '12px sans-serif'; ['← → move', '↑ rotate', '↓ soft drop', 'Space hard drop'].forEach((t, i) => x.fillText(t, COLS * C + 16, 160 + i * 20));
    }
    function start() { reset(); g.loop(dt => { if (!over) { acc += dt; const sp = Math.max(0.07, 0.8 - (level - 1) * 0.07); if (acc > sp) { acc = 0; drop(); } } draw(); }); }
    reset(); over = true; draw(); g.overlay('🧱 Block Drop', 'Clear lines by filling rows. Speed rises every 10 lines.', 'Start', start);
  } });

// ------------------------------------------------------------------ Paddle Duel
OS.registerApp({ id: 'paddle', name: 'Paddle Duel', icon: '🏓', category: 'Games', width: 660, height: 470, desc: 'Classic paddle tennis against the computer',
  launch(win) {
    const W = 640, H = 400, g = GameKit.setup(win, W, H, 'paddle'), x = g.ctx;
    let p, ai, ball, sp, sa, playing = false, diff = 0.08;
    const reset = () => { p = H / 2 - 40; ai = H / 2 - 40; sp = 0; sa = 0; serve(1); };
    const serve = d => { ball = { x: W / 2, y: H / 2, vx: 280 * d, vy: (Math.random() - 0.5) * 300 }; };
    const hud = () => g.setHud(`<span>🧑 You <b>${sp}</b></span><span>🤖 CPU <b>${sa}</b></span><span>First to 7</span>`);
    g.cv.addEventListener('pointermove', e => { p = g.pos(e)[1] - 40; });
    function update(dt) {
      if (g.keys.ArrowUp || g.keys.w) p -= 420 * dt; if (g.keys.ArrowDown || g.keys.s) p += 420 * dt;
      p = Math.max(0, Math.min(H - 80, p));
      const target = ball.y - 40 + (ball.vx > 0 ? 0 : (H / 2 - ball.y) * 0.5); ai += (target - ai) * Math.min(1, diff * 60 * dt) ; ai = Math.max(0, Math.min(H - 80, ai));
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.y < 8 || ball.y > H - 8) { ball.vy *= -1; ball.y = Math.max(8, Math.min(H - 8, ball.y)); GameKit.beep(300, 0.02); }
      const hit = (px, py) => ball.y > py - 6 && ball.y < py + 86 && Math.abs(ball.x - px) < 12;
      if (ball.vx < 0 && hit(24, p)) { ball.vx = Math.abs(ball.vx) * 1.06; ball.vy += (ball.y - (p + 40)) * 6; GameKit.beep(520); }
      if (ball.vx > 0 && hit(W - 24, ai)) { ball.vx = -Math.abs(ball.vx) * 1.06; ball.vy += (ball.y - (ai + 40)) * 6; GameKit.beep(440); }
      if (ball.x < 0) { sa++; hud(); GameKit.beep(150, 0.2); serve(1); } if (ball.x > W) { sp++; hud(); GameKit.beep(990, 0.15); serve(-1); }
      if (sp >= 7 || sa >= 7) { playing = false; const won = sp > sa; if (won) g.hi(sp * 10 - sa); g.overlay(won ? '🏆 You win!' : '🤖 CPU wins', `${sp} – ${sa}`, 'Rematch', start); }
    }
    function draw() {
      x.fillStyle = '#0b1530'; x.fillRect(0, 0, W, H);
      x.setLineDash([10, 12]); x.strokeStyle = '#ffffff40'; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#ffffff20'; x.font = 'bold 80px monospace'; x.textAlign = 'center'; x.fillText(sp, W / 4, 100); x.fillText(sa, W * 3 / 4, 100);
      x.fillStyle = '#ff6b35'; x.fillRect(16, p, 12, 80); x.fillStyle = '#57c7ff'; x.fillRect(W - 28, ai, 12, 80);
      x.fillStyle = '#fff'; x.beginPath(); x.arc(ball.x, ball.y, 8, 0, 7); x.fill();
    }
    function start(level) { reset(); hud(); playing = true; g.loop(dt => { if (playing) update(dt); draw(); }); }
    reset(); hud(); draw();
    const pick = d => { diff = d; start(); };
    g.overlay('🏓 Paddle Duel', 'Mouse or ↑/↓ (W/S) to move. First to 7 wins. Keys 1/2/3 set difficulty.', 'Start', start);
    g.onKey(e => { if (e.key === '1') diff = 0.05; if (e.key === '2') diff = 0.08; if (e.key === '3') diff = 0.14; });
  } });

// ------------------------------------------------------------------ Brick Smash
OS.registerApp({ id: 'bricks', name: 'Brick Smash', icon: '🧨', category: 'Games', width: 540, height: 540, desc: 'Bounce the ball and smash every brick',
  launch(win) {
    const W = 520, H = 460, g = GameKit.setup(win, W, H, 'bricks'), x = g.ctx;
    let pad, ball, bricks, score, lives, level, stuck, playing = false, parts = [];
    const colors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
    function build() { bricks = []; const rows = Math.min(8, 4 + level); for (let r = 0; r < rows; r++) for (let c = 0; c < 10; c++) if (level < 2 || (r + c + level) % 5) bricks.push({ x: 10 + c * 50, y: 40 + r * 22, w: 46, h: 18, hp: r < level - 1 ? 2 : 1, col: colors[r % 6] }); }
    const resetBall = () => { stuck = true; ball = { x: pad.x + pad.w / 2, y: H - 40, vx: 160, vy: -300, r: 7 }; };
    const hud = () => g.setHud(`<span>Score <b>${score}</b></span><span>${'❤️'.repeat(lives)}</span><span>Level ${level}</span>`);
    function reset() { pad = { x: W / 2 - 45, w: 90 }; score = 0; lives = 3; level = 1; build(); resetBall(); hud(); }
    g.cv.addEventListener('pointermove', e => { pad.x = Math.max(0, Math.min(W - pad.w, g.pos(e)[0] - pad.w / 2)); });
    g.cv.addEventListener('pointerdown', () => { stuck = false; });
    g.onKey(e => { if (e.key === ' ') stuck = false; });
    function update(dt) {
      if (g.keys.ArrowLeft) pad.x -= 480 * dt; if (g.keys.ArrowRight) pad.x += 480 * dt; pad.x = Math.max(0, Math.min(W - pad.w, pad.x));
      if (stuck) { ball.x = pad.x + pad.w / 2; ball.y = H - 32; return; }
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.x < ball.r || ball.x > W - ball.r) { ball.vx *= -1; ball.x = Math.max(ball.r, Math.min(W - ball.r, ball.x)); }
      if (ball.y < ball.r) { ball.vy = Math.abs(ball.vy); }
      if (ball.vy > 0 && ball.y > H - 30 && ball.y < H - 16 && ball.x > pad.x - 6 && ball.x < pad.x + pad.w + 6) { const k = (ball.x - (pad.x + pad.w / 2)) / (pad.w / 2); const s = Math.hypot(ball.vx, ball.vy) * 1.01; ball.vx = s * Math.sin(k * 1.1); ball.vy = -s * Math.cos(k * 1.1); GameKit.beep(400); }
      if (ball.y > H + 10) { lives--; GameKit.beep(120, 0.3); hud(); if (lives <= 0) { playing = false; g.hi(score); g.overlay('Game over', `Score ${score} · Best ${g.hi()}`, 'Play again', start); } else resetBall(); }
      for (const b of bricks) {
        if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
          const ox = Math.min(ball.x + ball.r - b.x, b.x + b.w - ball.x + ball.r), oy = Math.min(ball.y + ball.r - b.y, b.y + b.h - ball.y + ball.r);
          if (ox < oy) ball.vx *= -1; else ball.vy *= -1;
          if (--b.hp <= 0) { b.dead = true; score += 10 * level; for (let i = 0; i < 8; i++) parts.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, t: 0.6, col: b.col }); }
          GameKit.beep(700 + Math.random() * 200, 0.03); hud(); break;
        }
      }
      bricks = bricks.filter(b => !b.dead);
      parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; }); parts = parts.filter(p => p.t > 0);
      if (!bricks.length) { level++; build(); resetBall(); ball.vy *= 1 + level * 0.05; hud(); GameKit.beep(1200, 0.2); }
    }
    function draw() {
      const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1e1b4b'); gr.addColorStop(1, '#0f172a'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
      bricks.forEach(b => { x.fillStyle = b.col; x.globalAlpha = b.hp > 1 ? 1 : 0.85; x.beginPath(); x.roundRect(b.x, b.y, b.w, b.h, 4); x.fill(); if (b.hp > 1) { x.strokeStyle = '#fff'; x.stroke(); } });
      x.globalAlpha = 1; parts.forEach(p => { x.fillStyle = p.col; x.globalAlpha = p.t / 0.6; x.fillRect(p.x, p.y, 3, 3); }); x.globalAlpha = 1;
      x.fillStyle = '#e2e8f0'; x.beginPath(); x.roundRect(pad.x, H - 24, pad.w, 10, 5); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(ball.x, ball.y, ball.r, 0, 7); x.fill();
      if (stuck && playing) { x.fillStyle = '#fff8'; x.font = '14px sans-serif'; x.textAlign = 'center'; x.fillText('Click or press Space to launch', W / 2, H / 2 + 60); }
    }
    function start() { reset(); playing = true; g.loop(dt => { if (playing) update(dt); draw(); }); }
    reset(); draw(); g.overlay('🧨 Brick Smash', 'Move with mouse or ← →. Clear all bricks to level up.', 'Start', start);
  } });

// ------------------------------------------------------------------ Rocket Hop (tap to fly through asteroid gates)
OS.registerApp({ id: 'rockethop', name: 'Rocket Hop', icon: '🚀', category: 'Games', width: 440, height: 600, desc: 'Tap to thrust your rocket through asteroid gaps',
  launch(win) {
    const W = 420, H = 520, g = GameKit.setup(win, W, H, 'rockethop'), x = g.ctx;
    let r, gates, score, state = 'ready', t = 0, stars;
    const reset = () => { r = { y: H / 2, v: 0 }; gates = []; score = 0; t = 0; stars = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2 + 0.5 })); hud(); };
    const hud = () => g.setHud(`<span>🚀 Gates <b>${score}</b></span>`);
    const flap = () => { if (state === 'play') { r.v = -300; GameKit.beep(500, 0.04, 'triangle'); } };
    g.onKey(e => { if (e.key === ' ' || e.key === 'ArrowUp') flap(); });
    g.cv.addEventListener('pointerdown', flap);
    function update(dt) {
      t += dt; r.v += 900 * dt; r.y += r.v * dt;
      stars.forEach(s => { s.x -= s.s * 40 * dt; if (s.x < 0) s.x = W; });
      if (!gates.length || gates[gates.length - 1].x < W - 200) { const gap = Math.max(130, 180 - score * 2); gates.push({ x: W + 30, top: 40 + Math.random() * (H - gap - 80), gap, passed: false }); }
      gates.forEach(gt => { gt.x -= (140 + Math.min(100, score * 3)) * dt; if (!gt.passed && gt.x < 80) { gt.passed = true; score++; hud(); GameKit.beep(990, 0.06, 'triangle'); } });
      gates = gates.filter(gt => gt.x > -60);
      const hit = r.y < 0 || r.y > H || gates.some(gt => gt.x < 100 && gt.x + 50 > 70 && (r.y - 12 < gt.top || r.y + 12 > gt.top + gt.gap));
      if (hit) { state = 'over'; GameKit.beep(100, 0.4, 'sawtooth'); g.hi(score); g.overlay('💥 Crashed!', `Gates: ${score} · Best: ${g.hi()}`, 'Fly again', start); }
    }
    function rock(cx, y0, y1) { x.fillStyle = '#6b5b4b'; for (let y = y0; y < y1; y += 26) { x.beginPath(); x.arc(cx + Math.sin(y * 13) * 6, y + 13, 18 + Math.sin(y) * 4, 0, 7); x.fill(); } x.fillStyle = '#8a7a6a'; for (let y = y0; y < y1; y += 26) { x.beginPath(); x.arc(cx - 6 + Math.sin(y * 13) * 6, y + 9, 5, 0, 7); x.fill(); } }
    function draw() {
      x.fillStyle = '#050816'; x.fillRect(0, 0, W, H);
      stars.forEach(s => { x.fillStyle = `rgba(255,255,255,${s.s / 2.5})`; x.fillRect(s.x, s.y, s.s, s.s); });
      gates.forEach(gt => { rock(gt.x + 25, -10, gt.top); rock(gt.x + 25, gt.top + gt.gap, H + 20); });
      x.save(); x.translate(85, r.y); x.rotate(Math.max(-0.5, Math.min(1.1, r.v / 500)) + Math.PI / 4);
      x.font = '30px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🚀', 0, 0);
      x.restore();
      if (state === 'play' && r.v < 0) { x.fillStyle = '#ffb34780'; x.beginPath(); x.arc(70, r.y + 14, 6 + Math.random() * 4, 0, 7); x.fill(); }
    }
    function start() { reset(); state = 'play'; flap(); g.loop(dt => { if (state === 'play') update(dt); draw(); }); }
    reset(); draw(); g.overlay('🚀 Rocket Hop', 'Click or press Space to thrust. Fly through the asteroid gaps!', 'Launch', start);
  } });

// ------------------------------------------------------------------ Star Blaster (vertical space shooter)
OS.registerApp({ id: 'starblaster', name: 'Star Blaster', icon: '👾', category: 'Games', width: 520, height: 640, desc: 'Defend the galaxy from alien waves',
  launch(win) {
    const W = 480, H = 560, g = GameKit.setup(win, W, H, 'starblaster'), x = g.ctx;
    let ship, shots, foes, eshots, parts, score, lives, wave, cool, playing = false, inv = 0, power = 0, drops = [];
    const stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2 + 0.3 }));
    const hud = () => g.setHud(`<span>Score <b>${score}</b></span><span>${'🚀'.repeat(Math.max(0, lives))}</span><span>Wave ${wave}</span>${power > 0 ? '<span>⚡ Triple</span>' : ''}`);
    function spawn() { foes = []; const rows = Math.min(5, 2 + Math.floor(wave / 2)); for (let r = 0; r < rows; r++) for (let c = 0; c < 8; c++) foes.push({ x: 50 + c * 52, y: -40 - r * 46, ty: 50 + r * 46, hp: 1 + Math.floor(wave / 4), kind: r % 3, t: Math.random() * 6 }); }
    function reset() { ship = { x: W / 2, y: H - 50 }; shots = []; eshots = []; parts = []; drops = []; score = 0; lives = 3; wave = 1; cool = 0; power = 0; spawn(); hud(); }
    const boom = (px, py, col, n = 14) => { for (let i = 0; i < n; i++) parts.push({ x: px, y: py, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260, t: 0.7, col }); };
    g.cv.addEventListener('pointermove', e => { if (playing) ship.x = Math.max(20, Math.min(W - 20, g.pos(e)[0])); });
    let mouseFire = false; g.cv.addEventListener('pointerdown', () => mouseFire = true); addEventListener('pointerup', () => mouseFire = false);
    function update(dt) {
      if (g.keys.ArrowLeft || g.keys.a) ship.x -= 360 * dt; if (g.keys.ArrowRight || g.keys.d) ship.x += 360 * dt; ship.x = Math.max(20, Math.min(W - 20, ship.x));
      cool -= dt; inv -= dt; power -= dt;
      if ((g.keys[' '] || mouseFire) && cool <= 0) { cool = 0.22; shots.push({ x: ship.x, y: ship.y - 20, vx: 0 }); if (power > 0) shots.push({ x: ship.x, y: ship.y - 20, vx: -120 }, { x: ship.x, y: ship.y - 20, vx: 120 }); GameKit.beep(1400, 0.02); }
      shots.forEach(s => { s.y -= 560 * dt; s.x += s.vx * dt; }); shots = shots.filter(s => s.y > -10);
      const sway = Math.sin(performance.now() / 700) * 40;
      foes.forEach(f => { f.t += dt; if (f.y < f.ty) f.y += 120 * dt; f.dx = sway + Math.sin(f.t * 2) * 6; if (Math.random() < 0.0018 * (1 + wave * 0.35)) eshots.push({ x: f.x + f.dx, y: f.y + 12 }); if (wave > 2 && Math.random() < 0.0004 * wave) f.dive = true; if (f.dive) { f.ty += 160 * dt; f.y = f.ty; } });
      eshots.forEach(s => s.y += (200 + wave * 15) * dt); eshots = eshots.filter(s => s.y < H + 10);
      drops.forEach(d => d.y += 120 * dt); drops = drops.filter(d => d.y < H + 20);
      for (const s of shots) for (const f of foes) if (!f.dead && Math.abs(s.x - (f.x + f.dx)) < 18 && Math.abs(s.y - f.y) < 16) { s.y = -99; if (--f.hp <= 0) { f.dead = true; score += 20 + f.kind * 10; boom(f.x + f.dx, f.y, ['#f472b6', '#a3e635', '#38bdf8'][f.kind]); GameKit.beep(220, 0.08, 'sawtooth'); if (Math.random() < 0.07) drops.push({ x: f.x + f.dx, y: f.y }); hud(); } }
      foes = foes.filter(f => !f.dead && f.y < H + 40);
      drops.forEach(d => { if (Math.abs(d.x - ship.x) < 24 && Math.abs(d.y - ship.y) < 24) { d.y = H + 99; power = 8; GameKit.beep(1500, 0.15, 'triangle'); hud(); } });
      if (inv <= 0 && (eshots.some(s => Math.abs(s.x - ship.x) < 14 && Math.abs(s.y - ship.y) < 16) || foes.some(f => Math.abs(f.x + f.dx - ship.x) < 26 && Math.abs(f.y - ship.y) < 22))) {
        lives--; inv = 2; eshots = []; boom(ship.x, ship.y, '#fb923c', 30); GameKit.beep(80, 0.5, 'sawtooth'); hud();
        if (lives <= 0) { playing = false; g.hi(score); g.overlay('💥 Game over', `Score ${score} · Wave ${wave} · Best ${g.hi()}`, 'Play again', start); }
      }
      if (!foes.length) { wave++; spawn(); hud(); }
      parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; }); parts = parts.filter(p => p.t > 0);
      stars.forEach(s => { s.y += s.s * 60 * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
    }
    function draw() {
      x.fillStyle = '#03040d'; x.fillRect(0, 0, W, H);
      stars.forEach(s => { x.fillStyle = `rgba(200,220,255,${s.s / 2.3})`; x.fillRect(s.x, s.y, s.s, s.s * 2); });
      x.font = '26px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      foes.forEach(f => x.fillText(['👾', '👽', '🛸'][f.kind], f.x + f.dx, f.y));
      x.font = '20px serif'; drops.forEach(d => x.fillText('⚡', d.x, d.y));
      x.fillStyle = '#7dd3fc'; shots.forEach(s => x.fillRect(s.x - 2, s.y - 8, 4, 14));
      x.fillStyle = '#fb7185'; eshots.forEach(s => { x.beginPath(); x.arc(s.x, s.y, 4, 0, 7); x.fill(); });
      parts.forEach(p => { x.globalAlpha = p.t / 0.7; x.fillStyle = p.col; x.fillRect(p.x, p.y, 3, 3); }); x.globalAlpha = 1;
      if (playing && (inv <= 0 || Math.floor(inv * 10) % 2)) { x.save(); x.translate(ship.x, ship.y); x.rotate(-Math.PI / 4); x.font = '32px serif'; x.fillText('🚀', 0, 0); x.restore(); }
    }
    function start() { reset(); playing = true; g.loop(dt => { if (playing) update(dt); draw(); }); }
    reset(); draw(); g.overlay('👾 Star Blaster', 'Move: mouse or ← → · Fire: Space or hold click · ⚡ = triple shot', 'Start', start);
    win.onClose(() => mouseFire = false);
  } });
