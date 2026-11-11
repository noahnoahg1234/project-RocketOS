#!/usr/bin/env python3
"""rocket-shell — shows the RocketOS desktop fullscreen using WebKitGTK.

It waits for rocketd, reads the API token from /run/rocketos/token and injects it into the
page as window.ROCKET_NATIVE, so js/native.js can talk to the real machine.

It also provides real web-browser views for the Browser app: the desktop page asks for a
browser view (via window.webkit.messageHandlers.rocket) and tells the shell where the
Browser window's content area is; the shell keeps a native WebKit view exactly there.
Unlike iframes, these load every site, keep their own cookies and can download files.

F12 opens the web inspector; Ctrl+Alt+R reloads the desktop.
"""
import base64
import io
import json
import os
import sys
import time
import urllib.request

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import Gdk, GLib, Gtk, WebKit2  # noqa: E402

URL = os.environ.get("ROCKETOS_URL", "http://127.0.0.1:7070/")
TOKEN_FILE = os.environ.get("ROCKETOS_TOKEN_FILE", "/run/rocketos/token")
DATA = os.path.expanduser("~/.local/share/rocketos")
DOWNLOADS = os.path.expanduser("~/Downloads")
FEATURES = ["browser"]


def wait_for_daemon(timeout=60):
    end = time.time() + timeout
    while time.time() < end:
        try:
            urllib.request.urlopen(URL, timeout=2).read(1)
            return True
        except OSError:
            time.sleep(0.5)
    return False


def read_token():
    try:
        with open(TOKEN_FILE) as f:
            return f.read().strip()
    except OSError:
        return None


def apply_settings(view, pairs):
    """Set optional WebKit settings; skip any this WebKitGTK version doesn't have instead of crashing."""
    s = view.get_settings()
    for name, value in pairs:
        try:
            getattr(s, "set_" + name)(value)
        except (AttributeError, TypeError) as e:
            print("rocket-shell: skipping setting", name, e, file=sys.stderr)


def run_js(view, script):
    try:
        view.evaluate_javascript(script, -1, None, None, None, None, None)
    except (AttributeError, TypeError):
        view.run_javascript(script, None, None, None)


class Browsers:
    """Native browser views layered over the desktop, driven by the Browser app."""

    def __init__(self, desktop, overlay, accel):
        self.desktop, self.overlay, self.accel = desktop, overlay, accel
        self.views = {}  # id -> {"view", "shown"}
        os.makedirs(DOWNLOADS, exist_ok=True)
        data = os.path.join(DATA, "browser")
        mgr = WebKit2.WebsiteDataManager(base_data_directory=data, base_cache_directory=os.path.join(data, "cache"))
        self.context = WebKit2.WebContext.new_with_website_data_manager(mgr)
        self.context.connect("download-started", self.on_download)

    # -- messages from the page
    def handle(self, msg):
        cmd, bid = msg.get("cmd"), str(msg.get("id", ""))
        if cmd == "create":
            return self.create(bid, msg.get("url") or "about:blank")
        b = self.views.get(bid)
        if not b:
            return
        v = b["view"]
        if cmd == "rect":
            self.place(bid, msg)
        elif cmd == "nav":
            v.load_uri(msg.get("url") or "about:blank")
        elif cmd == "back":
            v.go_back()
        elif cmd == "forward":
            v.go_forward()
        elif cmd == "reload":
            v.reload()
        elif cmd == "stop":
            v.stop_loading()
        elif cmd == "zoom":
            v.set_zoom_level(max(0.3, min(3.0, float(msg.get("level", 1)))))
        elif cmd == "close":
            self.overlay.remove(v)
            v.destroy()
            del self.views[bid]
            self.desktop.grab_focus()

    def create(self, bid, url):
        if bid in self.views:
            return
        v = WebKit2.WebView(web_context=self.context)
        apply_settings(v, [("enable_developer_extras", True), ("enable_webaudio", True),
                           ("javascript_can_open_windows_automatically", True), ("hardware_acceleration_policy", self.accel),
                           ("enable_smooth_scrolling", True)])
        v.set_halign(Gtk.Align.START)
        v.set_valign(Gtk.Align.START)
        v.set_no_show_all(True)
        self.overlay.add_overlay(v)
        self.views[bid] = {"view": v, "shown": False}
        for sig in ("notify::uri", "notify::title", "notify::estimated-load-progress", "notify::is-loading"):
            v.connect(sig, lambda *_a, bid=bid: self.state(bid))
        v.connect("create", lambda _v, action, bid=bid: self.emit({"id": bid, "type": "newtab", "url": action.get_request().get_uri()}))
        v.connect("button-press-event", lambda *_a, bid=bid: (self.emit({"id": bid, "type": "focus"}), False)[1])
        v.connect("permission-request", lambda _v, req: (req.deny(), True)[1])
        v.connect("web-process-terminated", lambda vv, _r: vv.reload())
        v.load_uri(url)

    def place(self, bid, r):
        b = self.views[bid]
        v = b["view"]
        if r.get("visible"):
            v.set_margin_start(max(0, int(r["x"])))
            v.set_margin_top(max(0, int(r["y"])))
            v.set_size_request(max(1, int(r["w"])), max(1, int(r["h"])))
            if not b["shown"]:
                v.show()
                b["shown"] = True
        elif b["shown"]:
            # take a picture first so the Browser window can show it while the live view is hidden
            def done(view, res, bid=bid):
                try:
                    surface = view.get_snapshot_finish(res)
                    buf = io.BytesIO()
                    surface.write_to_png(buf)
                    self.emit({"id": bid, "type": "snapshot", "data": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()})
                except Exception as e:  # snapshot is a nicety; never let it break hiding
                    print("rocket-shell: snapshot failed", e, file=sys.stderr)
                view.hide()
            b["shown"] = False
            try:
                v.get_snapshot(WebKit2.SnapshotRegion.VISIBLE, WebKit2.SnapshotOptions.NONE, None, done)
            except Exception:
                v.hide()
            if v.has_focus():
                self.desktop.grab_focus()

    # -- events to the page
    def state(self, bid):
        b = self.views.get(bid)
        if not b:
            return
        v = b["view"]
        self.emit({"id": bid, "type": "state", "url": v.get_uri() or "", "title": v.get_title() or "",
                   "loading": v.is_loading(), "progress": v.get_estimated_load_progress(),
                   "canBack": v.can_go_back(), "canForward": v.can_go_forward()})

    def emit(self, ev):
        run_js(self.desktop, "window.__rocketNative && window.__rocketNative.event(" + json.dumps(ev) + ")")
        return None

    def on_download(self, _ctx, download):
        def decide(dl, suggested):
            name = os.path.basename(suggested or "download") or "download"
            path, i = os.path.join(DOWNLOADS, name), 1
            while os.path.exists(path):
                root, ext = os.path.splitext(name)
                path, i = os.path.join(DOWNLOADS, f"{root} ({i}){ext}"), i + 1
            try:
                dl.set_destination(path)
            except TypeError:
                dl.set_destination("file://" + path)
            dl._rocket_path = path
            return True
        download.connect("decide-destination", decide)
        download.connect("finished", lambda dl: self.emit({"type": "download", "path": getattr(dl, "_rocket_path", "")}))
        download.connect("failed", lambda dl, err: self.emit({"type": "download", "error": str(err)}))


