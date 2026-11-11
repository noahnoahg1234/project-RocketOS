#!/usr/bin/env bash
# Boot the RocketOS ISO in QEMU.   os/run-vm.sh [path/to/rocketos.iso]
# Uses KVM when available. Add UEFI=1 to boot with OVMF firmware (apt install ovmf).
set -euo pipefail
ISO="${1:-$(dirname "$0")/out/rocketos.iso}"
# Without KVM, -cpu max gives the emulated CPU the full instruction set WebKit's JIT expects.
ACCEL=(-accel tcg,thread=multi -cpu max); [ -w /dev/kvm ] && ACCEL=(-accel kvm -cpu host)
FW=(); [ "${UEFI:-0}" = 1 ] && FW=(-bios /usr/share/ovmf/OVMF.fd)
exec qemu-system-x86_64 "${ACCEL[@]}" "${FW[@]}" -m "${MEM:-3072}" -smp "${CPUS:-2}" \
  -cdrom "$ISO" -boot d -vga virtio -device intel-hda -device hda-duplex \
  -nic user,model=virtio-net-pci -usb -device usb-tablet "${@:2}"
