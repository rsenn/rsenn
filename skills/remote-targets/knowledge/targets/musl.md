# musl

Definition: [../../targets.yaml](../../targets.yaml) (`musl`). Bullets: `[seeded]` = not yet run here.

## Identity
- `[seeded]` Static Linux executables against musl; no dependency on the target's libc, so they run on any kernel of the same arch.

## Build
- `[seeded]` Options: distro `musl-gcc` wrapper (host arch only), `musl-cross-make` toolchains (`<arch>-linux-musl-gcc`), or `zig cc -target x86_64-linux-musl` / `aarch64-linux-musl`. Link with `-static` (add `-static-pie` if ASLR needed). Helper in rsenn projects: `cfg-musl`. Hub: [activities/build.md](../activities/build.md).
- `[seeded]` Check: `file prog` says "statically linked"; `ldd prog` says "not a dynamic executable".

## Test
- `[seeded]` Same-arch: run on the build host directly. Other arch: `qemu-<arch>` (no `-L` needed since static) or on a [linux-glibc](linux-glibc.md) board over [ssh](../transports/ssh.md). Hub: [activities/test.md](../activities/test.md).

## Debug
- `[seeded]` gdb works on static binaries; keep an unstripped copy. `gdbserver` for remote ([remote-debug](../transports/remote-debug.md)). No separate libc symbols to find (all in the binary).

## Trace
- `[seeded]` `strace` works; no `ltrace` (needs dynamic linking). Hub: [activities/trace.md](../activities/trace.md).

## Instrument
- `[seeded]` ASan/MSan/TSan runtimes assume glibc or are not supported in musl static builds; use UBSan, `-fstack-protector`, valgrind on the host instead. Hub: [activities/instrument.md](../activities/instrument.md). Size: `size`, `nm --size-sort`.

## Package
- `[seeded]` A single static file; `tar.gz` + checksum; strip with `strip -s`. Hub: [activities/package.md](../activities/package.md).

## Transfer
- `[seeded]` One file: `scp`/`ssh host 'cat > f' < f`; works even on minimal systems without sftp. Hub: [activities/transfer.md](../activities/transfer.md).

## Gotchas
- `[seeded]` No `execinfo.h` (backtrace), no `<sys/queue.h>` on some versions, no glibc-only extensions; check `__GLIBC__` is not assumed.
- `[seeded]` `getaddrinfo` with `nsswitch`/NIS and `iconv` are limited; DNS config read from `/etc/resolv.conf` only.
- `[seeded]` Default thread stack is small (128 KiB): deep recursion in threads crashes; set `pthread_attr_setstacksize`.
- `[seeded]` `malloc` is slower than glibc's; relevant for benchmarks.

## See also
[dietlibc](dietlibc.md) · [linux-glibc](linux-glibc.md) · [ssh](../transports/ssh.md)
