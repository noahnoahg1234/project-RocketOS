# 🚀 RocketOS

RocketOS is a Unix-style desktop operating system that runs in your web browser. It has a real file tree, a shell with ~90 commands, a window manager and its own file formats for apps, batch scripts and shortcuts.

## Run it

You don't need to build or install anything. Either:

- open `index.html` in a browser, or
- serve the folder and visit it (recommended):
  ```bash
  python3 -m http.server 8000
  ```
  Then go to http://localhost:8000

Everything you create (files, settings, installed and published apps) is saved in the browser's `localStorage`.

## Features

| Area | What you get |
|---|---|
| **Unix-style core** | Files and folders in a tree (`/bin`, `/etc`, `/apps`, `/home/<user>`, `/tmp`, `/var/log`), permissions shown by `ls -l`, process list, `kill`, system log |
| **File formats** | **`.esl`** apps · **`.log`** batch scripts · **`.hsl`** shortcuts (see below) |
| **Advanced terminal** | `rsh` shell: tabs, 5 colour themes, zoom, history, tab completion, pipes `\|`, redirects `> >> <`, `; && \|\|`, `$VARS`, globs, aliases, `for`/`if`/`while` one-liners, `read`, `top`, `curl`, `wifi`, `neofetch`, `ai` and more |
| **Classic wallpaper** | A retro "RocketOS Classic" space scene drawn in SVG, plus Classic Teal, Sunset Hills, Retro Grid, Nebula and more. You can also upload your own image or use a URL or colour |
| **Classic Start menu** | Grey bevelled menu with a vertical banner and cascading Programs ▸ Accessories / Games / … , Documents, Settings, Find, Help, Run…, Log Off, Shut Down |
| **Advanced taskbar** | Quick Launch, pinned apps, window buttons that show a preview on hover and have right-click menus, a live CPU graph, system tray (AI, Wi-Fi, volume, battery, notifications), clock with calendar, Show Desktop. Comes in Modern glass and Classic styles |
| **Top bar** | Menus for the focused app, search (Ctrl+Space), widgets toggle, Rocky AI, control center, Wi-Fi, battery, date and time, notifications |
| **Widgets** | Analog clock, calendar, weather, system monitor, sticky note, to-do. You can drag them, and their positions are saved |
| **Wi-Fi** | Network list with signal strength and security, password prompts, saved networks, turn Wi-Fi on/off, airplane mode, and `wifi` / `ifconfig` / `ping` in the terminal. It also reports whether the device itself is online |
| **Rocky AI** | Built-in assistant. It can open apps, change settings, run commands, do maths, set reminders and create notes. Optional **Cloud mode** uses Claude through the Anthropic SDK when you add an API key |
| **Apps** | Files, Terminal, Rocket Write (editor), Calculator (scientific), Clock (world / stopwatch / timer / alarms), Calendar, Notes, Paint, Rocket Tunes (piano, drums, songs), Rocket Browser (tabs and bookmarks), Weather, System Monitor, Settings, Guide, About, Image Viewer |
| **10 games** | Snake, Block Drop, Paddle Duel, Brick Smash, Rocket Hop, Star Blaster, Mine Field, Doubler, Tic-Tac-Toe (with an unbeatable AI), Memory Match |
| **App Store** | Featured apps, categories, search, ratings, download counts, install and uninstall. Store apps are installed to `/apps/store` |
| **Publish apps** | App Maker → **🚀 Publish** (or upload a `.esl` file). Published apps show up under **Community** |
| **App Maker** | Edit the HTML, CSS and JS of an `.esl` app with a live preview and console. Includes templates, drag-in components and code snippets. You can save, run, export, add a desktop shortcut or publish |

## File formats

### `.esl` — RocketOS application
```
#!esl
name: Hello
icon: 👋
version: 1.0
width: 360
height: 240
---html
<h1>Hello!</h1><button id="b">Greet</button>
---css
body { text-align: center; padding: 20px }
---js
b.onclick = () => os.notify('Hi', 'From my app');
```
Apps run in a sandboxed iframe and get an `os` API:
- `os.notify`, `os.alert`, `os.prompt`
- `os.fs.read`, `os.fs.write`, `os.fs.list`, `os.fs.exists`, `os.fs.mkdir`, `os.fs.remove`
- `os.storage.get`, `os.storage.set`
- `os.open`, `os.launch`, `os.run`, `os.setTitle`, `os.close`

### `.log` — batch script
One shell command per line. Lines starting with `#`, `::` or `rem` are comments. Arguments are available as `$1 … $@ $#`.
```
# backup.log
mkdir -p ~/backup
cp ~/Documents/* ~/backup
if test -d ~/backup; then notify Backup "Done!"; fi
```
Run a script by double-clicking it, with `./backup.log`, or with `run backup.log`. `~/.startup.log` runs every time RocketOS boots.

### `.hsl` — shortcut
```
[Shortcut]
name=Snake
icon=🐍
target=app:snake
```
A target can be `app:<id>`, `/absolute/path`, `url:https://…` or `cmd:<shell command>`.

## Tips
- Home Wi-Fi: **RocketNet-5G**, password `rocket123`.
- Shortcuts:
  - **Ctrl+Alt+T** opens a terminal
  - **Ctrl+Space** opens search
  - **Ctrl+Alt+D** shows the desktop
  - **Alt+F4** closes a window
- Drag a window to the top edge to maximise it, or to the left/right edge to snap it.
- Settings → System lets you back up or restore all your files, or do a factory reset.
- Rocky's Cloud mode stores your API key only in this browser and sends requests straight to `api.anthropic.com`.

## Project layout
```
index.html          entry point
css/os.css          all styles (themes, start menu, taskbar, apps)
js/fs.js            virtual Unix file system
js/core.js          kernel: settings, app registry, processes, dialogs, notifications, sound
js/net.js           Wi-Fi manager
js/wm.js            window manager
js/formats.js       .esl / .hsl runtimes
js/shell.js         desktop, top bar, taskbar, Start menu, search, popups
js/widgets.js       desktop widgets + weather service
js/terminal.js      rsh shell + Terminal app (.log runner)
js/apps/*.js        system apps, Rocky AI, App Store, App Maker
js/games/*.js       10 games
js/boot.js          BIOS/splash, lock screen, first-run file system
```
