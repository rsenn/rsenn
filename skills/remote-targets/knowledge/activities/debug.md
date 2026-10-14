# Activity: debug

Cross-target hub. Transport details: [remote-debug](../transports/remote-debug.md). Back to [INDEX](../INDEX.md). Bullets: `[seeded]`.

## Decision
1. Can you reproduce under an emulator on this host (qemu-user, wine, node)? Debug there first: fastest.
2. Else run a debug server on the target and the client here, with unstripped binary + sysroot.
3. Else debug over ssh with the debugger installed on the target.
4. Else use logs/traces ([trace](trace.md)).

| Target | Debugger | Section |
|---|---|---|
| termux | gdb/lldb on device, or server | [debug](../targets/termux.md#debug) |
| android-ndk | gdbserver + forward | [debug](../targets/android-ndk.md#debug) |
| linux-glibc | gdbserver / gdb | [debug](../targets/linux-glibc.md#debug) |
| musl / dietlibc | gdb on static binary | [musl](../targets/musl.md#debug) [dietlibc](../targets/dietlibc.md#debug) |
| mingw | winedbg --gdb / gdb on Windows | [debug](../targets/mingw.md#debug) |
| msys / cygwin | gdb on Windows | [msys](../targets/msys.md#debug) [cygwin](../targets/cygwin.md#debug) |
| msvc | cdb/windbg/msvsmon | [debug](../targets/msvc.md#debug) |
| cosmo | gdb on `prog.dbg` / `prog.aarch64.elf`; `--strace` `--ftrace` | [debug](../targets/cosmo.md#debug) |
| emscripten / wasi | node inspector / wasmtime | [emscripten](../targets/emscripten.md#debug) [wasi](../targets/wasi.md#debug) |

- `[seeded]` Build with `-g -O0` (or `-Og`) for debugging; ship stripped, keep the unstripped file and match by build-id (`readelf -n`).
- `[seeded]` Kill the debug server and any `ssh -L`/`adb forward` when done.
