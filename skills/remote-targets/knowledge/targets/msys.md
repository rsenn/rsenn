# msys

MSYS2 on a Windows machine. Definition: [../../targets.yaml](../../targets.yaml) (`msys`). Bullets: `[seeded]` = not yet run here.

## Identity
- `[seeded]` One install, several environments selected by `MSYSTEM`: `MSYS` (Cygwin-derived, `msys-2.0.dll`, POSIX emulation), `MINGW64`/`MINGW32` (msvcrt), `UCRT64` (recommended), `CLANG64`, `CLANGARM64` (native toolchains, no POSIX layer). Package prefixes: `mingw-w64-ucrt-x86_64-*`, `mingw-w64-clang-x86_64-*`, plain for MSYS.

## Build
- `[seeded]` `pacman -S --needed mingw-w64-ucrt-x86_64-{gcc,cmake,ninja,make,pkgconf}`; build inside the UCRT64 shell. Entering from a non-MSYS shell (ssh/cmd): `C:\msys64\msys2_shell.cmd -ucrt64 -defterm -no-start -here -c "<cmd>"`, or `set MSYSTEM=UCRT64 && C:\msys64\usr\bin\bash.exe -lc "<cmd>"`; set `CHERE_INVOKING=1` to keep the working directory. Hub: [activities/build.md](../activities/build.md).

## Test
- `[seeded]` Run inside the same environment so DLLs and `PATH` resolve; exit codes pass through `bash -lc`. Hub: [activities/test.md](../activities/test.md).

## Debug
- `[seeded]` `pacman -S mingw-w64-ucrt-x86_64-gdb`; `gdb` locally on the box, or `gdbserver` (`mingw-w64-*-gdb` ships it) + remote gdb ([remote-debug](../transports/remote-debug.md)). `strace` exists only in the `MSYS` environment (for msys-2.0.dll programs).

## Trace
- `[seeded]` `strace` (MSYS programs only), Process Monitor, `ntldd -R prog.exe` for DLL deps. Hub: [activities/trace.md](../activities/trace.md).

## Instrument
- `[seeded]` clang environments support ASan/UBSan on x86_64 (the runtime DLL must be on `PATH`). Hub: [activities/instrument.md](../activities/instrument.md).

## Package
- `[seeded]` `makepkg-mingw` with a `PKGBUILD` for pacman packages; for a zip, collect DLLs with `ldd prog.exe | grep -i /ucrt64` ; static link avoids it. Hub: [activities/package.md](../activities/package.md).

## Transfer
- `[seeded]` Windows OpenSSH server + scp/rsync (`pacman -S rsync`), or an MSYS2 sshd (fiddly to set up). Paths: `/c/work` inside MSYS == `C:\work`. Hub: [activities/transfer.md](../activities/transfer.md).

## Gotchas
- `[seeded]` Automatic path conversion mangles arguments that look like POSIX paths (`/foo`) when launching native programs: disable with `MSYS2_ARG_CONV_EXCL='*'` or `MSYS_NO_PATHCONV=1`.
- `[seeded]` Binaries from the `MSYS` environment depend on `msys-2.0.dll` and are not portable; use a mingw/ucrt environment for redistributable output.
- `[seeded]` `pacman` upgrades may need the terminal restarted (core update); do not upgrade on a shared build box without asking.

## See also
[mingw](mingw.md) · [cygwin](cygwin.md) · [msvc](msvc.md) · [ssh](../transports/ssh.md)
