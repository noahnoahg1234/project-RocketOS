#!/usr/bin/env python3
"""rocketd — the RocketOS system daemon.

Serves the RocketOS desktop (the HTML/CSS/JS in /usr/share/rocketos/www) on 127.0.0.1
and exposes a small JSON API so that code can control the real machine:
Wi-Fi (NetworkManager), power, volume, system stats and running Linux commands.

Every /api request must carry the X-Rocket-Token header. The token is generated at
start-up and written to /run/rocketos/token, readable only by root and the desktop user.
A custom header can't be sent cross-origin without a CORS preflight, which this server
never approves, so other web pages can't drive the API.
"""
import json
import os
import pty
import secrets
import shutil
import signal
import subprocess
import tempfile
import termios
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HOST, PORT = "127.0.0.1", int(os.environ.get("ROCKETD_PORT", "7070"))
WWW = os.environ.get("ROCKETD_WWW", "/usr/share/rocketos/www")
USER = os.environ.get("ROCKETD_USER", "rocket")
RUN_DIR = os.environ.get("ROCKETD_RUN", "/run/rocketos")
VERSION = "1.0.0"
TOKEN = secrets.token_hex(24)


def run(args, timeout=15):
    """Run a command (argument list, never a shell string). Returns (code, stdout+stderr)."""
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout + p.stderr).strip()
    except FileNotFoundError:
        return 127, f"{args[0]}: not installed"
    except subprocess.TimeoutExpired:
        return 124, "timed out"


def nm_fields(line):
    """Split one line of `nmcli -t` output (':' separated, '\\:' escaped)."""
    out, cur, i = [], "", 0
    while i < len(line):
        c = line[i]
        if c == "\\" and i + 1 < len(line):
            cur += line[i + 1]
            i += 2
            continue
        if c == ":":
            out.append(cur)
            cur = ""
        else:
            cur += c
        i += 1
    out.append(cur)
    return out


# ------------------------------------------------------------------ network
def wifi_device():
    code, out = run(["nmcli", "-t", "-f", "DEVICE,TYPE,STATE", "device"])
    if code:
        return None, []
    devs = [nm_fields(l) for l in out.splitlines() if l]
    wifi = next((d[0] for d in devs if len(d) > 1 and d[1] == "wifi"), None)
    return wifi, devs


def net_state(rescan=False):
    wifi, devs = wifi_device()
    rc, radio = run(["nmcli", "-t", "-f", "WIFI", "radio"])
    cc, conn = run(["nmcli", "-t", "-f", "CONNECTIVITY", "general"])
    radio, conn = (radio if rc == 0 else ""), (conn if cc == 0 else "unknown")
    _, known_out = run(["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show"])
    known = {nm_fields(l)[0] for l in known_out.splitlines() if "wireless" in l}
    networks, connected = [], None
    if wifi:
        args = ["nmcli", "-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY,FREQ", "device", "wifi", "list", "--rescan", "yes" if rescan else "auto"]
        _, out = run(args, timeout=25)
        seen = set()
        for l in out.splitlines():
            f = nm_fields(l)
            if len(f) < 5 or not f[1] or f[1] in seen:
                continue
            seen.add(f[1])
            freq = f[4].split()[0] if f[4] else "0"
            n = {"ssid": f[1], "signal": int(f[2] or 0), "security": f[3] or "Open",
                 "band": "5 GHz" if freq.isdigit() and int(freq) > 4000 else "2.4 GHz",
                 "known": f[1] in known, "connected": f[0] == "*"}
            networks.append(n)
            if n["connected"]:
                connected = dict(n, type="wifi", device=wifi)
    # fall back to a wired connection (e.g. in a virtual machine)
    if not connected:
        eth = next((d for d in devs if len(d) > 2 and d[1] == "ethernet" and d[2] == "connected"), None)
        if eth:
            connected = {"ssid": "Wired connection", "signal": 100, "security": "Ethernet", "band": "Ethernet", "type": "ethernet", "device": eth[0]}
    if connected:
        _, ipo = run(["nmcli", "-t", "-f", "IP4.ADDRESS,IP4.GATEWAY,IP4.DNS,GENERAL.HWADDR", "device", "show", connected["device"]])
        for l in ipo.splitlines():
            k, _, v = l.partition(":")
            if k.startswith("IP4.ADDRESS") and "ip" not in connected:
                connected["ip"] = v.split("/")[0]
            elif k == "IP4.GATEWAY":
                connected["gateway"] = v
            elif k.startswith("IP4.DNS") and "dns" not in connected:
                connected["dns"] = v
            elif k == "GENERAL.HWADDR":
                connected["mac"] = v.replace("\\", "").lower()
    return {"enabled": radio.strip() == "enabled", "hasWifi": bool(wifi), "connectivity": conn.strip() or "unknown",
            "online": conn.strip() == "full", "connected": connected, "networks": sorted(networks, key=lambda n: -n["signal"])}


