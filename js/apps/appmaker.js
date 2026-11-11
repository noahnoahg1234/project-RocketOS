/* App Maker — create, edit, preview, save and publish .esl apps. Includes templates and a component palette. */
OS.registerApp({ id: 'appmaker', name: 'App Maker', icon: '🛠️', category: 'Development', width: 1000, height: 620, desc: 'Build .esl apps and publish them to the App Store',
  launch(win, args = {}) {
    const { h } = OS;
    let path = null, dirty = false, tab = 'html';
    const templates = {
      'Hello World': { meta: { name: 'Hello World', icon: '👋', width: 360, height: 240, category: 'Productivity', description: 'My first RocketOS app' }, html: '<h1>Hello, RocketOS! 🚀</h1>\n<button id="btn">Say hi</button>', css: 'body { text-align: center; padding: 30px; }\nh1 { color: #ff6b35; }', js: "document.getElementById('btn').onclick = () => {\n  os.notify('Hello', 'My first app works!');\n};" },
      'Counter': { meta: { name: 'Counter', icon: '🔢', width: 300, height: 260, category: 'Productivity', description: 'A persistent counter' }, html: '<div id="n">0</div>\n<button id="minus">−</button>\n<button id="plus">+</button>', css: 'body{text-align:center;padding:20px}\n#n{font-size:72px;font-weight:800;margin:10px}\nbutton{font-size:24px;width:60px}', js: "let n = 0;\nconst show = () => document.getElementById('n').textContent = n;\nos.storage.get('n').then(v => { n = v || 0; show(); });\nplus.onclick = () => { n++; show(); os.storage.set('n', n); };\nminus.onclick = () => { n--; show(); os.storage.set('n', n); };" },
      'To-Do List': { meta: { name: 'My Todos', icon: '✅', width: 380, height: 420, category: 'Productivity', description: 'A to-do list saved to a file' }, html: '<h2>✅ To-Do</h2>\n<form id="f"><input id="t" placeholder="New task"> <button>Add</button></form>\n<ul id="list"></ul>', css: 'body{padding:16px}\nul{padding:0;list-style:none}\nli{padding:8px;border-bottom:1px solid #8884;cursor:pointer}\nli.done{text-decoration:line-through;opacity:.5}', js: "const FILE = '~/Documents/todos.json';\nlet items = [];\nconst save = () => os.fs.write(FILE, JSON.stringify(items));\nfunction render() {\n  list.innerHTML = '';\n  items.forEach((it, i) => {\n    const li = document.createElement('li');\n    li.textContent = it.t; li.className = it.d ? 'done' : '';\n    li.onclick = () => { it.d = !it.d; save(); render(); };\n    list.append(li);\n  });\n}\nf.onsubmit = e => { e.preventDefault(); if (!t.value) return; items.push({ t: t.value, d: false }); t.value = ''; save(); render(); };\nos.fs.exists(FILE).then(x => x && os.fs.read(FILE).then(s => { items = JSON.parse(s); render(); }));" },
      'Canvas Game': { meta: { name: 'Bouncy', icon: '🏀', width: 480, height: 360, category: 'Games', description: 'Click the ball to score' }, html: '<canvas id="c"></canvas>\n<div id="s">Score: 0</div>', css: 'body{margin:0;overflow:hidden;background:#111}\n#s{position:fixed;top:8px;left:10px;color:#fff;font:bold 18px sans-serif}', js: "const x = c.getContext('2d');\nc.width = innerWidth; c.height = innerHeight;\nlet b = { x: 100, y: 100, vx: 3, vy: 2, r: 24 }, score = 0;\nc.onclick = e => { if (Math.hypot(e.clientX - b.x, e.clientY - b.y) < b.r) { score++; s.textContent = 'Score: ' + score; b.vx *= 1.15; b.vy *= 1.15; } };\n(function loop() {\n  b.x += b.vx; b.y += b.vy;\n  if (b.x < b.r || b.x > c.width - b.r) b.vx *= -1;\n  if (b.y < b.r || b.y > c.height - b.r) b.vy *= -1;\n  x.fillStyle = '#1118'; x.fillRect(0, 0, c.width, c.height);\n  x.beginPath(); x.arc(b.x, b.y, b.r, 0, 7); x.fillStyle = '#ff6b35'; x.fill();\n  requestAnimationFrame(loop);\n})();" },
      'File Viewer': { meta: { name: 'Folder Peek', icon: '🗂️', width: 420, height: 380, category: 'Developer', description: 'Lists files with the os.fs API' }, html: '<input id="p" value="~"> <button id="go">List</button>\n<pre id="out"></pre>', css: 'body{padding:12px}\npre{white-space:pre-wrap}', js: "go.onclick = async () => {\n  try { out.textContent = (await os.fs.list(p.value)).join('\\n'); }\n  catch (e) { out.textContent = 'Error: ' + e.message; }\n};\ngo.onclick();" },
      'Blank': { meta: { name: 'New App', icon: '✨', width: 480, height: 360, category: 'Productivity', description: '' }, html: '', css: '', js: '' },
    };
    const components = [
      ['Heading', '<h2>Heading</h2>'], ['Text', '<p>Some text</p>'], ['Button', '<button id="myButton">Click me</button>'], ['Input', '<input id="myInput" placeholder="Type…">'],
      ['Textarea', '<textarea id="myText" rows="4"></textarea>'], ['Checkbox', '<label><input type="checkbox" id="myCheck"> Option</label>'], ['Dropdown', '<select id="mySelect"><option>One</option><option>Two</option></select>'],
      ['Image', '<img src="https://picsum.photos/200" alt="" style="max-width:100%">'], ['Canvas', '<canvas id="myCanvas" width="300" height="200"></canvas>'], ['List', '<ul id="myList">\n  <li>Item</li>\n</ul>'], ['Card', '<div style="padding:12px;border-radius:12px;background:#8882">Card content</div>'],
    ];
    const snippets = [
      ['On click', "myButton.onclick = () => {\n  os.notify('Clicked!', '');\n};"], ['Notification', "os.notify('Title', 'Message');"], ['Ask user', "const name = await os.prompt('Your name?');"],
      ['Read file', "const text = await os.fs.read('~/Documents/file.txt');"], ['Write file', "await os.fs.write('~/Documents/file.txt', 'hello');"], ['Save value', "os.storage.set('key', 42);"], ['Load value', "const v = await os.storage.get('key');"],
      ['Run shell', "const out = await os.run('ls ~');"], ['Timer', "setInterval(() => {\n  // every second\n}, 1000);"], ['Open app', "os.launch('calculator');"],
    ];

    // Native languages (OS version): starter programs and snippets
    const LANG_TEMPLATES = {
      c: `#include <stdio.h>

int main(void) {
    char name[64];
    printf("What's your name? ");
    fflush(stdout);
    if (scanf("%63s", name) != 1) return 1;
    printf("Hello, %s! Welcome to RocketOS 🚀\\n", name);
    for (int i = 3; i > 0; i--) printf("%d...\\n", i);
    printf("Liftoff!\\n");
    return 0;
}`,
      cpp: `#include <iostream>
#include <string>
#include <vector>

int main() {
    std::string name;
    std::cout << "What's your name? " << std::flush;
    std::cin >> name;
    std::vector<std::string> planets{"Mercury", "Venus", "Earth", "Mars"};
    std::cout << "Hello, " << name << "! Let's tour the planets:\\n";
    for (const auto& p : planets) std::cout << "  -> " << p << "\\n";
    return 0;
}`,
      python: `name = input("What's your name? ")
print(f"Hello, {name}! Welcome to RocketOS 🚀")

for i in range(3, 0, -1):
    print(f"{i}...")
print("Liftoff!")`,
      rust: `use std::io::{self, Write};

fn main() {
    print!("What's your name? ");
    io::stdout().flush().unwrap();
    let mut name = String::new();
    io::stdin().read_line(&mut name).unwrap();
    println!("Hello, {}! Welcome to RocketOS 🚀", name.trim());

    let squares: Vec<u32> = (1..=5).map(|n| n * n).collect();
    println!("Squares: {:?}", squares);
}`,
      go: `package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

func main() {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print("What's your name? ")
	name, _ := reader.ReadString('\\n')
	fmt.Printf("Hello, %s! Welcome to RocketOS 🚀\\n", strings.TrimSpace(name))
	for i := 3; i > 0; i-- {
		fmt.Printf("%d...\\n", i)
	}
	fmt.Println("Liftoff!")
}`,
      javascript: `const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("What's your name? ", name => {
  console.log(\`Hello, \${name}! Welcome to RocketOS 🚀\`);
  [3, 2, 1].forEach(n => console.log(n + '...'));
  console.log('Liftoff!');
  rl.close();
});`,
      ruby: `print "What's your name? "
name = gets.chomp
puts "Hello, #{name}! Welcome to RocketOS 🚀"
3.downto(1) { |i| puts "#{i}..." }
puts "Liftoff!"`,
      lua: `io.write("What's your name? ")
local name = io.read()
print("Hello, " .. name .. "! Welcome to RocketOS 🚀")
for i = 3, 1, -1 do print(i .. "...") end
print("Liftoff!")`,
      java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        System.out.print("What's your name? ");
        System.out.flush();
        String name = in.nextLine();
        System.out.println("Hello, " + name + "! Welcome to RocketOS 🚀");
        for (int i = 3; i > 0; i--) System.out.println(i + "...");
        System.out.println("Liftoff!");
    }
}`,
      bash: `#!/bin/bash
read -p "What's your name? " name
echo "Hello, $name! Welcome to RocketOS 🚀"
for i in 3 2 1; do echo "$i..."; sleep 0.3; done
echo "Liftoff!"
echo "You are running on: $(uname -sr)"`,
    };
    const LANG_SNIPPETS = {
      c: [['Loop', 'for (int i = 0; i < 10; i++) {\n    printf("%d\\n", i);\n}'], ['Function', 'int square(int x) {\n    return x * x;\n}'], ['Read number', 'int n;\nscanf("%d", &n);'], ['Write file', 'FILE *f = fopen("out.txt", "w");\nfprintf(f, "hello\\n");\nfclose(f);']],
      cpp: [['Loop', 'for (int i = 0; i < 10; i++) std::cout << i << "\\n";'], ['Vector', 'std::vector<int> v{3, 1, 2};\nstd::sort(v.begin(), v.end());'], ['Function', 'int square(int x) { return x * x; }'], ['Read line', 'std::string line;\nstd::getline(std::cin, line);']],
      python: [['Loop', 'for i in range(10):\n    print(i)'], ['Function', 'def square(x):\n    return x * x'], ['Read number', 'n = int(input("Number: "))'], ['List comprehension', 'squares = [x * x for x in range(10)]'], ['Class', 'class Rocket:\n    def __init__(self, name):\n        self.name = name\n\n    def launch(self):\n        print(f"{self.name} launched!")']],
      rust: [['Loop', 'for i in 0..10 {\n    println!("{}", i);\n}'], ['Function', 'fn square(x: i64) -> i64 {\n    x * x\n}'], ['Struct', 'struct Rocket {\n    name: String,\n}'], ['Read number', 'let mut s = String::new();\nstd::io::stdin().read_line(&mut s).unwrap();\nlet n: i64 = s.trim().parse().unwrap();']],
      go: [['Loop', 'for i := 0; i < 10; i++ {\n\tfmt.Println(i)\n}'], ['Function', 'func square(x int) int {\n\treturn x * x\n}'], ['Slice', 'nums := []int{3, 1, 2}\nsort.Ints(nums)']],
      javascript: [['Loop', 'for (let i = 0; i < 10; i++) console.log(i);'], ['Function', 'const square = x => x * x;'], ['Write file', "require('fs').writeFileSync('out.txt', 'hello');"], ['Fetch (Node 18+)', "const res = await fetch('https://example.com');"]],
      ruby: [['Loop', '10.times { |i| puts i }'], ['Method', 'def square(x)\n  x * x\nend'], ['Hash', 'rocket = { name: "Falcon", stages: 2 }']],
      lua: [['Loop', 'for i = 1, 10 do print(i) end'], ['Function', 'local function square(x) return x * x end'], ['Table', 'local rocket = { name = "Falcon", stages = 2 }']],
      java: [['Loop', 'for (int i = 0; i < 10; i++) System.out.println(i);'], ['Method', 'static int square(int x) { return x * x; }'], ['List', 'java.util.List<String> names = new java.util.ArrayList<>();']],
      bash: [['Loop', 'for i in {1..10}; do echo "$i"; done'], ['Function', 'greet() {\n  echo "Hello, $1"\n}'], ['If', 'if [ -f file.txt ]; then\n  echo exists\nfi'], ['System info', 'uname -a\nfree -h\nip -br addr']],
    };

    let app = JSON.parse(JSON.stringify(templates['Hello World']));
    app.meta.author = OS.settings.username; app.meta.version = '1.0';

    // ---- UI
    const fld = (key, label, type = 'text') => { const i = h('input', { class: 'input sm', type, value: app.meta[key] ?? '' }); i.addEventListener('input', () => { app.meta[key] = type === 'number' ? +i.value : i.value; changed(); }); i.dataset.key = key; return h('label', { class: 'am-field' }, h('span', {}, label), i); };
    const metaBox = h('div', { class: 'am-meta' });
    const renderMeta = () => { metaBox.innerHTML = ''; metaBox.append(h('b', {}, 'App info'), fld('name', 'Name'), fld('icon', 'Icon (emoji)'), fld('description', 'Description'), fld('category', 'Category'), fld('version', 'Version'), fld('author', 'Author'), h('div', { class: 'row' }, fld('width', 'Width', 'number'), fld('height', 'Height', 'number'))); };
    const palette = h('div', { class: 'am-palette' });
    const isNat = () => ESL.isNative(app.meta);
    const renderPalette = () => { palette.innerHTML = ''; palette.append(h('b', {}, isNat() ? Programs.LANGS[app.meta.runtime].name + ' snippets' : tab === 'js' ? 'Code snippets' : tab === 'html' ? 'Components' : 'Styles'));
      const list = isNat() ? (LANG_SNIPPETS[app.meta.runtime] || []) : tab === 'js' ? snippets : tab === 'html' ? components : [['Center', 'body { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; margin:0; }'], ['Dark bg', 'body { background:#111; color:#eee; }'], ['Gradient', 'body { background: linear-gradient(135deg, #667eea, #764ba2); color:#fff; }'], ['Big buttons', 'button { font-size:18px; padding:10px 20px; border-radius:10px; }'], ['Card', '.card { padding:16px; border-radius:14px; box-shadow:0 4px 20px #0003; }']];
      list.forEach(([n, code]) => palette.append(h('button', { class: 'am-comp', onclick: () => insert(code) }, '＋ ' + n))); };
    const tabsEl = h('div', { class: 'seg am-tabs' });
    const code = h('textarea', { class: 'am-code', spellcheck: 'false', wrap: 'off' });
    const preview = h('iframe', { class: 'am-preview', sandbox: 'allow-scripts allow-modals' });
    const consoleEl = h('div', { class: 'am-console' });
    const autoRun = h('input', { type: 'checkbox', checked: true });
    const status = h('span', { class: 'muted small' });
    const langSel = h('select', { class: 'input sm am-lang', title: 'Language' }, h('option', { value: 'web' }, '🌐 Web app (HTML/CSS/JS)'),
      ...Object.entries(Programs.LANGS).map(([k, L]) => h('option', { value: k }, `${L.icon} ${L.name}` + (Programs.available() ? '' : ' — OS version'))));
    if (Programs.available()) Native.programs.langs().then(av => [...langSel.options].forEach(o => { if (av[o.value] && !av[o.value].available) { o.disabled = true; o.textContent += ' (not installed)'; } })).catch(() => {});
    langSel.onchange = () => setLang(langSel.value);
    const outEl = h('div', { class: 'prog-out' }), outIn = h('input', { class: 'prog-in', placeholder: 'Program input — type and press Enter', spellcheck: 'false' });
    const runNative = h('button', { class: 'btn sm primary' }, '▶ Run'), stopNative = h('button', { class: 'btn sm' }, '■ Stop');
    const term = Programs.console(outEl, outIn, { onState: r => { runNative.disabled = r; stopNative.disabled = !r; } });
    stopNative.disabled = true;
    runNative.onclick = () => term.run(app.meta.runtime, app.code || '');
    stopNative.onclick = () => term.stop();
    const webPane = h('div', { class: 'am-out' }), outPane = h('div', { class: 'am-out program' }, h('div', { class: 'prog-bar' }, h('b', {}, '🖥️ Output'), h('div', { class: 'tb-spacer' }), stopNative, runNative), outEl, outIn);
    const webOnly = [];
    const tplSel = h('select', { class: 'input sm' }, h('option', { value: '' }, '📋 Templates…'), ...Object.keys(templates).map(k => h('option', {}, k)));
    tplSel.onchange = async () => { const k = tplSel.value; tplSel.value = ''; if (!k) return; if (dirty && !(await OS.confirm('Replace current app with the template?'))) return; app = JSON.parse(JSON.stringify(templates[k])); app.meta.author = OS.settings.username; app.meta.version = '1.0'; path = null; dirty = false; load(); };
    const tb = h('div', { class: 'am-toolbar' },
      h('button', { class: 'btn sm', onclick: () => newApp() }, '📄 New'), h('button', { class: 'btn sm', onclick: () => openApp() }, '📂 Open'), h('button', { class: 'btn sm', onclick: () => save() }, '💾 Save'), h('button', { class: 'btn sm', onclick: () => saveAs() }, 'Save As…'), langSel, tplSel,
      h('div', { class: 'tb-spacer' }), webOnly[webOnly.push(h('label', { class: 'small' }, autoRun, ' Live preview')) - 1], webOnly[webOnly.push(h('button', { class: 'btn sm', onclick: () => refresh() }, '⟳ Preview')) - 1],
      h('button', { class: 'btn sm', onclick: () => run() }, '▶ Run in window'), h('button', { class: 'btn sm', onclick: () => shortcut() }, '🔗 Desktop shortcut'),
      h('button', { class: 'btn sm', onclick: e => { const r = e.target.getBoundingClientRect(); OS.contextMenu(r.left, r.bottom, [
        { icon: '🧩', label: 'Export .esl app', action: () => h('a', { href: URL.createObjectURL(new Blob([eslText()])), download: (app.meta.name || 'app').replace(/\W+/g, '-') + '.esl' }).click() },
        { icon: '📄', label: 'Export source file', disabled: !isNat(), action: () => h('a', { href: URL.createObjectURL(new Blob([app.code || ''])), download: srcName() }).click() },
        { icon: '💾', label: 'Save source to ~/code', disabled: !isNat(), action: () => { const p = VFS.home() + '/code/' + srcName(); VFS.write(p, app.code || ''); OS.notify('App Maker', 'Saved ' + p, '💾'); } }]); } }, '⬇️ Export'),
      h('button', { class: 'btn sm primary', onclick: () => publish() }, '🚀 Publish'));
    win.body.append(h('div', { class: 'appmaker' }, tb, h('div', { class: 'am-main' }, h('div', { class: 'am-left' }, metaBox, palette), h('div', { class: 'am-center' }, tabsEl, code), h('div', { class: 'am-right' }, webPane, outPane))));
    webPane.append(h('div', { class: 'am-ph' }, '👁️ Preview ', status), preview, h('div', { class: 'am-ph' }, '🐞 Console'), consoleEl);

    const srcName = () => (app.meta.runtime === 'java' ? 'Main' : (app.meta.name || 'main').replace(/\W+/g, '_').toLowerCase()) + '.' + (Programs.LANGS[app.meta.runtime] || { ext: 'txt' }).ext;
    const renderTabs = () => { tabsEl.innerHTML = '';
      if (isNat()) { tab = 'code'; tabsEl.append(h('button', { class: 'on' }, `${Programs.LANGS[app.meta.runtime].icon} ${app.meta.runtime === 'java' ? 'Main.java' : 'main.' + Programs.LANGS[app.meta.runtime].ext}`)); return; }
      if (tab === 'code') tab = 'html'; [['html', 'HTML'], ['css', 'CSS'], ['js', 'JavaScript']].forEach(([k, l]) => tabsEl.append(h('button', { class: k === tab ? 'on' : '', onclick: () => { tab = k; code.value = app[k]; renderTabs(); renderPalette(); } }, l))); };
    const eslText = () => ESL.serialize(app);
    const title = () => win.setTitle(`App Maker — ${dirty ? '• ' : ''}${path ? VFS.basename(path) : app.meta.name + ' (unsaved)'}`);
    let pt; function changed() { dirty = true; title(); if (!isNat() && autoRun.checked) { clearTimeout(pt); pt = setTimeout(refresh, 500); } }
    function insert(s) { const st = code.selectionStart; code.setRangeText((code.value && st > 0 && code.value[st - 1] !== '\n' ? '\n' : '') + s + '\n', st, code.selectionEnd, 'end'); app[tab] = code.value; changed(); code.focus(); }
    function refresh() {
      if (isNat()) return;
      consoleEl.innerHTML = '';
      const doc = ESL.buildDoc(app).replace('<script>', `<script>(function(){const send=(t,a)=>parent.postMessage({__amlog:1,t,a:[...a].map(x=>{try{return typeof x==='object'?JSON.stringify(x):String(x)}catch{return String(x)}}).join(' ')},'*');['log','warn','error','info'].forEach(k=>{const o=console[k];console[k]=(...a)=>{send(k,a);o.apply(console,a)}});addEventListener('error',e=>send('error',[e.message+' (line '+e.lineno+')']));})();`);
      preview.srcdoc = doc; status.textContent = `${app.meta.width}×${app.meta.height}`;
    }
    // preview's os.* calls are answered by a minimal mock so live preview never touches your files
    const onMsg = async e => {
      if (e.source !== preview.contentWindow || !e.data) return;
      const d = e.data;
      if (d.__amlog) { consoleEl.append(h('div', { class: 'am-log ' + d.t }, (d.t === 'error' ? '❌ ' : d.t === 'warn' ? '⚠️ ' : '› ') + d.a)); consoleEl.scrollTop = consoleEl.scrollHeight; return; }
      if (!d.__esl) return;
      if (d.method === 'error') { consoleEl.append(h('div', { class: 'am-log error' }, '❌ ' + d.args[0])); return; }
      let result = null, error = null;
      const [a, b] = d.args || [];
      try {
        if (d.method === 'notify') OS.notify(String(a || app.meta.name) + ' (preview)', String(b || ''), app.meta.icon);
        else if (d.method === 'alert') await OS.alert(String(a), app.meta.name);
        else if (d.method === 'prompt') result = await OS.prompt(String(a), b || '', app.meta.name);
        else if (d.method === 'storage.get') result = JSON.parse(sessionStorage.getItem('am.' + a) || 'null');
        else if (d.method === 'storage.set') { sessionStorage.setItem('am.' + a, JSON.stringify(b)); result = true; }
        else if (d.method === 'fs.read') result = VFS.read(VFS.normalize(a, VFS.home()));
        else if (d.method === 'fs.list') result = VFS.list(VFS.normalize(a || '~', VFS.home()));
        else if (d.method === 'fs.exists') result = VFS.exists(VFS.normalize(a, VFS.home()));
        else if (['fs.write', 'fs.mkdir', 'fs.remove'].includes(d.method)) { consoleEl.append(h('div', { class: 'am-log warn' }, `⚠️ ${d.method}('${a}') skipped in preview — use ▶ Run to allow file changes`)); result = true; }
        else if (d.method === 'run') result = await Shell.exec(String(a));
        else if (d.method === 'time') result = new Date().toISOString();
        else if (d.method === 'online') result = NET.online();
        else consoleEl.append(h('div', { class: 'am-log' }, `› os.${d.method}(${(d.args || []).join(', ')}) (preview)`));
      } catch (err) { error = err.message; }
      e.source.postMessage({ __eslReply: 1, id: d.id, result, error }, '*');
    };
    addEventListener('message', onMsg); win.onClose(() => removeEventListener('message', onMsg));

    code.addEventListener('input', () => { app[tab] = code.value; changed(); });
    code.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); code.setRangeText('  ', code.selectionStart, code.selectionEnd, 'end'); app[tab] = code.value; changed(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); save(); }
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); isNat() ? runNative.click() : run(); }
    });
    function load() {
      app.meta.runtime = app.meta.runtime || 'web'; app.code = app.code || '';
      langSel.value = app.meta.runtime;
      const nat = isNat();
      webPane.style.display = nat ? 'none' : ''; outPane.style.display = nat ? '' : 'none';
      webOnly.forEach(el => el.style.display = nat ? 'none' : '');
      renderMeta(); renderTabs(); renderPalette(); code.value = app[tab] || ''; title(); refresh();
      if (nat && !term.running) { outEl.innerHTML = ''; term.write(Programs.available() ? '\x1b[90mPress ▶ Run (Ctrl+Enter) to build and run your program.\x1b[0m\n' : `\x1b[33m${Programs.LANGS[app.meta.runtime].name} programs run on the RocketOS operating system (the bootable version). You can still write, save and publish them here.\x1b[0m\n`); }
    }
    function setLang(lang) {
      const old = app.meta.runtime || 'web';
      if (lang === old) return;
      const pristine = !app.code || Object.values(LANG_TEMPLATES).includes(app.code);
      app.meta.runtime = lang;
      if (lang !== 'web' && pristine) app.code = LANG_TEMPLATES[lang];
      if (lang !== 'web' && (!app.meta.icon || app.meta.icon === '👋' || Object.values(Programs.LANGS).some(L => L.icon === app.meta.icon))) app.meta.icon = Programs.LANGS[lang].icon;
      dirty = true; load();
    }
    async function newApp() { if (dirty && !(await OS.confirm('Discard unsaved changes?'))) return; app = JSON.parse(JSON.stringify(templates.Blank)); app.meta.author = OS.settings.username; app.meta.version = '1.0'; path = null; dirty = false; load(); }
    function loadPath(p) { try { const parsed = ESL.parse(VFS.read(p)); if (parsed.meta.builtin) { OS.alert(`${parsed.meta.name} is a built-in system app and can’t be edited. Try a template or a store app instead.`, 'App Maker', 'ℹ️'); return; } app = parsed; path = p; dirty = false; load(); } catch (e) { OS.alert(e.message, 'Open', '⚠️'); } }
    async function openApp() { const p = await OS.prompt('Open .esl file:', VFS.home() + '/apps/', 'App Maker', { icon: '📂' }); if (p) loadPath(VFS.normalize(p, VFS.home())); }
    async function save() { if (!path) return saveAs(); VFS.write(path, eslText()); dirty = false; title(); OS.notify('App Maker', `Saved ${VFS.basename(path)}`, '💾'); }
    async function saveAs() { const p = await OS.prompt('Save app as:', VFS.home() + '/apps/' + (app.meta.name || 'app').replace(/[\/]/g, '-') + '.esl', 'Save As', { icon: '💾' }); if (!p) return; path = VFS.normalize(p.endsWith('.esl') ? p : p + '.esl', VFS.home()); await save(); }
    function run() { ESL.runText(eslText(), path || app.meta.name); }
    async function shortcut() { if (!path) await saveAs(); if (!path) return; HSL.create(VFS.home() + '/Desktop', app.meta.name, path, app.meta.icon); OS.notify('App Maker', 'Shortcut added to the Desktop', '🔗'); }
    async function publish() {
      if (!app.meta.description) { const d = await OS.prompt('Describe your app for the App Store:', '', 'Publish', { icon: '🚀' }); if (d == null) return; app.meta.description = d; renderMeta(); }
      if (!(await OS.confirm(`Publish “${app.meta.name}” ${app.meta.icon} to the App Store? It will appear in the Community section.`, 'Publish', '🚀'))) return;
      try { if (path) VFS.write(path, eslText()); const e = Store.publish(eslText()); OS.notify('App Store', `🎉 ${e.name} is live in the App Store!`, '🚀', { action: () => OS.launch('store', { detail: e.id }) }); }
      catch (err) { OS.alert(err.message, 'Publish', '⚠️'); }
    }
    win.beforeClose = async () => !dirty || OS.confirm('Close App Maker without saving?');
    if (args.path) loadPath(args.path); else load();
  } });
