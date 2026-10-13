# dietlibc

Definition: [../../targets.yaml](../../targets.yaml) (`dietlibc`). Bullets: `[seeded]` = not yet run here. Code style for it: the `diet-coding` skill.

## Identity
- `[seeded]` Tiny static libc for Linux (x86, x86_64, arm, aarch64, mips, ppc, ...). Static linking only; binaries are often tens of KB.

## Build
- `[seeded]` `diet gcc -Os -o prog prog.c` (the `diet` wrapper injects include/lib paths and `-static`); `diet -Os gcc ...` to build the program itself optimised.
- `[seeded]` Per-arch libs: `make ARCH=<arch> CROSS=<prefix>-` in the dietlibc tree, results in `bin-<arch>/` and `lib-<arch>/`; then `diet` picks them by `DIETHOME`/arch. Helper in rsenn projects: `cfg-diet`. Hub: [activities/build.md](../activities/build.md).
- `[seeded]` CMake/autotools: set `CC="diet gcc"` (or the toolchain wrapper); expect to patch `configure` checks that probe for unsupported libc features.

## Test
- `[seeded]` Same-arch directly; otherwise `qemu-<arch>`. A passing run under dietlibc says nothing about glibc behaviour; test both if the code is portable. Hub: [activities/test.md](../activities/test.md).

## Debug
- `[seeded]` gdb on the unstripped static binary; `gdbserver` for remote ([remote-debug](../transports/remote-debug.md)). Compile with `-g` then strip only the shipped copy.

## Trace
- `[seeded]` `strace` is the main tool. Hub: [activities/trace.md](../activities/trace.md).

## Instrument
- `[seeded]` Measure size, not speed: `size prog`, `nm --size-sort -S prog | tail`, `-Wl,-Map`. Sanitizers are not available. Hub: [activities/instrument.md](../activities/instrument.md).

## Package
- `[seeded]` Single static file, `strip -s`, optionally `upx` (check it still runs). Hub: [activities/package.md](../activities/package.md).

## Transfer
- `[seeded]` As [musl](musl.md#transfer): one static file, any channel. Hub: [activities/transfer.md](../activities/transfer.md).

## Gotchas
- `[seeded]` Incomplete libc: limited `locale`, `iconv`, `wchar`, and `getaddrinfo` (no NSS; IPv6/DNS support is basic). Missing symbols show up at link time, not run time, which is the point of static.
- `[seeded]` Do not mix with glibc headers (`-I/usr/include`) in the same compile.
- `[seeded]` `printf("%lld")`, `%n$` positional args, and some `scanf` forms behave differently; the diet-coding skill avoids stdio altogether.

## See also
[musl](musl.md) · [linux-glibc](linux-glibc.md)
