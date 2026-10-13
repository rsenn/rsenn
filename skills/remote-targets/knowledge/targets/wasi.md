# wasi

WebAssembly System Interface executables in a standalone runtime. Definition: [../../targets.yaml](../../targets.yaml) (`wasi`). Bullets: `[seeded]` = not yet run here.

## Identity
- `[seeded]` wasi-sdk's clang with `--target=wasm32-wasi` (newer: `wasm32-wasip1`, `wasm32-wasip2`) and `--sysroot=$WASI_SDK_PATH/share/wasi-sysroot`. Capability-based: the module sees only directories it is granted.

## Build
- `[seeded]` `$WASI_SDK_PATH/bin/clang -O2 -o prog.wasm prog.c`; CMake: `-DCMAKE_TOOLCHAIN_FILE=$WASI_SDK_PATH/share/cmake/wasi-sdk.cmake`. Helper in rsenn projects: `cfg-wasi`. Hub: [activities/build.md](../activities/build.md).
- `[seeded]` Not available in preview1: sockets (beyond pre-opened), `fork`/`exec`, signals, most of `mmap`; threads need `wasm32-wasi-threads`. Guard with `#ifdef __wasi__`.

## Test
- `[seeded]` `wasmtime run --dir=. prog.wasm -- args` (or `wasmer run`, `wasmedge`, `node --experimental-wasi-unstable-preview1`). Env: `--env K=V`. Exit status is propagated. Hub: [activities/test.md](../activities/test.md).

## Debug
- `[seeded]` Build with `-g`; `wasmtime run -D debug-info -g prog.wasm` exposes a gdb/lldb stub; lldb with wasm support, or Chrome DevTools via node `--inspect` ([remote-debug](../transports/remote-debug.md)).

## Trace
- `[seeded]` `wasmtime --wasm-timeout`, `-W` options, `WASMTIME_LOG`/`RUST_LOG=wasmtime=debug`; `wasm-objdump -x`, `wasm-tools print` for inspection. Hub: [activities/trace.md](../activities/trace.md).

## Instrument
- `[seeded]` Size: `wasm-opt -Oz`, `wasm-strip`, `twiggy top`; fuel/epoch limits in wasmtime for runaway tests. Sanitizers are mostly unavailable. Hub: [activities/instrument.md](../activities/instrument.md).

## Package
- `[seeded]` The `.wasm` file itself (+ a run line with the needed `--dir` grants); optionally AOT `wasmtime compile` (runtime/version-specific). Hub: [activities/package.md](../activities/package.md).

## Transfer
- `[seeded]` One file; any channel ([transfer hub](../activities/transfer.md)).

## Gotchas
- `[seeded]` `ENOENT` on files that exist: the directory was not granted with `--dir`, or the path is outside the preopen.
- `[seeded]` `stdout` buffering and `clock_gettime` precision differ between runtimes; compare in the runtime you ship for.

## See also
[emscripten](emscripten.md)