def main():
    if not wait_for_daemon():
        print("rocket-shell: rocketd is not answering on", URL, file=sys.stderr)
    token = read_token()

    os.makedirs(DATA, exist_ok=True)
    manager = WebKit2.WebsiteDataManager(base_data_directory=DATA, base_cache_directory=os.path.join(DATA, "cache"))
    context = WebKit2.WebContext.new_with_website_data_manager(manager)
    content = WebKit2.UserContentManager()
    if token:
        boot = "window.ROCKET_NATIVE = " + json.dumps({"token": token, "shell": "rocket-shell", "features": FEATURES}) + ";"
        content.add_script(WebKit2.UserScript.new(boot, WebKit2.UserContentInjectedFrames.TOP_FRAME,
                                                  WebKit2.UserScriptInjectionTime.START, None, None))

    view = WebKit2.WebView(web_context=context, user_content_manager=content)
    accel = WebKit2.HardwareAccelerationPolicy.NEVER if os.environ.get("ROCKETOS_SOFTWARE") else WebKit2.HardwareAccelerationPolicy.ON_DEMAND
    apply_settings(view, [("enable_developer_extras", True), ("enable_webaudio", True),
                          ("javascript_can_access_clipboard", True), ("javascript_can_open_windows_automatically", False),
                          ("enable_write_console_messages_to_stdout", True), ("hardware_acceleration_policy", accel)])

    overlay = Gtk.Overlay()
    overlay.add(view)
    browsers = Browsers(view, overlay, accel)

    # Messages from the desktop page: window.webkit.messageHandlers.rocket.postMessage(JSON string)
    def on_message(_cm, result):
        try:
            value = result.get_js_value() if hasattr(result, "get_js_value") else result
            msg = json.loads(value.to_string())
            browsers.handle(msg)
        except Exception as e:
            print("rocket-shell: bad message", e, file=sys.stderr)
    content.register_script_message_handler("rocket")
    content.connect("script-message-received::rocket", on_message)

    # Links in the desktop that want a new window open in RocketOS's own browser app.
    def on_create(v, action):
        uri = action.get_request().get_uri()
        run_js(v, f"OS.launch('browser', {{ url: {json.dumps(uri)} }})")
        return None
    view.connect("create", on_create)

    # If the desktop renderer ever crashes, bring it back instead of leaving a frozen screen.
    def on_crash(v, reason):
        print("rocket-shell: web process terminated:", reason, "- reloading", file=sys.stderr, flush=True)
        for bid in list(browsers.views):
            browsers.handle({"cmd": "close", "id": bid})
        GLib.timeout_add(800, lambda: (v.reload(), False)[1])
    view.connect("web-process-terminated", on_crash)

    # A reload of the desktop page forgets its Browser windows, so drop their native views too.
    def on_load(_v, event):
        if event == WebKit2.LoadEvent.STARTED:
            for bid in list(browsers.views):
                browsers.handle({"cmd": "close", "id": bid})
    view.connect("load-changed", on_load)

    win = Gtk.Window(title="RocketOS")
    win.set_decorated(False)
    mon = Gdk.Display.get_default().get_primary_monitor() or Gdk.Display.get_default().get_monitor(0)
    geo = mon.get_geometry()
    win.set_default_size(geo.width, geo.height)
    win.add(overlay)
    win.connect("destroy", Gtk.main_quit)

    def on_key(_w, ev):
        ctrl_alt = ev.state & Gdk.ModifierType.CONTROL_MASK and ev.state & Gdk.ModifierType.MOD1_MASK
        if ev.keyval == Gdk.KEY_F12:
            view.get_inspector().show()
            return True
        if ctrl_alt and ev.keyval in (Gdk.KEY_r, Gdk.KEY_R):
            view.reload()
            return True
        return False
    win.connect("key-press-event", on_key)

    view.load_uri(URL)
    win.show_all()
    win.fullscreen()
    Gtk.main()


if __name__ == "__main__":
    main()
