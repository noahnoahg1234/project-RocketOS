/* Rocket App Store — browse, install and publish .esl apps. */
const Store = (() => {
  const PUB = 'rocketos.store.published', RAT = 'rocketos.store.ratings', DL = 'rocketos.store.downloads';
  const DIR = '/apps/store';
  const mk = (meta, html, css, js) => ESL.serialize({ meta: Object.assign({ version: '1.0', author: 'RocketOS Team' }, meta), html, css, js });

  const official = [
    { id: 'pomodoro', name: 'Pomodoro Focus', icon: '🍅', category: 'Productivity', desc: 'Stay focused with 25/5 minute work sessions.', rating: 4.7, downloads: 18234,
      esl: mk({ name: 'Pomodoro Focus', icon: '🍅', width: 320, height: 300, category: 'Productivity', description: 'Focus timer' },
        `<div class="wrap"><div id="mode">Focus</div><div id="t">25:00</div><div class="row"><button id="go">Start</button><button id="rs">Reset</button></div><div class="row"><button class="m" data-m="25">Focus 25</button><button class="m" data-m="5">Break 5</button><button class="m" data-m="15">Long 15</button></div><p id="c">Sessions: 0</p></div>`,
        `.wrap{text-align:center;padding:20px}#t{font-size:64px;font-weight:700;font-variant-numeric:tabular-nums;margin:10px 0}#mode{opacity:.7;text-transform:uppercase;letter-spacing:3px}.row{display:flex;gap:6px;justify-content:center;margin:8px}.m{background:#444}`,
        `let total=1500,left=total,run=false,iv,sessions=0;const t=document.getElementById('t'),go=document.getElementById('go');
os.storage.get('sessions').then(v=>{sessions=v||0;c.textContent='Sessions: '+sessions});
const show=()=>t.textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
go.onclick=()=>{run=!run;go.textContent=run?'Pause':'Start';clearInterval(iv);if(run)iv=setInterval(()=>{left--;show();if(left<=0){clearInterval(iv);run=false;go.textContent='Start';if(total===1500){sessions++;os.storage.set('sessions',sessions);c.textContent='Sessions: '+sessions;}os.notify('Pomodoro','Time is up! 🍅');left=total;show();}},1000)};
rs.onclick=()=>{left=total;show()};document.querySelectorAll('.m').forEach(b=>b.onclick=()=>{total=left=b.dataset.m*60;mode.textContent=b.textContent;show()});show();`) },
    { id: 'dice', name: 'Dice Roller', icon: '🎲', category: 'Games', desc: 'Roll any number of dice with style.', rating: 4.4, downloads: 9120,
      esl: mk({ name: 'Dice Roller', icon: '🎲', width: 360, height: 300, category: 'Games', description: 'Roll dice' },
        `<div class="wrap"><div id="dice"></div><p id="sum">Click roll!</p><label>Dice: <input id="n" type="number" min="1" max="8" value="2"></label> <select id="s"><option>6</option><option>4</option><option>8</option><option>10</option><option>12</option><option>20</option></select><br><br><button id="r">🎲 Roll</button></div>`,
        `.wrap{text-align:center;padding:16px}#dice{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;min-height:80px}.d{width:60px;height:60px;border-radius:12px;background:#fff;color:#222;font-size:28px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 0 #bbb;transition:transform .3s}input{width:50px}`,
        `r.onclick=()=>{dice.innerHTML='';let t=0;for(let i=0;i<Math.min(8,+n.value||1);i++){const v=1+Math.floor(Math.random()*+s.value);t+=v;const d=document.createElement('div');d.className='d';d.textContent=v;d.style.transform='rotate('+(Math.random()*40-20)+'deg)';dice.append(d)}sum.textContent='Total: '+t};`) },
    { id: 'colorpicker', name: 'Color Studio', icon: '🌈', category: 'Developer', desc: 'Pick colors, build palettes and copy HEX/RGB/HSL codes.', rating: 4.6, downloads: 7311,
      esl: mk({ name: 'Color Studio', icon: '🌈', width: 400, height: 360, category: 'Developer', description: 'Color picker' },
        `<div class="wrap"><input type="color" id="c" value="#ff6b35"><div id="sw"></div><div id="codes"></div><h4>Palette</h4><div id="pal"></div><button id="rand">🎲 Random palette</button></div>`,
        `.wrap{padding:16px}#c{width:100%;height:50px;border:0;padding:0}#sw{height:60px;border-radius:10px;margin:10px 0}#codes div{font-family:monospace;padding:4px;cursor:pointer}#pal{display:flex;gap:6px;margin-bottom:10px}#pal div{flex:1;height:44px;border-radius:8px;cursor:pointer}`,
        `const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));function hsl([r,g,b]){r/=255;g/=255;b/=255;const M=Math.max(r,g,b),m=Math.min(r,g,b);let h=0,s=0,l=(M+m)/2;if(M!==m){const d=M-m;s=l>.5?d/(2-M-m):d/(M+m);h=M===r?(g-b)/d+(g<b?6:0):M===g?(b-r)/d+2:(r-g)/d+4;h*=60}return Math.round(h)+', '+Math.round(s*100)+'%, '+Math.round(l*100)+'%'}
function upd(){const v=c.value,rgb=hx(v);sw.style.background=v;codes.innerHTML='';['HEX '+v,'RGB '+rgb.join(', '),'HSL '+hsl(rgb)].forEach(t=>{const d=document.createElement('div');d.textContent=t+'  📋';d.onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText(t.slice(4));os.notify('Color Studio','Copied '+t.slice(4))};codes.append(d)})}
rand.onclick=()=>{pal.innerHTML='';const b=Math.random()*360;for(let i=0;i<5;i++){const d=document.createElement('div');const col='hsl('+((b+i*30)%360)+',70%,'+(40+i*8)+'%)';d.style.background=col;d.onclick=()=>{const cv=document.createElement('canvas').getContext('2d');cv.fillStyle=col;c.value=cv.fillStyle;upd()};pal.append(d)}};c.oninput=upd;upd();rand.onclick();`) },
    { id: 'unitconv', name: 'Unit Converter', icon: '📐', category: 'Productivity', desc: 'Convert length, weight, temperature and more.', rating: 4.5, downloads: 11002,
      esl: mk({ name: 'Unit Converter', icon: '📐', width: 380, height: 260, category: 'Productivity', description: 'Convert units' },
        `<div class="wrap"><select id="k"></select><div class="r"><input id="a" type="number" value="1"><select id="fa"></select></div><div class="r"><input id="b" readonly><select id="fb"></select></div></div>`,
        `.wrap{padding:20px;display:flex;flex-direction:column;gap:12px}.r{display:flex;gap:8px}.r input{flex:1}`,
        `const U={Length:{m:1,km:1000,cm:.01,mm:.001,mi:1609.344,yd:.9144,ft:.3048,in:.0254},Weight:{kg:1,g:.001,lb:.45359237,oz:.0283495,t:1000},Volume:{L:1,mL:.001,gal:3.78541,cup:.236588},Speed:{'m/s':1,'km/h':1/3.6,mph:.44704,knot:.514444},Temperature:{C:'C',F:'F',K:'K'},Data:{B:1,KB:1024,MB:1048576,GB:1073741824}};
Object.keys(U).forEach(x=>k.add(new Option(x)));function fill(){[fa,fb].forEach((s,i)=>{s.innerHTML='';Object.keys(U[k.value]).forEach(u=>s.add(new Option(u)));s.selectedIndex=i?1:0});calc()}
function calc(){const v=+a.value,f=fa.value,t=fb.value;let r;if(k.value==='Temperature'){const c=f==='C'?v:f==='F'?(v-32)*5/9:v-273.15;r=t==='C'?c:t==='F'?c*9/5+32:c+273.15}else r=v*U[k.value][f]/U[k.value][t];b.value=+r.toPrecision(10)}
k.onchange=fill;[a,fa,fb].forEach(e=>e.oninput=calc);fill();`) },
    { id: 'quotes', name: 'Daily Spark', icon: '💡', category: 'Lifestyle', desc: 'A dose of inspiration every day.', rating: 4.2, downloads: 5420,
      esl: mk({ name: 'Daily Spark', icon: '💡', width: 420, height: 260, category: 'Lifestyle', description: 'Quotes' },
        `<div class="wrap"><div id="q"></div><div id="a"></div><button id="n">✨ Next</button></div>`,
        `.wrap{padding:30px;text-align:center;display:flex;flex-direction:column;gap:14px;justify-content:center;height:100%;box-sizing:border-box;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}#q{font-size:20px;font-style:italic}#a{opacity:.8}`,
        `const Q=[['The secret of getting ahead is getting started.','Mark Twain'],['Simplicity is the soul of efficiency.','Austin Freeman'],['Make it work, make it right, make it fast.','Kent Beck'],['The best time to plant a tree was 20 years ago. The second best time is now.','Proverb'],['Stay hungry, stay foolish.','Whole Earth Catalog'],['What we know is a drop, what we don’t know is an ocean.','Isaac Newton'],['Done is better than perfect.','Proverb']];
let i=new Date().getDate()%Q.length;const show=()=>{q.textContent='“'+Q[i][0]+'”';a.textContent='— '+Q[i][1]};n.onclick=()=>{i=(i+1)%Q.length;show()};show();`) },
    { id: 'mdpad', name: 'Markdown Pad', icon: '✍️', category: 'Developer', desc: 'Write Markdown with a live preview; saves to your Documents.', rating: 4.3, downloads: 6033,
      esl: mk({ name: 'Markdown Pad', icon: '✍️', width: 700, height: 440, category: 'Developer', description: 'Markdown editor' },
        `<div class="bar"><button id="sv">💾 Save to ~/Documents/pad.md</button></div><div class="m"><textarea id="src"># Hello Markdown\n\nWrite **bold**, *italic*, \`code\` and lists:\n\n- one\n- two\n\n> Quotes too!</textarea><div id="out"></div></div>`,
        `body{display:flex;flex-direction:column}.bar{padding:6px}.m{flex:1;display:flex;height:calc(100% - 44px)}textarea{flex:1;resize:none;border-radius:0;font-family:monospace}#out{flex:1;padding:12px;overflow:auto;border-left:1px solid #8884}code{background:#8883;padding:1px 4px;border-radius:4px}blockquote{border-left:3px solid #ff6b35;margin:0;padding-left:10px;opacity:.8}`,
        `const e=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');function md(s){return e(s).split(/\\n\\n+/).map(b=>{if(/^#{1,6} /.test(b)){const n=b.match(/^#+/)[0].length;return '<h'+n+'>'+b.slice(n+1)+'</h'+n+'>'}if(/^- /m.test(b))return '<ul>'+b.split('\\n').map(l=>'<li>'+l.replace(/^- /,'')+'</li>').join('')+'</ul>';if(/^&gt; /.test(b))return '<blockquote>'+b.replace(/^&gt; /gm,'')+'</blockquote>';return '<p>'+b.replace(/\\n/g,'<br>')+'</p>'}).join('').replace(/\\*\\*(.+?)\\*\\*/g,'<b>$1</b>').replace(/\\*(.+?)\\*/g,'<i>$1</i>').replace(/\`(.+?)\`/g,'<code>$1</code>')}
const r=()=>out.innerHTML=md(src.value);src.oninput=r;os.fs.exists('~/Documents/pad.md').then(x=>x&&os.fs.read('~/Documents/pad.md').then(t=>{src.value=t;r()}));sv.onclick=()=>os.fs.write('~/Documents/pad.md',src.value).then(()=>os.notify('Markdown Pad','Saved!'));r();`) },
    { id: 'hangman', name: 'Word Guess', icon: '🔤', category: 'Games', desc: 'Guess the space-themed word before you run out of tries.', rating: 4.5, downloads: 8790,
      esl: mk({ name: 'Word Guess', icon: '🔤', width: 440, height: 360, category: 'Games', description: 'Word guessing game' },
        `<div class="wrap"><div id="art"></div><div id="w"></div><div id="msg"></div><div id="kb"></div><button id="nw">New word</button></div>`,
        `.wrap{text-align:center;padding:12px}#art{font-size:28px;min-height:36px}#w{font-size:30px;letter-spacing:8px;font-family:monospace;margin:10px}#kb{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:10px}#kb button{width:30px;padding:6px 0}#kb button:disabled{opacity:.3}`,
        `const W=['ROCKET','GALAXY','ORBIT','NEBULA','COMET','PLANET','SATELLITE','ASTRONAUT','METEOR','LAUNCH','GRAVITY','SATURN','JUPITER','ECLIPSE'];let word,got,miss;
function start(){word=W[Math.floor(Math.random()*W.length)];got=new Set;miss=0;kb.innerHTML='';msg.textContent='';for(const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){const b=document.createElement('button');b.textContent=c;b.onclick=()=>guess(c,b);kb.append(b)}draw()}
function guess(c,b){b.disabled=true;if(word.includes(c))got.add(c);else miss++;draw()}
function draw(){w.textContent=[...word].map(c=>got.has(c)?c:'_').join('');art.textContent='🚀'+'💥'.repeat(miss)+'⬜'.repeat(6-miss);if([...word].every(c=>got.has(c))){msg.textContent='🎉 You got it!';kb.querySelectorAll('button').forEach(b=>b.disabled=true)}else if(miss>=6){msg.textContent='💀 The word was '+word;kb.querySelectorAll('button').forEach(b=>b.disabled=true)}}
nw.onclick=start;start();`) },
    { id: 'whiteboard', name: 'Whiteboard', icon: '🖍️', category: 'Productivity', desc: 'A quick sketch pad for ideas.', rating: 4.1, downloads: 4211,
      esl: mk({ name: 'Whiteboard', icon: '🖍️', width: 600, height: 420, category: 'Productivity', description: 'Sketch pad' },
        `<canvas id="c"></canvas><div class="t"><input type="color" id="col" value="#222222"><button id="clr">Clear</button></div>`,
        `body{overflow:hidden;background:#fff}canvas{display:block;cursor:crosshair}.t{position:fixed;top:8px;right:8px;display:flex;gap:6px}`,
        `const x=c.getContext('2d');function sz(){c.width=innerWidth;c.height=innerHeight}sz();onresize=sz;let d=false;c.onpointerdown=e=>{d=true;x.beginPath();x.moveTo(e.clientX,e.clientY)};c.onpointermove=e=>{if(!d)return;x.lineTo(e.clientX,e.clientY);x.strokeStyle=col.value;x.lineWidth=3;x.lineCap='round';x.stroke()};onpointerup=()=>d=false;clr.onclick=()=>x.clearRect(0,0,c.width,c.height);`) },
  ];

  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const published = () => load(PUB, []);
  function catalog() {
    const dl = load(DL, {});
    return [...official.map(a => ({ ...a, official: true })), ...published().map(a => ({ ...a, community: true }))].map(a => ({ ...a, downloads: (a.downloads || 0) + (dl[a.id] || 0) }));
  }
  const get = id => catalog().find(a => a.id === id);
  const pathFor = id => `${DIR}/${id}.esl`;
  const isInstalled = id => VFS.exists(pathFor(id));
  async function install(id, onProgress) {
    const app = get(id); if (!app) throw new Error(`No app “${id}” in the store`);
    if (!NET.current()) throw new Error('No Wi-Fi connection — connect to a network to download apps');
    for (let p = 0; p <= 100; p += 20) { onProgress && onProgress(p); await new Promise(r => setTimeout(r, 120 + Math.random() * 150)); }
    VFS.mkdir(DIR);
    VFS.write(pathFor(id), app.esl);
    const dl = load(DL, {}); dl[id] = (dl[id] || 0) + 1; localStorage.setItem(DL, JSON.stringify(dl));
    OS.log(`store: installed ${id}`);
    OS.notify('App Store', `${app.icon} ${app.name} installed`, '🛍️', { action: () => ESL.run(pathFor(id)) });
    OS.emit('store');
    return pathFor(id);
  }
  function uninstall(id) { if (!isInstalled(id)) throw new Error(`${id} is not installed`); VFS.rm(pathFor(id)); OS.emit('store'); }
  function publish(eslText) {
    const app = ESL.parse(eslText);
    if (!app.meta.name || app.meta.name === 'Untitled App') throw new Error('Give your app a name before publishing');
    const id = (app.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app') + '-' + (OS.settings.username || 'user').toLowerCase();
    const list = published().filter(a => a.id !== id);
    const entry = { id, name: app.meta.name, icon: app.meta.icon, category: app.meta.category || 'Community', desc: app.meta.description || 'A community app made with App Maker.', author: app.meta.author || OS.settings.username, version: app.meta.version || '1.0', esl: eslText, rating: 0, downloads: 0, publishedAt: Date.now() };
    list.unshift(entry); localStorage.setItem(PUB, JSON.stringify(list));
    OS.log(`store: published ${id}`); OS.emit('store');
    return entry;
  }
  function unpublish(id) { localStorage.setItem(PUB, JSON.stringify(published().filter(a => a.id !== id))); OS.emit('store'); }
  function rate(id, stars) { const r = load(RAT, {}); r[id] = stars; localStorage.setItem(RAT, JSON.stringify(r)); OS.emit('store'); }
  const myRating = id => load(RAT, {})[id] || 0;
  return { catalog, get, install, uninstall, isInstalled, publish, unpublish, rate, myRating, pathFor, published };
})();

OS.registerApp({ id: 'store', name: 'App Store', icon: '🛍️', category: 'System', width: 860, height: 560, singleton: true, desc: 'Download and publish apps',
  launch(win, args = {}) {
    const { h } = OS;
    let tab = 'Discover', q = '', detail = null;
    const search = h('input', { class: 'input', placeholder: '🔍 Search apps' });
    const nav = h('div', { class: 'st-nav' });
    const main = h('div', { class: 'st-main' });
    const upload = h('input', { type: 'file', accept: '.esl,text/plain', class: 'hidden' });
    win.body.append(h('div', { class: 'store' }, h('div', { class: 'st-side' }, h('div', { class: 'st-brand' }, '🛍️ App Store'), search, nav,
      h('div', { class: 'tb-spacer' }), h('button', { class: 'btn primary', onclick: () => OS.launch('appmaker') }, '🛠️ Make an app'), h('button', { class: 'btn', onclick: () => upload.click() }, '⬆️ Publish .esl file'), upload), main));
    upload.onchange = () => { const f = upload.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const e = Store.publish(String(r.result)); OS.notify('App Store', `Published ${e.name}!`, '🚀'); tab = 'Community'; render(); } catch (err) { OS.alert(err.message, 'Publish', '⚠️'); } }; r.readAsText(f); upload.value = ''; };
    search.addEventListener('input', () => { q = search.value.toLowerCase(); detail = null; render(); });
    const tabs = { Discover: '✨', Games: '🎮', Productivity: '📈', Developer: '🛠️', Lifestyle: '🌿', Community: '👥', Installed: '📦' };
    const stars = (n, id) => { const el = h('span', { class: 'stars' }); for (let i = 1; i <= 5; i++) { const s = h('span', { class: i <= Math.round(n) ? 'on' : '' }, '★'); if (id) s.onclick = e => { e.stopPropagation(); Store.rate(id, i); }; el.append(s); } return el; };
    const fmtN = n => n > 999 ? (n / 1000).toFixed(1) + 'k' : n;
    function actionBtn(a) {
      if (Store.isInstalled(a.id)) return h('button', { class: 'btn', onclick: e => { e.stopPropagation(); ESL.run(Store.pathFor(a.id)); } }, 'Open');
      const b = h('button', { class: 'btn primary', onclick: async e => { e.stopPropagation(); b.disabled = true; try { await Store.install(a.id, p => b.textContent = p + '%'); } catch (err) { OS.alert(err.message, 'App Store', '📶'); b.disabled = false; b.textContent = 'Get'; } } }, 'Get');
      return b;
    }
    function card(a) {
      const c = h('div', { class: 'st-card' }, h('div', { class: 'st-icon' }, a.icon), h('div', { class: 'st-info' }, h('b', {}, a.name), h('small', { class: 'muted' }, a.community ? '👤 ' + a.author : a.category), h('div', {}, stars(a.rating || Store.myRating(a.id)), h('small', { class: 'muted' }, ' ' + fmtN(a.downloads)))), actionBtn(a));
      c.onclick = () => { detail = a.id; render(); };
      return c;
    }
    function render() {
      nav.innerHTML = '';
      Object.entries(tabs).forEach(([t, i]) => nav.append(h('div', { class: 'st-link' + (t === tab && !q ? ' on' : ''), onclick: () => { tab = t; q = ''; search.value = ''; detail = null; render(); } }, i + ' ' + t)));
      main.innerHTML = '';
      const all = Store.catalog();
      if (detail) {
        const a = Store.get(detail); if (!a) { detail = null; return render(); }
        const src = ESL.parse(a.esl);
        main.append(h('button', { class: 'btn sm', onclick: () => { detail = null; render(); } }, '← Back'),
          h('div', { class: 'st-detail' }, h('div', { class: 'st-icon big' }, a.icon), h('div', {}, h('h2', {}, a.name), h('div', { class: 'muted' }, `${a.community ? 'Community app by ' + a.author : 'by ' + (src.meta.author || 'RocketOS Team')} · v${src.meta.version || '1.0'} · ${a.category}`),
            h('div', {}, stars(a.rating || Store.myRating(a.id)), h('small', { class: 'muted' }, ` ${a.rating ? a.rating.toFixed(1) : 'Not yet rated'} · ${fmtN(a.downloads)} downloads`)),
            h('div', { class: 'row' }, actionBtn(a), Store.isInstalled(a.id) ? h('button', { class: 'btn', onclick: () => { Store.uninstall(a.id); render(); } }, 'Uninstall') : '',
              h('button', { class: 'btn', onclick: () => { const p = VFS.uniqueName(VFS.home() + '/apps', src.meta.name.replace(/[\/]/g, '-'), '.esl'); VFS.write(p, a.esl); OS.launch('appmaker', { path: p }); } }, '🛠️ Remix in App Maker'),
              h('button', { class: 'btn', onclick: () => h('a', { href: URL.createObjectURL(new Blob([a.esl])), download: a.id + '.esl' }).click() }, '⬇️ Download .esl'),
              a.community && a.author === OS.settings.username ? h('button', { class: 'btn danger', onclick: async () => { if (await OS.confirm(`Unpublish ${a.name}?`)) { Store.unpublish(a.id); detail = null; render(); } } }, 'Unpublish') : ''))),
          h('p', {}, a.desc), h('div', { class: 'muted small' }, 'Rate this app: ', stars(Store.myRating(a.id), a.id)),
          h('h4', {}, 'Package contents'), h('pre', { class: 'st-src' }, `${src.html.length} B html · ${src.css.length} B css · ${src.js.length} B js\n\n` + src.html.slice(0, 400)));
        return;
      }
      let list = all;
      if (q) list = all.filter(a => (a.name + ' ' + a.desc + ' ' + a.category + ' ' + (a.author || '')).toLowerCase().includes(q));
      else if (tab === 'Installed') list = all.filter(a => Store.isInstalled(a.id));
      else if (tab === 'Community') list = all.filter(a => a.community);
      else if (tab !== 'Discover') list = all.filter(a => a.category === tab);
      if (!q && tab === 'Discover') {
        const feat = all[0];
        main.append(h('div', { class: 'st-hero', onclick: () => { detail = feat.id; render(); } }, h('div', { class: 'st-hero-ic' }, feat.icon), h('div', {}, h('small', {}, 'FEATURED'), h('h2', {}, feat.name), h('div', {}, feat.desc))),
          h('div', { class: 'card row' }, '🛠️', h('div', {}, h('b', {}, 'Built something cool?'), h('div', { class: 'muted' }, 'Make an app in App Maker and press Publish — it shows up in Community for everyone on this computer.'))));
        if (!NET.current()) main.append(h('div', { class: 'card warn' }, '📶 You’re offline. Connect to Wi-Fi to download apps.'));
      }
      main.append(h('h3', {}, q ? `Results for “${q}”` : tab));
      const grid = h('div', { class: 'st-grid' }, ...list.map(card));
      main.append(grid);
      if (!list.length) main.append(h('div', { class: 'muted pad' }, tab === 'Community' ? 'No community apps yet — be the first to publish one!' : tab === 'Installed' ? 'No store apps installed yet.' : 'Nothing found.'));
    }
    const off = OS.on('store', render); win.onClose(off);
    const off2 = OS.on('net', render); win.onClose(off2);
    if (args.detail) detail = args.detail;
    render();
  } });
