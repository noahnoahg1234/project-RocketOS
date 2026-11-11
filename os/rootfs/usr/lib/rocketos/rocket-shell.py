#!/usr/bin/env python3
"""rocket-shell — shows the RocketOS desktop fullscreen using WebKitGTK.

It waits for rocketd, reads the API token from /run/rocketos/token and injects it into the
page as window.ROCKET_NATIVE, so js/native.js can talk to the real machine.
F12 opens the web inspector; Ctrl+Alt+R reloads the desktop.
"""
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


def main():
    if not wait_for_daemon():
        print("rocket-shell: rocketd is not answering on", URL, file=sys.stderr)
    token = read_token()

    os.makedirs(DATA, exist_ok=True)
    manager = WebKit2.WebsiteDataManager(base_data_directory=DATA, base_cache_directory=os.path.join(DATA, "cache"))
    context = WebKit2.WebContext.new_with_website_data_manager(manager)
    content = WebKit2.UserContentManager()
    if token:
        boot = "window.ROCKET_NATIVE = " + json.dumps({"token": token, "shell": "rocket-shell"}) + ";"
        content.add_script(WebKit2.UserScript.new(boot, WebKit2.UserContentInjectedFrames.TOP_FRAME,
                                                  WebKit2.UserScriptInjectionTime.START, None, None))

    view = WebKit2.WebView(web_context=context, user_content_manager=content)
    s = view.get_settings()
    accel = WebKit2.HardwareAccelerationPolicy.NEVER if os.environ.get("ROCKETOS_SOFTWARE") else WebKit2.HardwareAccelerationPolicy.ON_DEMAND
    # Optional settings: skip any that this WebKitGTK version doesn't have, rather than failing to start.
    for name, value in [("enable_developer_extras", True), ("enable_webaudio", True),
                        ("javascript_can_access_clipboard", True), ("javascript_can_open_windows_automatically", False),
                        ("enable_write_console_messages_to_stdout", True), ("hardware_acceleration_policy", accel)]:
        try:
            getattr(s, "set_" + name)(value)
        except (AttributeError, TypeError) as e:
            print("rocket-shell: skipping setting", name, e, file=sys.stderr)

    # Links that want a new window (target=_blank) open inside RocketOS's own browser app.
    def on_create(v, action):
        uri = action.get_request().get_uri()
        v.run_javascript(f"OS.launch('browser', {{ url: {json.dumps(uri)} }})", None, None, None)
        return None
    view.connect("create", on_create)

    # If the page renderer ever crashes, bring the desktop back instead of leaving a frozen screen.
    def on_crash(v, reason):
        print("rocket-shell: web process terminated:", reason, "- reloading", file=sys.stderr, flush=True)
        GLib.timeout_add(800, lambda: (v.reload(), False)[1])
    view.connect("web-process-terminated", on_crash)

    win = Gtk.Window(title="RocketOS")
    win.set_decorated(False)
    mon = Gdk.Display.get_default().get_primary_monitor() or Gdk.Display.get_default().get_monitor(0)
    geo = mon.get_geometry()
    win.set_default_size(geo.width, geo.height)
    win.add(view)
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
