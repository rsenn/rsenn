# cygwin

Cygwin on a Windows machine. Definition: [../../targets.yaml](../../targets.yaml) (`cygwin`). Bullets: `[seeded]` = not yet run here.

## Identity
- `[seeded]` Full POSIX emulation in `cygwin1.dll` (fork, signals, ptys, `/proc`). Binaries need `cygwin1.dll` (and the Cygwin root) at run time. Triple `x86_64-pc-cygwin`. Windows drives under `/cygdrive/c`.

## Build
- `[seeded]` Install packages unattended: `setup-x86_64.exe -q -P gcc-core,gcc-g++,make,cmake,ninja,pkg-config,git`. Build with plain `gcc`/`cmake` in a Cygwin shell (`C:\cygwin64\bin\bash.exe -lc "<cmd>"`). Hub: [activities/build.md](../activities/build.md).
- `[seeded]` Cross from Linux is possible (`x86_64-pc-cygwin-gcc`) but needs a built cross toolchain; rarely worth it.

## Test
- `[seeded]` Run inside Cygwin bash; `fork`-heavy test suites are slow (fork emulation). Exit codes pass through `bash -lc`. Hub: [activities/test.md](../activities/test.md).

## Debug
- `[seeded]` `gdb` from the Cygwin package set; attach with `gdb -p <winpid>` using `cygstart`/`ps -W` to map pids. Remote: `gdbserver` is not routinely packaged; prefer gdb over ssh ([remote-debug](../transports/remote-debug.md)).

## Trace
- `[seeded]` `strace` (Cygwin's own; `strace -o log prog`), `cygcheck prog.exe` for DLL deps. Hub: [activities/trace.md](../activities/trace.md).

## Instrument
- `[seeded]` gcc ASan is not available; use UBSan and `gcov`. Hub: [activities/instrument.md](../activities/instrument.md).

## Package
- `[seeded]` Zip with `cygwin1.dll` + needed `cyg*.dll` (`cygcheck` lists them), or a Cygwin package via `cygport`. Hub: [activities/package.md](../activities/package.md).

## Transfer
- `[seeded]` `ssh-host-config -y` sets up a Cygwin sshd service (or use Windows OpenSSH + `bash -lc`); `rsync` via the Cygwin package. Hub: [activities/transfer.md](../activities/transfer.md).

## Gotchas
- `[seeded]` CRLF in scripts breaks bash: `dos2unix`, or `export SHELLOPTS=igncr`.
- `[seeded]` Permissions come from ACL emulation; files from Windows can look like `0777` or odd owners. `chmod`/`setfacl` as needed.
- `[seeded]` Hard-coded `/usr/bin` paths work only inside the Cygwin root; use `cygpath -w` to convert for native tools.

## See also
[msys](msys.md) · [mingw](mingw.md)
