# mingw

mingw-w64 cross-compiling from Linux to native Windows. Definition: [../../targets.yaml](../../targets.yaml) (`mingw`). Bullets: `[seeded]` = not yet run here. On-Windows variant: [msys](msys.md).

## Identity
- `[seeded]` `x86_64-w64-mingw32-gcc`, `i686-w64-mingw32-gcc`; C runtime `msvcrt` (old default) or `ucrt` (distro/toolchain dependent). No POSIX layer: no `fork`, `sigaction`, `mmap`; sockets are Winsock (`ws2_32`).

## Build
- `[seeded]` `x86_64-w64-mingw32-gcc -O2 -static -o prog.exe prog.c -lws2_32`; CMake `-DCMAKE_SYSTEM_NAME=Windows -DCMAKE_C_COMPILER=x86_64-w64-mingw32-gcc -DCMAKE_RC_COMPILER=x86_64-w64-mingw32-windres`. Helpers in rsenn projects: `cfg-mingw64`, `cfg-mingw32`. Hub: [activities/build.md](../activities/build.md).
- `[seeded]` Dependencies of a binary: `x86_64-w64-mingw32-objdump -p prog.exe | grep 'DLL Name'`.

## Test
- `[seeded]` `wine prog.exe` on the build host (smoke test: report as "under wine"), or copy to a Windows [site](../../sites.yaml) and run via [ssh](../transports/ssh.md). Exit codes pass through wine. Hub: [activities/test.md](../activities/test.md).
- `[verified 2026-10-22]` Console API tests under wine need a tty: started from a non-tty shell, `CreateFileA("CONOUT$")` fails (no console). Inside a tmux pane it works even with stdout redirected to a file: `tmux new-session -d -s t "timeout 30 wine prog.exe > out 2>err; echo rc=\$? >> out"`, then poll `tmux has-session`. The wine console reported a window of rows 0..149, width 80.
- `[verified 2026-10-22]` Input code can be tested without a keyboard: `WriteConsoleInputW` on `CONIN$` injects key/resize/focus events that `ReadConsoleInputW` returns.

## Debug
- `[seeded]` `winedbg --gdb prog.exe` gives a gdb stub under wine; on Windows run `gdb` (from MSYS2) or `gdbserver.exe` and connect with `x86_64-w64-mingw32-gdb`/`gdb-multiarch` ([remote-debug](../transports/remote-debug.md)). DWARF symbols come from `-g`; keep an unstripped copy.

## Trace
- `[seeded]` Wine: `WINEDEBUG=+relay,+loaddll,+seh wine prog.exe 2> log`. Windows: Process Monitor, `Dependencies`/`dumpbin /dependents`. Hub: [activities/trace.md](../activities/trace.md).

## Instrument
- `[seeded]` ASan is not supported by gcc-mingw; clang-mingw has partial support. UBSan works with clang; size: `size`, `objdump -h`. Hub: [activities/instrument.md](../activities/instrument.md).

## Package
- `[seeded]` zip containing `prog.exe` (static) or with the needed DLLs (`libgcc_s_seh-1.dll`, `libstdc++-6.dll`, `libwinpthread-1.dll`) next to it; or an installer via cpack NSIS/WIX. Hub: [activities/package.md](../activities/package.md).

## Transfer
- `[seeded]` ssh to a Windows host's OpenSSH (scp works; use forward slashes or `C:/path`), or an RDP drive mapping ([rdp](../transports/rdp.md)). Hub: [activities/transfer.md](../activities/transfer.md).

## Gotchas
- `[seeded]` Missing `libgcc_s_seh-1.dll`/`libwinpthread-1.dll` on the target: link `-static` (or `-static-libgcc -static-libstdc++`).
- `[seeded]` Wine prefixes pick up state between runs; use a fresh `WINEPREFIX` for repeatability.
- `[seeded]` Console output encoding: UTF-8 needs a manifest or `SetConsoleOutputCP(65001)`.
- `[verified 2026-10-22]` Under wine, a program that injected a FOCUS_EVENT into an already drained console input printed all its output and then never exited (plain API calls, no project code). Always run wine tests under `timeout` and `setvbuf(stdout, 0, _IONBF, 0)`: with stdout redirected, buffered output is lost when the timeout kills it.

## See also
[msys](msys.md) · [msvc](msvc.md) · [cygwin](cygwin.md)