# ------------------------------------------------------------------ system stats
_last_cpu = None


def cpu_percent():
    global _last_cpu
    with open("/proc/stat") as f:
        vals = [int(x) for x in f.readline().split()[1:]]
    idle, total = vals[3] + (vals[4] if len(vals) > 4 else 0), sum(vals)
    pct = 0.0
    if _last_cpu:
        di, dt = idle - _last_cpu[0], total - _last_cpu[1]
        pct = 100.0 * (1 - di / dt) if dt else 0.0
    _last_cpu = (idle, total)
    return round(pct, 1)


def sys_state():
    mem = {}
    with open("/proc/meminfo") as f:
        for l in f:
            k, v = l.split(":")
            mem[k] = int(v.split()[0])
    battery = None
    base = "/sys/class/power_supply"
    if os.path.isdir(base):
        for d in sorted(os.listdir(base)):
            try:
                with open(f"{base}/{d}/type") as f:
                    if f.read().strip() != "Battery":
                        continue
                with open(f"{base}/{d}/capacity") as f:
                    cap = int(f.read().strip())
                with open(f"{base}/{d}/status") as f:
                    st = f.read().strip()
                battery = {"level": cap, "charging": st in ("Charging", "Full")}
                break
            except OSError:
                pass
    with open("/proc/uptime") as f:
        up = float(f.read().split()[0])
    return {"cpu": cpu_percent(), "memTotal": mem["MemTotal"] // 1024,
            "memUsed": (mem["MemTotal"] - mem.get("MemAvailable", mem["MemFree"])) // 1024,
            "battery": battery, "uptime": up, "kernel": os.uname().release, "machine": os.uname().machine,
            "cpus": os.cpu_count(), "loadavg": os.getloadavg()[0]}


# ------------------------------------------------------------------ programs (App Maker native languages)
# Each language: file name, the tool that must be installed, and the shell command that builds + runs it.
LANGS = {
    "c":          {"name": "C",          "file": "main.c",    "needs": "gcc",     "run": "gcc -O2 -Wall -o prog main.c -lm && ./prog"},
    "cpp":        {"name": "C++",        "file": "main.cpp",  "needs": "g++",     "run": "g++ -O2 -Wall -std=c++20 -o prog main.cpp && ./prog"},
    "python":     {"name": "Python",     "file": "main.py",   "needs": "python3", "run": "python3 -u main.py"},
    "rust":       {"name": "Rust",       "file": "main.rs",   "needs": "rustc",   "run": "rustc -O --edition 2021 -o prog main.rs && ./prog"},
    "go":         {"name": "Go",         "file": "main.go",   "needs": "go",      "run": "go run main.go"},
    # readline's "terminal" mode redraws the line with cursor codes and echoes input; the UI echoes already.
    "javascript": {"name": "JavaScript (Node.js)", "file": "main.js", "needs": "node", "run": "node -r ./.rocket-preload.js main.js",
                   "extra": {".rocket-preload.js": "process.stdout.isTTY = false; process.stdin.isTTY = false;\n"}},
    "ruby":       {"name": "Ruby",       "file": "main.rb",   "needs": "ruby",    "run": "ruby main.rb"},
    "lua":        {"name": "Lua",        "file": "main.lua",  "needs": "lua5.4",  "run": "lua5.4 main.lua"},
    "java":       {"name": "Java",       "file": "Main.java", "needs": "java",    "run": "java Main.java"},
    "bash":       {"name": "Bash",       "file": "main.sh",   "needs": "bash",    "run": "bash main.sh"},
}


SYS_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"


def has_tool(name):
    return bool(shutil.which(name, path=SYS_PATH))


def langs():
    return {k: {"name": v["name"], "file": v["file"], "available": has_tool(v["needs"])} for k, v in LANGS.items()}


