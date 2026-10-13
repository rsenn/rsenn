# msvc

Microsoft toolchain on Windows. Definition: [../../targets.yaml](../../targets.yaml) (`msvc`). Bullets: `[seeded]` = not yet run here.

## Identity
- `[seeded]` `cl.exe`/`link.exe`/`nmake`, plus `clang-cl`. Environment comes from `vcvarsall.bat <x64|x86|arm64>` (or the Developer Command Prompt); without it `cl` is not found.

## Build
- `[seeded]` From ssh (default shell cmd): `cmd /c "\"C:\Program Files\Microsoft Visual Studio\2022\<Edition>\VC\Auxiliary\Build\vcvarsall.bat\" x64 && cl /nologo /O2 /MT prog.c"`. Locate VS with `vswhere -latest -property installationPath`. Hub: [activities/build.md](../activities/build.md).
- `[seeded]` CMake: `cmake -G Ninja` inside the vcvars environment, or `-G "Visual Studio 17 2022" -A x64`. `/MT` = static CRT (portable), `/MD` = DLL CRT (needs the VC redistributable).
- `[seeded]` From Linux: `xwin` (Windows SDK+CRT download) + `clang-cl --target=x86_64-pc-windows-msvc`, no Windows box needed to compile.

## Test
- `[seeded]` Run on Windows via ssh; PowerShell vs cmd quoting differs (see [ssh](../transports/ssh.md)). Under wine for smoke tests ([mingw](mingw.md#test)). Hub: [activities/test.md](../activities/test.md).

## Debug
- `[seeded]` Local: `cdb`/`windbg` (Windows SDK Debugging Tools). Remote: `cdb -server tcp:port=<port>` + `windbg -remote tcp:server=<host>,port=<port>`; or `msvsmon.exe` (Visual Studio Remote Debugger) for VS; PDBs (`/Zi`, `/DEBUG`) must be next to the binary or on a symbol path ([remote-debug](../transports/remote-debug.md)). clang-cl can emit DWARF for gdb/lldb, usually PDB is preferred.

## Trace
- `[seeded]` Process Monitor, ETW (`tracelog`, `wpr`/`wpa`), `dumpbin /dependents`. Hub: [activities/trace.md](../activities/trace.md).

## Instrument
- `[seeded]` `/fsanitize=address` (VS 2019 16.9+), Application Verifier, `/RTC1` in debug, `/GS`; coverage via `OpenCppCoverage`. Hub: [activities/instrument.md](../activities/instrument.md).

## Package
- `[seeded]` zip with `/MT` exe; or cpack ZIP/WIX/NSIS. Include PDBs separately. Hub: [activities/package.md](../activities/package.md).

## Transfer
- `[seeded]` Windows OpenSSH (`scp`, `ssh host "type f"`), RDP drive mapping `\\tsclient\<name>` ([rdp](../transports/rdp.md)), sshfs from Linux. Hub: [activities/transfer.md](../activities/transfer.md).

## Gotchas
- `[seeded]` The OpenSSH server's default shell is `cmd.exe`; `&&` works, bash syntax does not. Change with the `DefaultShell` registry value under `HKLM\SOFTWARE\OpenSSH`.
- `[seeded]` Non-interactive ssh sessions may lack network-drive mappings and GUI access (session 0).
- `[seeded]` C99/C11 gaps: use `/std:c11`, VLAs unsupported, `__attribute__` unknown; guard with `_MSC_VER`.

## See also
[mingw](mingw.md) · [msys](msys.md) · [rdp](../transports/rdp.md)
