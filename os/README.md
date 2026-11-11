# RocketOS — the operating system build

This folder turns RocketOS into a **real, bootable operating system**. It boots a Linux kernel from a USB stick, a PC or a virtual machine, straight into the RocketOS desktop. That desktop is the **same HTML/CSS/JS code** in this repository (`index.html`, `css/`, `js/`), unchanged.

## How it fits together

```
 ┌───────────────────────────────────────────────────────────────┐
 │  RocketOS desktop: index.html + css/ + js/  (the same code)  │
 │  js/native.js swaps simulated parts for real hardware         │
 ├───────────────────────────────────────────────────────────────┤
 │  rocket-shell   fullscreen WebKitGTK window   (Python + GTK)  │
 │  rocketd        serves the desktop on 127.0.0.1:7070 and a    │
 │                 token-protected API for the hardware (root)   │
 ├───────────────────────────────────────────────────────────────┤
 │  Xorg · NetworkManager · ALSA · systemd                       │
 │  Linux kernel + drivers/firmware (Ubuntu 24.04 base)          │
 └───────────────────────────────────────────────────────────────┘
```

Boot sequence: GRUB → Linux + casper live system → systemd starts `rocketd` and auto-logs in user `rocket` on tty1 → `startx` → `rocketos-session` → `rocket-shell` → the RocketOS BIOS screen, splash, lock screen and desktop.

## What becomes real when RocketOS runs as the OS

| Feature | Web version | As the operating system |
|---|---|---|
| Wi-Fi menu, Settings → Wi-Fi, `wifi` command | Simulated networks | **Real** networks from NetworkManager: scan, connect with a password, disconnect, forget, radio on/off. Wired ethernet shows up as "Ethernet" |
| Shut Down / Restart, `shutdown`, `reboot`, `poweroff` | Shows a screen | **Really** powers off or reboots the computer |
| CPU / memory (taskbar meter, widgets, System Monitor, `free`, `top`) | Estimated | **Real** figures from `/proc` |
| Battery | Browser API | **Real** battery level from `/sys/class/power_supply` |
| Volume slider | Sound effects only | Also sets the **system** volume (ALSA) |
| `uname -a`, `neofetch`, About | `rocket-kernel` | The **real Linux kernel** version |
| `linux <cmd>` in the Terminal | — | Runs a **real Linux command** as user `rocket`, e.g. `linux ip addr`, `linux lsusb`, `linux sudo apt install …` |
| Browser, live weather, Rocky's cloud mode | Need internet | Work over the machine's own connection |

`js/native.js` only switches on when `rocket-shell` injects the API token, so the web version behaves exactly as before.

## Build the ISO

On Ubuntu or Debian (as root):

```bash
sudo apt install debootstrap squashfs-tools xorriso grub-pc-bin grub-efi-amd64-bin mtools
```

```bash
sudo ./os/build.sh
```

The result is `os/out/rocketos.iso`. The build takes a few minutes and needs about 6 GB of free disk space.

- `VARIANT=vm`: a smaller image without Wi-Fi firmware, for virtual machines only.
- `MIRROR=http://…`: use a different Ubuntu mirror.
- If you re-run the build, it reuses `os/out/rootfs` and copies the latest desktop code. Delete `os/out` to start completely fresh.

## Try it

- **Virtual machine:** run `./os/run-vm.sh` (QEMU), or create a VirtualBox / VMware VM ("Linux, Ubuntu 64-bit", 3 GB RAM) and attach the ISO.
- **USB stick:** write the ISO to the stick. This erases the stick. Replace `/dev/sdX` with your USB device:
  ```bash
  sudo dd if=os/out/rocketos.iso of=/dev/sdX bs=4M status=progress
  ```
  You can also use balenaEtcher or Rufus (DD mode). Then boot the PC from USB; it works with both BIOS and UEFI. Secure Boot must be off.

## Boot menu

| Entry | Use |
|---|---|
| **RocketOS** | Normal start |
| **save my files to a 'casper-rw' partition** | Keeps your files and settings between boots. You need to add an ext4 partition labelled `casper-rw` on the USB stick first |
| **safe graphics** | `nomodeset`, for screens that stay black |
| **text console only** | Boots to a plain Linux shell without the desktop |

Without persistence, RocketOS starts fresh on every boot, like any live USB.

## Handy keys

- **F12** opens the web inspector, for debugging the desktop code.
- **Ctrl+Alt+R** reloads the desktop.
- **Ctrl+Alt+F2** switches to a Linux text console. Log in as `rocket` (no password).
- Logs are in `~/.rocketos-shell.log` and `~/.rocketos-x.log`. For the daemon's log, run `journalctl -u rocketd`.

## Files

```
os/build.sh                         builds the ISO
os/run-vm.sh                        boots it in QEMU
os/iso/boot/grub/grub.cfg           boot menu
os/rootfs/                          copied into the system image:
  usr/lib/rocketos/rocketd.py       system daemon: desktop server + hardware API
  usr/lib/rocketos/rocket-shell.py  fullscreen WebKit display
  usr/bin/rocketos-session          X session start-up
  etc/systemd/system/…              rocketd service, tty1 auto-login
  etc/skel/.bash_profile            starts the desktop on tty1
  etc/casper.conf                   live user "rocket", host "rocketos"
js/native.js                        (in the web code) connects the desktop to rocketd
```