class Proc:
    """A program running in a pseudo-terminal, so prompts and colours work like in a real terminal."""
    MAX_OUT = 2_000_000

    def __init__(self, lang, code):
        spec = LANGS[lang]
        self.dir = tempfile.mkdtemp(prefix="rocket-run-")
        with open(os.path.join(self.dir, spec["file"]), "w") as f:
            f.write(code)
        for name, content in spec.get("extra", {}).items():
            with open(os.path.join(self.dir, name), "w") as f:
                f.write(content)
        env = {"PATH": SYS_PATH, "TERM": "xterm-256color",
               "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "PYTHONUNBUFFERED": "1"}
        cmd = ["bash", "-c", spec["run"]]
        if os.geteuid() == 0:  # never run user programs as root
            import pwd
            pw = pwd.getpwnam(USER)
            for root, dirs, files in os.walk(self.dir):
                os.chown(root, pw.pw_uid, pw.pw_gid)
                for n in files:
                    os.chown(os.path.join(root, n), pw.pw_uid, pw.pw_gid)
            env.update(HOME=pw.pw_dir, USER=USER, LOGNAME=USER, GOCACHE=os.path.join(pw.pw_dir, ".cache/go-build"))
            cmd = ["runuser", "-u", USER, "--"] + cmd
        else:
            env.update(HOME=os.environ.get("HOME", self.dir), GOCACHE=os.path.join(self.dir, ".gocache"))
        master, slave = pty.openpty()
        attrs = termios.tcgetattr(slave)
        attrs[3] &= ~termios.ECHO  # the UI shows what you type itself
        termios.tcsetattr(slave, termios.TCSANOW, attrs)
        self.p = subprocess.Popen(cmd, stdin=slave, stdout=slave, stderr=slave, cwd=self.dir, env=env, start_new_session=True)
        os.close(slave)
        self.master, self.out, self.lock, self.code, self.started = master, b"", threading.Lock(), None, time.time()
        threading.Thread(target=self._pump, daemon=True).start()

    def _pump(self):
        while True:
            try:
                data = os.read(self.master, 65536)
            except OSError:
                data = b""
            if not data:
                break
            with self.lock:
                self.out = (self.out + data)[-self.MAX_OUT:]
        self.code = self.p.wait()
        os.close(self.master)
        shutil.rmtree(self.dir, ignore_errors=True)

    def read(self, since):
        with self.lock:
            data = self.out[since:] if since <= len(self.out) else b""
            return {"out": data.decode("utf-8", "replace"), "next": len(self.out), "done": self.code is not None, "code": self.code}

    def write(self, text):
        if self.code is None:
            try:
                os.write(self.master, text.encode())
            except OSError:
                pass

    def kill(self):
        if self.code is None:
            try:
                os.killpg(self.p.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass


PROCS = {}


def reap():
    """Forget finished programs after a while and stop ones that have run for more than 2 hours."""
    now = time.time()
    for pid, pr in list(PROCS.items()):
        if pr.code is None and now - pr.started > 7200:
            pr.kill()
        if pr.code is not None and now - pr.started > 600:
            PROCS.pop(pid, None)


# ------------------------------------------------------------------ HTTP
class Handler(SimpleHTTPRequestHandler):
    server_version = "rocketd/" + VERSION

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WWW, **kw)

    def log_message(self, fmt, *args):  # quieter journal: only log API calls
        if self.path.startswith("/api"):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def reply(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authed(self):
        if self.headers.get("X-Rocket-Token") != TOKEN:
            self.reply({"error": "forbidden"}, 403)
            return False
        return True

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 1_000_000:
            return {}
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return {}

    def do_OPTIONS(self):  # never approve cross-origin preflights
        self.send_response(403)
        self.end_headers()

    def do_GET(self):
        if not self.path.startswith("/api/"):
            return super().do_GET()
        if not self.authed():
            return
        p = self.path.split("?")[0]
        if p == "/api/ping":
            return self.reply({"ok": True, "version": VERSION, "hostname": os.uname().nodename, "kernel": os.uname().release})
        if p == "/api/net":
            return self.reply(net_state(rescan="rescan=1" in self.path))
        if p == "/api/sys":
            return self.reply(sys_state())
        if p == "/api/langs":
            return self.reply(langs())
        if p == "/api/proc/read":
            q = dict(kv.split("=", 1) for kv in self.path.partition("?")[2].split("&") if "=" in kv)
            pr = PROCS.get(q.get("id", ""))
            return self.reply(pr.read(int(q.get("since", "0"))) if pr else {"error": "no such program"}, 200 if pr else 404)
        self.reply({"error": "not found"}, 404)

    def do_POST(self):
        if not self.path.startswith("/api/") or not self.authed():
            if not self.path.startswith("/api/"):
                self.reply({"error": "not found"}, 404)
            return
        p, b = self.path, self.body()
        if p == "/api/net/connect":
            ssid, pw = str(b.get("ssid", "")), b.get("password")
            if not ssid:
                return self.reply({"ok": False, "error": "missing ssid"}, 400)
            args = ["nmcli", "device", "wifi", "connect", ssid]
            if pw:
                args += ["password", str(pw)]
            code, out = run(args, timeout=45)
            if code and pw is None:  # a saved profile may exist
                code, out = run(["nmcli", "connection", "up", "id", ssid], timeout=45)
            return self.reply({"ok": code == 0, "error": None if code == 0 else out})
        if p == "/api/net/disconnect":
            wifi, _ = wifi_device()
            code, out = run(["nmcli", "device", "disconnect", wifi]) if wifi else (1, "no Wi-Fi device")
            return self.reply({"ok": code == 0, "error": None if code == 0 else out})
        if p == "/api/net/radio":
            code, out = run(["nmcli", "radio", "wifi", "on" if b.get("enabled") else "off"])
            return self.reply({"ok": code == 0, "error": None if code == 0 else out})
        if p == "/api/net/forget":
            code, out = run(["nmcli", "connection", "delete", "id", str(b.get("ssid", ""))])
            return self.reply({"ok": code == 0, "error": None if code == 0 else out})
        if p == "/api/power":
            action = {"shutdown": "poweroff", "reboot": "reboot", "restart": "reboot", "suspend": "suspend"}.get(b.get("action"))
            if not action:
                return self.reply({"ok": False, "error": "bad action"}, 400)
            self.reply({"ok": True})
            time.sleep(0.3)
            subprocess.Popen(["systemctl", action])
            return
        if p == "/api/volume":
            level = max(0, min(100, int(b.get("level", 70))))
            code, out = run(["runuser", "-u", USER, "--", "amixer", "-q", "sset", "Master", f"{level}%", "unmute" if level else "mute"])
            return self.reply({"ok": code == 0})
        if p == "/api/exec":
            # Runs as the unprivileged desktop user, never as root.
            cmd = str(b.get("cmd", ""))
            code, out = run(["runuser", "-l", USER, "-c", cmd], timeout=int(b.get("timeout", 30)))
            return self.reply({"code": code, "out": out[-200_000:]})
        if p == "/api/proc/start":
            lang = b.get("lang")
            if lang not in LANGS:
                return self.reply({"error": "unknown language"}, 400)
            if not has_tool(LANGS[lang]["needs"]):
                return self.reply({"error": f"{LANGS[lang]['name']} is not installed on this system"}, 400)
            reap()
            try:
                pr = Proc(lang, str(b.get("code", "")))
            except Exception as e:  # e.g. the desktop user is missing
                return self.reply({"error": f"could not start program: {e}"}, 500)
            pid = secrets.token_hex(8)
            PROCS[pid] = pr
            return self.reply({"id": pid})
        if p == "/api/proc/write":
            pr = PROCS.get(b.get("id"))
            if pr:
                pr.write(str(b.get("data", "")))
            return self.reply({"ok": bool(pr)})
        if p == "/api/proc/kill":
            pr = PROCS.get(b.get("id"))
            if pr:
                pr.kill()
            return self.reply({"ok": bool(pr)})
        self.reply({"error": "not found"}, 404)


def main():
    os.makedirs(RUN_DIR, exist_ok=True)
    path = os.path.join(RUN_DIR, "token")
    with open(path, "w") as f:
        f.write(TOKEN)
    try:
        import pwd
        os.chown(path, 0, pwd.getpwnam(USER).pw_gid)
        os.chmod(path, 0o640)
    except (KeyError, PermissionError):
        os.chmod(path, 0o600)
    cpu_percent()
    print(f"rocketd {VERSION} serving {WWW} on http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
