[ -f ~/.bashrc ] && . ~/.bashrc
# On the first console, start the RocketOS desktop. Other consoles (Ctrl+Alt+F2…) stay plain shells.
if [ -z "$DISPLAY" ] && [ "$(tty)" = /dev/tty1 ] && ! grep -qw rocketos.text /proc/cmdline; then
  exec startx /usr/bin/rocketos-session -- -nolisten tcp vt1 -keeptty >"$HOME/.rocketos-x.log" 2>&1
fi
