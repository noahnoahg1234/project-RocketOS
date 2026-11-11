#!/usr/bin/env bash
# Build the RocketOS bootable live ISO.
#
#   sudo ./os/build.sh              # full image with real-hardware Wi-Fi drivers and firmware
#   sudo VARIANT=vm ./os/build.sh   # smaller image for virtual machines (no firmware)
#
# Result: os/out/rocketos.iso — boots on BIOS and UEFI PCs, from USB or in a VM.
# Needs (Ubuntu/Debian host): debootstrap squashfs-tools xorriso grub-pc-bin grub-efi-amd64-bin mtools
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(dirname "$HERE")"
OUT="${OUT:-$HERE/out}"
ROOT="$OUT/rootfs"
ISO="$OUT/iso"
SUITE="${SUITE:-noble}"
MIRROR="${MIRROR:-http://archive.ubuntu.com/ubuntu}"
VARIANT="${VARIANT:-full}"
VERSION="$(sed -n "s/.*const version = '\(.*\)'.*/\1/p" "$REPO/js/core.js")"

[ "$(id -u)" = 0 ] || { echo "Run as root (sudo $0)"; exit 1; }
for t in debootstrap mksquashfs grub-mkrescue xorriso; do
  command -v "$t" >/dev/null || { echo "Missing $t. Install: apt install debootstrap squashfs-tools xorriso grub-pc-bin grub-efi-amd64-bin mtools"; exit 1; }
done

step() { printf '\n\033[1;33m🚀 %s\033[0m\n' "$*"; }

cleanup() {
  for m in dev/pts dev proc sys run; do mountpoint -q "$ROOT/$m" 2>/dev/null && umount -lf "$ROOT/$m" || true; done
}
trap cleanup EXIT

# ---------------------------------------------------------------- 1. base system
if [ ! -x "$ROOT/usr/bin/apt-get" ]; then
  step "Bootstrapping Ubuntu $SUITE base into $ROOT"
  rm -rf "$ROOT"; mkdir -p "$ROOT"
  debootstrap --variant=minbase --components=main,universe "$SUITE" "$ROOT" "$MIRROR"
fi

mount --bind /dev "$ROOT/dev"; mount --bind /dev/pts "$ROOT/dev/pts"
mount -t proc proc "$ROOT/proc"; mount -t sysfs sys "$ROOT/sys"; mount -t tmpfs tmpfs "$ROOT/run"
cp /etc/resolv.conf "$ROOT/etc/resolv.conf" 2>/dev/null || true
in_root() { chroot "$ROOT" /usr/bin/env DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 "$@"; }

cat > "$ROOT/etc/apt/sources.list" <<EOF
deb $MIRROR $SUITE main restricted universe
deb $MIRROR $SUITE-updates main restricted universe
deb $MIRROR $SUITE-security main restricted universe
EOF
# don't start services inside the build chroot
printf '#!/bin/sh\nexit 101\n' > "$ROOT/usr/sbin/policy-rc.d"; chmod +x "$ROOT/usr/sbin/policy-rc.d"

# ---------------------------------------------------------------- 2. packages
step "Installing kernel, live-boot, display and network packages"
KERNEL="linux-image-generic"
[ "$VARIANT" = vm ] && KERNEL="linux-image-virtual"
PKGS=(
  systemd-sysv casper "$KERNEL" initramfs-tools
  network-manager wpasupplicant iw rfkill wireless-regdb ca-certificates glib-networking
  xserver-xorg-core xserver-xorg-input-libinput xserver-xorg-video-fbdev xserver-xorg-video-vesa xinit x11-xserver-utils
  libgl1-mesa-dri libegl1
  python3 python3-gi gir1.2-gtk-3.0 gir1.2-webkit2-4.1 dbus dbus-x11 dbus-user-session
  fonts-dejavu-core fonts-noto-color-emoji
  gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-alsa alsa-utils
  sudo less nano kbd
)
[ "$VARIANT" = vm ] || PKGS+=(linux-firmware)
in_root apt-get update -q
in_root apt-get install -y -q --no-install-recommends "${PKGS[@]}"

# ---------------------------------------------------------------- 3. RocketOS itself
step "Installing RocketOS $VERSION (desktop code + system services)"
cp -a "$HERE/rootfs/." "$ROOT/"
WWW="$ROOT/usr/share/rocketos/www"
rm -rf "$WWW"; mkdir -p "$WWW"
cp -a "$REPO/index.html" "$REPO/css" "$REPO/js" "$REPO/README.md" "$WWW/"
chmod +x "$ROOT/usr/lib/rocketos/"*.py "$ROOT/usr/bin/rocketos-session"

cat > "$ROOT/usr/lib/os-release" <<EOF
PRETTY_NAME="RocketOS $VERSION (Liftoff)"
NAME="RocketOS"
VERSION_ID="$VERSION"
VERSION="$VERSION (Liftoff)"
ID=rocketos
ID_LIKE="ubuntu debian"
UBUNTU_CODENAME=$SUITE
HOME_URL="https://github.com/noahnoahg1234/project-RocketOS"
EOF
ln -sf ../usr/lib/os-release "$ROOT/etc/os-release"

in_root systemctl enable rocketd.service NetworkManager.service
in_root systemctl set-default multi-user.target
in_root systemctl mask systemd-networkd-wait-online.service NetworkManager-wait-online.service >/dev/null 2>&1 || true

step "Building the initramfs"
in_root update-initramfs -u -k all

# ---------------------------------------------------------------- 4. clean up
rm -f "$ROOT/usr/sbin/policy-rc.d"
in_root apt-get clean
rm -rf "$ROOT/var/lib/apt/lists/"* "$ROOT/tmp/"* "$ROOT/var/log/"*.log
mkdir -p "$ROOT/var/crash"
: > "$ROOT/etc/resolv.conf"
cleanup

# ---------------------------------------------------------------- 5. ISO
step "Packing the file system (squashfs)"
rm -rf "$ISO"; mkdir -p "$ISO/casper"
cp -a "$HERE/iso/." "$ISO/"
cp "$(ls -1 "$ROOT"/boot/vmlinuz-* | sort -V | tail -1)" "$ISO/casper/vmlinuz"
cp "$(ls -1 "$ROOT"/boot/initrd.img-* | sort -V | tail -1)" "$ISO/casper/initrd"
mksquashfs "$ROOT" "$ISO/casper/filesystem.squashfs" -noappend -comp zstd -e boot -quiet
du -sx --block-size=1 "$ROOT" | cut -f1 > "$ISO/casper/filesystem.size"
mkdir -p "$ISO/.disk"; echo "RocketOS $VERSION" > "$ISO/.disk/info"

step "Writing bootable ISO (BIOS + UEFI)"
grub-mkrescue -o "$OUT/rocketos.iso" "$ISO" -- -volid ROCKETOS >/dev/null 2>&1
ls -lh "$OUT/rocketos.iso"
echo "Done. Test it with: os/run-vm.sh   ·   Write to USB with: sudo dd if=$OUT/rocketos.iso of=/dev/sdX bs=4M status=progress"
