# linux-glibc

Raspberry Pi and other Debian-style glibc boards. Definition: [../../targets.yaml](../../targets.yaml) (`linux-glibc`). Bullets: `[seeded]` = not yet run here.

## Identity
- `[seeded]` Triples: Pi 3/4/5 64-bit `aarch64-linux-gnu`; 32-bit userland `arm-linux-gnueabihf` (armv7) or, Pi 1/Zero, armv6 hard-float; plain x86 boards `x86_64-linux-gnu`.
- `[seeded]` **Kernel arch is not userland arch**: a 64-bit kernel can run a 32-bit Raspberry Pi OS. `uname -m` says `aarch64`; `dpkg --print-architecture` (or `file /bin/ls`) says `armhf`. Build for the userland arch.

## Build
- `[seeded]` Native on the board: fine for small projects, slow for big ones; use `ninja`, `ccache`, or distcc.
- `[seeded]` Cross: `apt install gcc-aarch64-linux-gnu` (or `gcc-arm-linux-gnueabihf`), plus a sysroot to get the board's real libs: `rsync -a --safe-links <user>@<host>:/{lib,usr/include,usr/lib} sysroot/` then fix absolute symlinks (`symlinks -rc sysroot`), build with `--sysroot=sysroot` / `CMAKE_SYSROOT`. Helper in rsenn projects: `cfg-aarch64`. Hub: [activities/build.md](../activities/build.md).
- `[seeded]` Match the board's glibc: a binary built against a newer glibc than the board's fails with `GLIBC_2.xx not found`. The rsynced sysroot avoids it.

## Test
- `[seeded]` Real: copy over and run via [ssh](../transports/ssh.md). Smoke: `qemu-aarch64 -L /usr/aarch64-linux-gnu ./prog` (`qemu-user-static`, `binfmt`) on the build host: reports "smoke-tested under qemu", not "tested on device". Hub: [activities/test.md](../activities/test.md).

## Debug
- `[seeded]` `gdbserver :<port> ./prog` on the board, `gdb-multiarch` on the host: `set sysroot <sysroot>`, `file ./prog` (unstripped), `target remote <host>:<port>` ([remote-debug](../transports/remote-debug.md)). Or just `gdb` on the board over ssh. Core dumps: `ulimit -c unlimited`, `coredumpctl`.

## Trace
- `[seeded]` `strace -f -tt -o log`, `ltrace`, `perf record -g` / `perf stat` (`linux-perf` package), `bpftrace` (kernel dependent), `journalctl -f`, `dmesg -w`. Hub: [activities/trace.md](../activities/trace.md).

## Instrument
- `[seeded]` gcc/clang ASan, UBSan, TSan work natively on aarch64; `valgrind` is available on Debian ARM. `gcov`/`--coverage`: copy `.gcda` back and merge on the host. Hub: [activities/instrument.md](../activities/instrument.md).

## Package
- `[seeded]` `.deb` (cpack `-G DEB` with `CPACK_DEBIAN_PACKAGE_ARCHITECTURE=arm64|armhf`, or `dpkg-deb --build`), or `tar.gz`. Hub: [activities/package.md](../activities/package.md).

## Transfer
- `[seeded]` `rsync -az -e ssh`, `scp`, sshfs ([sshfs](../transports/sshfs.md)); build on the host into the mount, run on the board. Hub: [activities/transfer.md](../activities/transfer.md).

## Gotchas
- `[seeded]` Headless first boot: enable ssh with an empty `ssh` file in the boot partition, user via `userconf.txt` or the imager; serial console needs `enable_uart=1` ([serial](../transports/serial.md)).
- `[seeded]` SD card wear: keep build trees and logs on tmpfs or an external disk.
- `[seeded]` Throttling under load (check `vcgencmd get_throttled`) makes timing tests flaky.

## See also
[musl](musl.md) · [ssh](../transports/ssh.md) · [serial](../transports/serial.md) · [vnc](../transports/vnc.md)
