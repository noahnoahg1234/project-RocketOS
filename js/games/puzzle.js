/* Puzzle & board games: Mine Field, Doubler, Tic-Tac-Toe, Memory Match */
(() => {
  const { h } = OS;

  // ------------------------------------------------------------------ Mine Field
  OS.registerApp({ id: 'minefield', name: 'Mine Field', icon: '💣', category: 'Games', width: 460, height: 560, desc: 'Clear the field without detonating a mine',
    launch(win) {
      const levels = { Easy: [9, 9, 10], Medium: [12, 12, 24], Hard: [16, 16, 48] };
      let lvl = 'Easy', R, Cn, M, cells, first, over, flags, timer, t0, iv;
      const face = h('button', { class: 'mf-face' }, '🙂'), mines = h('span', { class: 'mf-num' }), clock = h('span', { class: 'mf-num' });
      const sel = h('select', { class: 'input sm' }, ...Object.keys(levels).map(k => h('option', {}, k)));
      const grid = h('div', { class: 'mf-grid' });
      win.body.append(h('div', { class: 'minefield' }, h('div', { class: 'mf-top' }, mines, face, clock), h('div', { class: 'row center' }, sel, h('span', { class: 'muted small' }, 'Right-click (or long-press) to flag · 🏆 ' + (GameKit.hi('mine-Easy') ? 'best ' + (1000 - GameKit.hi('mine-Easy')) + 's' : ''))), grid));
      sel.onchange = () => { lvl = sel.value; reset(); };
      face.onclick = () => reset();
      function reset() {
        [R, Cn, M] = levels[lvl]; first = true; over = false; flags = 0; clearInterval(iv); clock.textContent = '000'; face.textContent = '🙂';
        cells = Array.from({ length: R * Cn }, (_, i) => ({ i, r: Math.floor(i / Cn), c: i % Cn, mine: false, open: false, flag: false, n: 0 }));
        grid.style.gridTemplateColumns = `repeat(${Cn}, 28px)`; grid.innerHTML = '';
        cells.forEach(cell => {
          cell.el = h('div', { class: 'mf-cell' });
          cell.el.addEventListener('click', () => open(cell));
          cell.el.addEventListener('contextmenu', e => { e.preventDefault(); flag(cell); });
          let lp; cell.el.addEventListener('touchstart', () => lp = setTimeout(() => { flag(cell); lp = 'done'; }, 450), { passive: true }); cell.el.addEventListener('touchend', e => { if (lp === 'done') e.preventDefault(); clearTimeout(lp); });
          cell.el.addEventListener('dblclick', () => chord(cell));
          grid.append(cell.el);
        });
        upd(); win.setRect({ width: Math.max(320, Cn * 30 + 40), height: R * 30 + 150 });
      }
      const nb = cell => { const out = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const r = cell.r + dr, c = cell.c + dc; if (r >= 0 && r < R && c >= 0 && c < Cn) out.push(cells[r * Cn + c]); } return out; };
      function plant(safe) {
        const avoid = new Set([safe, ...nb(safe)]); let placed = 0;
        while (placed < M) { const c = cells[Math.floor(Math.random() * cells.length)]; if (!c.mine && !avoid.has(c)) { c.mine = true; placed++; } }
        cells.forEach(c => c.n = nb(c).filter(x => x.mine).length);
        t0 = Date.now(); iv = setInterval(() => clock.textContent = String(Math.min(999, Math.floor((Date.now() - t0) / 1000))).padStart(3, '0'), 250);
      }
      function open(cell) {
        if (over || cell.flag || cell.open) return;
        if (first) { plant(cell); first = false; }
        cell.open = true;
        if (cell.mine) { over = true; clearInterval(iv); face.textContent = '😵'; cells.forEach(c => { if (c.mine) c.open = true; }); cell.boom = true; OS.Sound.tone(90, 0.5, 'sawtooth', 0.1); upd(); return; }
        if (!cell.n) nb(cell).forEach(open);
        OS.Sound.blip(1000 + cell.n * 80, 0.02);
        upd(); check();
      }
      function chord(cell) { if (!cell.open || !cell.n) return; if (nb(cell).filter(x => x.flag).length === cell.n) nb(cell).forEach(open); }
      function flag(cell) { if (over || cell.open) return; cell.flag = !cell.flag; flags += cell.flag ? 1 : -1; upd(); }
      function check() { if (cells.every(c => c.mine || c.open)) { over = true; clearInterval(iv); face.textContent = '😎'; const s = Math.floor((Date.now() - t0) / 1000); GameKit.hi('mine-' + lvl, 1000 - s); OS.notify('Mine Field', `🎉 Cleared ${lvl} in ${s}s!`, '💣'); cells.forEach(c => c.mine && (c.flag = true)); upd(); } }
      function upd() {
        mines.textContent = String(M - flags).padStart(3, '0');
        const col = ['', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#b45309', '#0891b2', '#111', '#666'];
        cells.forEach(c => { c.el.className = 'mf-cell' + (c.open ? ' open' : '') + (c.boom ? ' boom' : ''); c.el.textContent = c.open ? (c.mine ? '💣' : c.n || '') : c.flag ? '🚩' : ''; c.el.style.color = col[c.n] || ''; });
      }
      reset(); win.onClose(() => clearInterval(iv));
    } });

  // ------------------------------------------------------------------ Doubler (slide & merge number tiles)
  OS.registerApp({ id: 'doubler', name: 'Doubler', icon: '🔢', category: 'Games', width: 400, height: 540, desc: 'Slide tiles and merge equal numbers to reach 2048',
    launch(win) {
      const N = 4; let grid, score, won, moving = false;
      const scoreEl = h('b'), bestEl = h('b'), board = h('div', { class: 'db-board' }), msg = h('div', { class: 'db-msg' });
      win.body.append(h('div', { class: 'doubler', tabindex: 0 }, h('div', { class: 'db-top' }, h('div', { class: 'db-score' }, 'SCORE', scoreEl), h('div', { class: 'db-score' }, 'BEST', bestEl), h('button', { class: 'btn', onclick: () => reset() }, 'New')), h('div', { class: 'muted small center' }, 'Arrow keys / WASD or swipe. Merge tiles to reach 2048!'), h('div', { class: 'db-wrap' }, board, msg)));
      const root = win.body.firstChild;
      const add = () => { const e = []; grid.forEach((r, i) => r.forEach((v, j) => !v && e.push([i, j]))); if (!e.length) return; const [i, j] = e[Math.floor(Math.random() * e.length)]; grid[i][j] = Math.random() < 0.9 ? 2 : 4; return [i, j]; };
      function reset() { grid = Array.from({ length: N }, () => Array(N).fill(0)); score = 0; won = false; msg.className = 'db-msg'; add(); add(); draw(); }
      const colors = { 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e' };
      function draw(newCell, merged = []) {
        board.innerHTML = '';
        grid.forEach((r, i) => r.forEach((v, j) => board.append(h('div', { class: 'db-cell' + (v ? ' v' : '') + (newCell && newCell[0] === i && newCell[1] === j ? ' new' : '') + (merged.some(m => m[0] === i && m[1] === j) ? ' pop' : ''), style: { background: v ? colors[v] || '#3c3a32' : '', color: v > 4 ? '#fff' : '#776e65', fontSize: v > 999 ? '22px' : v > 99 ? '28px' : '34px' } }, v || ''))));
        scoreEl.textContent = score; bestEl.textContent = Math.max(score, GameKit.hi('doubler'));
      }
      function slide(dir) { // dir: 0 left 1 right 2 up 3 down
        let moved = false; const merged = [];
        for (let k = 0; k < N; k++) {
          let line = []; for (let m = 0; m < N; m++) { const [i, j] = dir < 2 ? [k, dir === 0 ? m : N - 1 - m] : [dir === 2 ? m : N - 1 - m, k]; line.push(grid[i][j]); }
          const vals = line.filter(Boolean), out = [];
          for (let m = 0; m < vals.length; m++) { if (vals[m] === vals[m + 1]) { out.push(vals[m] * 2); score += vals[m] * 2; if (vals[m] * 2 === 2048 && !won) won = 'new'; merged.push(out.length - 1); m++; } else out.push(vals[m]); }
          while (out.length < N) out.push(0);
          for (let m = 0; m < N; m++) { const [i, j] = dir < 2 ? [k, dir === 0 ? m : N - 1 - m] : [dir === 2 ? m : N - 1 - m, k]; if (grid[i][j] !== out[m]) moved = true; grid[i][j] = out[m]; }
          merged.splice(0, merged.length, ...merged.map(m => typeof m === 'number' ? (dir < 2 ? [k, dir === 0 ? m : N - 1 - m] : [dir === 2 ? m : N - 1 - m, k]) : m));
        }
        if (!moved) return;
        const nc = add(); GameKit.hi('doubler', score); draw(nc, merged); OS.Sound.blip(500 + merged.length * 100, 0.03);
        if (won === 'new') { won = true; msg.className = 'db-msg show'; msg.innerHTML = '🎉 2048! <br><small>Keep going for a higher score</small>'; setTimeout(() => msg.className = 'db-msg', 2500); }
        const canMove = grid.some((r, i) => r.some((v, j) => !v || (j < N - 1 && v === r[j + 1]) || (i < N - 1 && v === grid[i + 1][j])));
        if (!canMove) { msg.className = 'db-msg show'; msg.innerHTML = `Game over<br><small>Score ${score}</small>`; }
      }
      root.addEventListener('keydown', e => { const d = { ArrowLeft: 0, a: 0, ArrowRight: 1, d: 1, ArrowUp: 2, w: 2, ArrowDown: 3, s: 3 }[e.key]; if (d != null) { e.preventDefault(); slide(d); } });
      let sx, sy; root.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; root.focus(); });
      root.addEventListener('pointerup', e => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return; slide(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 1) : (dy < 0 ? 2 : 3)); });
      reset(); setTimeout(() => root.focus(), 50);
    } });

  // ------------------------------------------------------------------ Tic-Tac-Toe (unbeatable minimax on Hard)
  OS.registerApp({ id: 'tictactoe', name: 'Tic-Tac-Toe', icon: '⭕', category: 'Games', width: 380, height: 500, desc: 'Play X and O against the computer or a friend',
    launch(win) {
      let b, turn, over, mode = 'Hard', score = { X: 0, O: 0, D: 0 };
      const info = h('div', { class: 'ttt-info' }), board = h('div', { class: 'ttt-board' }), sc = h('div', { class: 'ttt-score' });
      const modeSel = h('div', { class: 'seg' }, ...['Easy', 'Hard', '2 Players'].map(m => h('button', { class: m === mode ? 'on' : '', onclick: e => { mode = m; [...modeSel.children].forEach(c => c.classList.toggle('on', c === e.target)); reset(); } }, m)));
      win.body.append(h('div', { class: 'ttt' }, modeSel, info, board, sc, h('button', { class: 'btn', onclick: () => reset() }, 'New game')));
      const L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
      const winner = s => { for (const l of L) if (s[l[0]] && s[l[0]] === s[l[1]] && s[l[1]] === s[l[2]]) return { p: s[l[0]], l }; return s.every(Boolean) ? { p: 'D' } : null; };
      function minimax(s, p) {
        const w = winner(s); if (w) return { v: w.p === 'O' ? 10 : w.p === 'X' ? -10 : 0 };
        let best = { v: p === 'O' ? -99 : 99 };
        s.forEach((c, i) => { if (c) return; s[i] = p; const r = minimax(s, p === 'O' ? 'X' : 'O'); s[i] = null; r.v -= Math.sign(r.v) * 0.1; if (p === 'O' ? r.v > best.v : r.v < best.v) best = { v: r.v, i }; });
        return best;
      }
      function reset() { b = Array(9).fill(null); turn = 'X'; over = false; draw(); }
      function play(i) {
        if (over || b[i]) return; b[i] = turn; OS.Sound.blip(turn === 'X' ? 700 : 500, 0.04);
        const w = winner(b);
        if (w) { over = true; score[w.p]++; draw(w); return; }
        turn = turn === 'X' ? 'O' : 'X'; draw();
        if (mode !== '2 Players' && turn === 'O') setTimeout(() => { const free = b.map((v, k) => v ? -1 : k).filter(k => k >= 0); const mv = mode === 'Easy' && Math.random() < 0.6 ? free[Math.floor(Math.random() * free.length)] : minimax(b.slice(), 'O').i; play(mv); }, 350);
      }
      function draw(w) {
        board.innerHTML = '';
        b.forEach((v, i) => board.append(h('div', { class: 'ttt-cell' + (v ? ' ' + v : '') + (w && w.l && w.l.includes(i) ? ' win' : ''), onclick: () => { if (mode === '2 Players' || turn === 'X') play(i); } }, v === 'X' ? '✕' : v === 'O' ? '◯' : '')));
        info.textContent = w ? (w.p === 'D' ? '🤝 Draw!' : `${w.p === 'X' ? '✕' : '◯'} wins! ${mode !== '2 Players' ? (w.p === 'X' ? '🎉' : '🤖') : ''}`) : `${turn === 'X' ? '✕' : '◯'} to move`;
        sc.textContent = `✕ ${score.X}   ·   Draws ${score.D}   ·   ◯ ${score.O}`;
      }
      reset();
    } });

  // ------------------------------------------------------------------ Memory Match
  OS.registerApp({ id: 'memory', name: 'Memory Match', icon: '🃏', category: 'Games', width: 480, height: 560, desc: 'Flip cards and find all the pairs',
    launch(win) {
      const sets = { Space: ['🚀', '🌍', '🌙', '⭐', '🪐', '☄️', '🛸', '👽', '🌌', '🛰️'], Animals: ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐧', '🐙', '🦄'], Food: ['🍕', '🍔', '🍩', '🍓', '🍉', '🌮', '🍣', '🍪', '🥑', '🍒'] };
      let theme = 'Space', size = 16, cards, open, moves, found, lock, t0, iv;
      const grid = h('div', { class: 'mm-grid' }), info = h('div', { class: 'mm-info' });
      const themeSel = h('select', { class: 'input sm', onchange: e => { theme = e.target.value; reset(); } }, ...Object.keys(sets).map(k => h('option', {}, k)));
      const sizeSel = h('select', { class: 'input sm', onchange: e => { size = +e.target.value; reset(); } }, h('option', { value: 16 }, '4×4'), h('option', { value: 20 }, '5×4'));
      win.body.append(h('div', { class: 'memory' }, h('div', { class: 'row center' }, themeSel, sizeSel, h('button', { class: 'btn sm', onclick: () => reset() }, 'Shuffle')), info, grid));
      function reset() {
        const pick = sets[theme].slice(0, size / 2);
        cards = [...pick, ...pick].sort(() => Math.random() - 0.5).map(v => ({ v, up: false, done: false }));
        open = []; moves = 0; found = 0; lock = false; clearInterval(iv); t0 = null;
        grid.style.gridTemplateColumns = `repeat(${size === 16 ? 4 : 5}, 1fr)`; render();
      }
      function render() {
        grid.innerHTML = '';
        cards.forEach((c, i) => grid.append(h('div', { class: 'mm-card' + (c.up || c.done ? ' up' : '') + (c.done ? ' done' : ''), onclick: () => flip(i) }, h('div', { class: 'mm-inner' }, h('div', { class: 'mm-front' }, '🚀'), h('div', { class: 'mm-back' }, c.v)))));
        const secs = t0 ? Math.floor((Date.now() - t0) / 1000) : 0;
        info.textContent = `Moves: ${moves} · Pairs: ${found}/${size / 2} · ⏱️ ${secs}s · 🏆 ${GameKit.hi('memory' + size) ? 'best ' + (999 - GameKit.hi('memory' + size)) + ' moves' : 'no record yet'}`;
      }
      function flip(i) {
        const c = cards[i]; if (lock || c.up || c.done) return;
        if (!t0) { t0 = Date.now(); iv = setInterval(render, 1000); }
        c.up = true; open.push(c); OS.Sound.blip(800, 0.03);
        if (open.length === 2) {
          moves++; const [a, b] = open;
          if (a.v === b.v) { a.done = b.done = true; open = []; found++; OS.Sound.blip(1200, 0.08);
            if (found === size / 2) { clearInterval(iv); GameKit.hi('memory' + size, 999 - moves); setTimeout(() => OS.notify('Memory Match', `🎉 All pairs found in ${moves} moves!`, '🃏'), 300); } }
          else { lock = true; setTimeout(() => { a.up = b.up = false; open = []; lock = false; render(); }, 800); }
        }
        render();
      }
      reset(); win.onClose(() => clearInterval(iv));
    } });
})();
