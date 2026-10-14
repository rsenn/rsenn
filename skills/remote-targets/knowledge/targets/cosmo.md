# cosmo

Cosmopolitan Libc / cosmocc: one "Actually Portable Executable" (APE) that runs on Linux, macOS, Windows, FreeBSD, OpenBSD, NetBSD, on x86_64 and (fat build) aarch64. Definition: [../../targets.yaml](../../targets.yaml) (`cosmo`). Bullets: `[seeded]` = from the upstream README/docs, not yet run here; `[verified DATE]` = run by this skill.

Where the information lives: toolchain README `tool/cosmocc/README.md` in the Cosmopolitan source tree (the most complete reference; clone <https://github.com/jart/cosmopolitan>), APE format <https://justine.lol/ape.html>, downloads <https://cosmo.zip/> and GitHub releases of `jart/cosmopolitan`, build recipes for third-party software <https://github.com/ahgamut/superconfigure>.

## Identity
- `[seeded]` Toolchain = GCC 14.1 (patched) + Clang 19 + Cosmopolitan Libc + LLVM libc++/compiler-rt/OpenMP; the toolchain's own tools are APEs, so it runs on any supported OS. No dependency except a UNIX shell. Predefined: `__COSMOPOLITAN__`, `__COSMOCC__`; `cosmocc` also defines `__FATCOSMOCC__`.
- `[seeded]` Minimum OS: Linux 2.6.18, Windows 8 (Vista/7 via the `vista` branch), macOS (Darwin 23+ per upstream README), FreeBSD 13, OpenBSD 7.3 or older, NetBSD 9.2. Android is not on the list (see [Gotchas](#gotchas)).
- `[verified 2026-10-14]` Release 4.0.2 (2025-01-06, latest at the time): `cosmocc-4.0.2.zip` is 442 MB, **1362 MB extracted** (3155 entries; `x86_64-linux-cosmo/lib` 359 MB, `aarch64-linux-cosmo/lib` 370 MB, `libexec/gcc` 355 MB, `libexec/clang` 125 MB). Plan disk accordingly. Source tree `master` is 4.x; its Makefile still bootstraps a pinned 3.9.2 (`.cosmocc/3.9.2`, sha256-verified by `build/download-cosmocc.sh`).
- `[verified 2026-10-14]` Names: `cosmocc` = fat (x86_64 + aarch64 in one file) via `unknown-unknown-cosmo-cc`; single-arch: `x86_64-unknown-cosmo-cc`, `aarch64-unknown-cosmo-cc` (+ `c++`, `ar` as `cosmoar`, `cosmoinstall`); physical compilers: `x86_64-linux-cosmo-gcc`, `aarch64-linux-cosmo-gcc` (do not call directly unless you want to own all the ABI flags).

## Build
- `[seeded]` Install: download a release zip, `unzip` into a directory (relative paths, no root, no PATH change needed); `bin/cosmocc -o hello hello.c` produces `hello` (APE) plus `hello.dbg` (x86_64 Linux ELF with DWARF) and `hello.aarch64.elf`.
- `[seeded]` Trust: the release has no published checksum; compare the GitHub and `cosmo.zip/pub/cosmocc/cosmocc-<ver>.zip` downloads, record the sha256 in `LESSONS.md`. The clone's `build/download-cosmocc.sh <dir> <version> <sha256>` is the pattern for pinning.
- `[seeded]` Flags: `-mcosmo` (GNU/BSD/Cosmo APIs visible, like `_GNU_SOURCE`), `-mclang` (Clang backend, experimental, faster C++), `-mgcc` (default), `-mdbg` (debug runtime, heavy runtime checks; use with `-O0 -g`), `-mtiny` (size runtime: ~180 kB fat / ~68 kB x86-only hello, loses `--strace/--ftrace`), `-msysv` (no Windows/bare-metal code), `-moptlinux` (Linux-only, -O3 runtime, needs 2011+ CPU on x86), `-mtinylinux` (Linux-only tiny). Per-arch ISA: `-Xx86_64-mssse3`, `-Xaarch64-march=armv8.2-a+dotprod`. Default baseline is K8 / ARMv8.0.
- `[seeded]` Autotools/cmake: `export CC=cosmocc CXX=cosmoc++ AR=cosmoar INSTALL=cosmoinstall`, `./configure --prefix=/opt/cosmos` with an include/lib prefix that holds **only** cosmocc-built software (different ABI than the distro). Projects that probe the preprocessor per arch need the single-arch compilers `x86_64-unknown-cosmo-cc` / `aarch64-unknown-cosmo-cc` and `apelink` to join results. Preprocessor-only mode uses x86_64 with `__x86_64__` undefined.
- `[seeded]` Reproducible output: set `LC_ALL=C SOURCE_DATE_EPOCH=0` and `-U__DATE__ -U__TIME__`. `export BUILDLOG=log` records every sub-command (run it to see the exact per-arch compile, `fixupobj`, `apelink`, `pecheck` steps).
- `[seeded]` Code differences: `switch (errno) { case EINVAL: ... }` works (GCC patch, constants are linkable symbols); no `fork`-heavy Windows assumptions; link-time constants like `EINVAL` are not compile-time. Hub: [activities/build.md](../activities/build.md). rsenn helper: `cfg-cosmo` (to be added to `cfg-cmake.sh`, not present yet).

## Test
- `[seeded]` Run natively on the host (Linux runs the APE via shell self-extraction of a tiny loader to `$TMPDIR`/`$HOME`, or via binfmt_misc/`/usr/bin/ape`); run the aarch64 half with `qemu-aarch64 ./hello.aarch64.elf` (qemu binfmt is registered on this workstation) or on a [linux-glibc](linux-glibc.md) board by copying the **same file** and running it there. Windows: copy as `prog.exe`/`prog.com` and run on a Windows site. macOS/BSD: copy and run.
- `[verified 2026-10-14]` On this x86_64 Ubuntu workstation a stock APE (cosmos `dash`, 1.3 MB) runs directly with no `ape` binfmt registered (shell self-extract path).
- `[seeded]` Shells that cannot run an APE (old zsh <5.9, old fish, Python `subprocess`): use `sh -c ./prog`. Test matrix to report: host-native, qemu-aarch64, each remote OS actually run; say which. Hub: [activities/test.md](../activities/test.md).

## Debug
- `[seeded]` Debug the ELF twins, not the APE: `gdb ./hello.dbg` (x86_64) and `hello.aarch64.elf`. On non-Linux hosts or to debug the APE itself: `gdb hello -ex 'add-symbol-file hello.dbg 0x401000'`. Recommended `~/.gdbinit` lines: `set osabi none`, UTF-8 charset settings, `set complaints 0`.
- `[seeded]` Runtime logging needs no debugger: `./hello --strace` (syscalls), `./hello --ftrace` (function calls; build `-O0 -mdbg` to make it readable), `KPRINTF_LOG=file`. `ShowCrashReports()` prints a `cosmoaddr2line` command for symbolized backtraces: `cosmoaddr2line hello.dbg <pc>...`.
- `[seeded]` Use `assimilate hello` to turn an APE into a native ELF/Mach-O/PE for the host (needed for setuid, less hairy GDB, code signing). Remote: [remote-debug](../transports/remote-debug.md) works on the ELF twin. Hub: [activities/debug.md](../activities/debug.md).

## Trace
- `[seeded]` `--strace`/`--ftrace` (above), `strace` on the host for the Linux path, `BUILDLOG` for build tracing. `-mtiny` removes them. Hub: [activities/trace.md](../activities/trace.md).

## Instrument
- `[seeded]` Size: `-mtiny -Os`, `x86_64-linux-cosmo-objcopy -SO binary prog prog.com` yields the stripped raw APE; `size`/`nm` on the `.dbg`. `-mdbg` adds UBSan-built runtime and lock-cycle detection. ASan is available in the Cosmopolitan tree via its own build modes, not as a simple cosmocc flag (unverified). Hub: [activities/instrument.md](../activities/instrument.md).

## Package
- `[seeded]` One file per release for all OSes. Assets inside the binary: APE is also a zip; `zip prog data.txt` (use the cosmos `zip`, <https://cosmo.zip/pub/cosmos/bin/zip>) then read `/zip/data.txt` from code. Keep git from mangling it (`*.com binary`, no autocrlf). Ship the `.aarch64.elf`/`.dbg` separately for debugging. Redistribute notices: they are embedded as `.ident`. Hub: [activities/package.md](../activities/package.md).

## Transfer
- `[seeded]` Binary-safe copy only (`scp`, `rsync`); never text-mode FTP/CRLF conversion (the file starts with a shell script header and a PE header). Windows needs the `.exe` or `.com` extension; Unix needs `chmod +x`. Hub: [activities/transfer.md](../activities/transfer.md).

## Gotchas
- `[verified 2026-10-14]` **Termux (Android 15, aarch64) does not run stock APEs**: a cosmos `dash` APE self-extracts its loader to `$TMPDIR/.ape-1.10` (an aarch64 PIE ELF) which aborts with `Could not find a PHDR: broken executable?`, whether launched directly, with `TERMUX_EXEC__SYSTEM_LINKER_EXEC__MODE=disable`, or as `linker64 <loader> <prog>`. Android is outside upstream's supported OS list. Untested alternatives once cosmocc is installed: `assimilate`d ELF, `aarch64-unknown-cosmo-cc` ELF output, `-mtinylinux` static ELF (the termux-exec/linker64 path cannot start static non-PIE ELF, see [termux](termux.md#debug)). For phones use [termux](termux.md) or [android-ndk](android-ndk.md).
- `[seeded]` Linux `binfmt_misc` may route `MZ` files to Wine or say "run-detectors: unable to find an interpreter": install the APE loader (`/usr/bin/ape`, from cosmos `ape-$(uname -m).elf`) and register `:APE:M::MZqFpD::/usr/bin/ape:` and `:APE-jart:M::jartsr::/usr/bin/ape:` (needs root; ask first). WSL: disable `WSLInterop` the same way.
- `[seeded]` Apple Silicon: `aarch64-unknown-cosmo-cc` produces ELF; run with `ape ./hello` (`cc -O -o ape bin/ape-m1.c` from the toolchain, install to `/usr/local/bin/ape`). Other platforms: `/usr/bin/ape`.
- `[seeded]` On Windows the toolchain's shell-script wrappers need a shell and coreutils: use the cosmos `dash` as `C:\bin\sh`. Antivirus may flag APE; `-moptlinux`/`-mtinylinux` emit the `jartsr` script magic instead.
- `[seeded]` The Cosmopolitan ABI differs from the distro's libc: never link cosmocc objects with system libraries; keep a separate prefix (`/opt/cosmos`).

## See also
[musl](musl.md) · [dietlibc](dietlibc.md) · [mingw](mingw.md) · [linux-glibc](linux-glibc.md) · [wasi](wasi.md)
