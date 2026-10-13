# remote-debug

Site key: `access.debug` (`kind`, `host`, `port`) in [../../sites.yaml](../../sites.yaml). Bullets: `[seeded]` = not yet run here.

## Principle
Debugger *server/stub* runs next to the program on the target; the *client* runs here with the **unstripped binary and the sysroot**. The target only needs the stripped binary. One owner per debug port; kill the stub when done.

## gdbserver (Linux, Android, mingw)
- `[seeded]` Target: `gdbserver :<port> ./prog args` (launch) or `gdbserver --attach :<port> <pid>`; `gdbserver --multi :<port>` + `target extended-remote` to re-run. Host: `gdb-multiarch` (or `<triple>-gdb`), then `file ./prog`, `set sysroot <sysroot>` (rsynced from the target, or the NDK's), `target remote <host>:<port>`.
- `[seeded]` If the port is not reachable: `ssh -N -L <port>:localhost:<port>` ([ssh](ssh.md#tunnels)) or `adb forward tcp:<port> tcp:<port>` ([adb](adb.md)), then `target remote localhost:<port>`.
- `[seeded]` `set solib-search-path` when libs are not under the sysroot. `info sharedlibrary` shows which ones resolved. Used by: [linux-glibc](../targets/linux-glibc.md#debug), [android-ndk](../targets/android-ndk.md#debug), [mingw](../targets/mingw.md#debug), [musl](../targets/musl.md#debug).

## lldb-server
- `[seeded]` Target: `lldb-server platform --server --listen "*:<port>"`; host: `lldb`, `platform select remote-linux` (or `remote-android`), `platform connect connect://<host>:<port>`, `file ./prog`, `run`/`attach`.

## Windows
- `[seeded]` cdb/windbg: `cdb -server tcp:port=<port> prog.exe` on the target, `windbg -remote tcp:server=<host>,port=<port>` here. Visual Studio: `msvsmon.exe` on the target (default port 4026 for VS 2022), attach from VS. Symbols: PDBs next to the exe or `_NT_SYMBOL_PATH`. See [msvc](../targets/msvc.md#debug).
- `[seeded]` Wine: `winedbg --gdb prog.exe` prints a gdb stub; connect with gdb. See [mingw](../targets/mingw.md#debug).

## qemu
- `[seeded]` qemu-user: `qemu-<arch> -g <port> ./prog` waits for gdb at `localhost:<port>`; qemu-system: `-s -S`.

## node inspector
- `[seeded]` `node --inspect-brk=<port> prog.js` (wasm via emscripten/wasi too); attach Chrome (`chrome://inspect`) or a DAP client. Bind to localhost and tunnel; never expose the inspector port. See [emscripten](../targets/emscripten.md#debug), [wasi](../targets/wasi.md#debug).

## Gotchas
- `[seeded]` Wrong arch/sysroot gives garbage backtraces ("Cannot access memory", unresolved frames): verify `file prog` and the libc build id match.
- `[seeded]` ASLR: gdb disables it for launched programs; attach does not.

## See also
[activities/debug.md](../activities/debug.md)
