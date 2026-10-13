# Activity: trace

Cross-target hub. Back to [INDEX](../INDEX.md). Bullets: `[seeded]`.

| Need | Linux-like targets | Windows | Wasm |
|---|---|---|---|
| syscalls | `strace -f -tt -o log` ([linux-glibc](../targets/linux-glibc.md#trace), [musl](../targets/musl.md#trace), [dietlibc](../targets/dietlibc.md#trace), [termux](../targets/termux.md#trace)) | Cygwin/MSYS `strace` ([cygwin](../targets/cygwin.md#trace), [msys](../targets/msys.md#trace)); Process Monitor ([msvc](../targets/msvc.md#trace)) | - |
| library calls | `ltrace` (dynamic only) | `WINEDEBUG=+relay` ([mingw](../targets/mingw.md#trace)) | - |
| CPU profile | `perf record -g`, `simpleperf` ([android-ndk](../targets/android-ndk.md#trace)) | ETW / `wpr` | `node --cpu-prof` ([emscripten](../targets/emscripten.md#trace)) |
| logs | `journalctl`, `dmesg`, `adb logcat` | Event Viewer | console |
| DLL/shared-lib deps | `ldd`, `readelf -d` | `objdump -p`, `dumpbin /dependents`, `ntldd`, `cygcheck` | `wasm-objdump -x` ([wasi](../targets/wasi.md#trace)) |

- `[seeded]` Write traces to files on the target, `scp`/`adb pull` them, analyze here ([transfer](transfer.md)). Traces can contain secrets (env, paths, tokens): do not paste them into `LESSONS.md`.
