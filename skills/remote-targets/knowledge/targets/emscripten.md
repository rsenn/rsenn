# emscripten

C/C++ to WebAssembly + JS glue. Definition: [../../targets.yaml](../../targets.yaml) (`emscripten`). Bullets: `[seeded]` = not yet run here.

## Identity
- `[seeded]` `emcc`/`em++` from emsdk (`source emsdk_env.sh`). Output `x.js` + `x.wasm` (or `x.html`). Environments: `node`, `web`, `worker` (`-sENVIRONMENT=node,web`).

## Build
- `[seeded]` `emcc -O2 prog.c -o prog.js`; CMake: `emcmake cmake -B build && cmake --build build`; autotools: `emconfigure ./configure && emmake make`. Helper in rsenn projects: `cfg-emscripten`. Hub: [activities/build.md](../activities/build.md).
- `[seeded]` Useful flags: `-sALLOW_MEMORY_GROWTH`, `-sEXIT_RUNTIME=1`, `-sNODERAWFS=1` (real fs in node), `-sMODULARIZE`, `-sEXPORTED_FUNCTIONS=_main,_foo`, `-pthread` (needs SharedArrayBuffer), `-sSTACK_SIZE=...`.

## Test
- `[seeded]` `node prog.js args`; exit code is the process exit code when `EXIT_RUNTIME=1`. Browser: serve the directory (`python3 -m http.server`, or `emrun --no_browser --port N prog.html`). Hub: [activities/test.md](../activities/test.md).

## Debug
- `[seeded]` `-g` (DWARF) / `-gsource-map`; `node --inspect-brk prog.js` and attach Chrome DevTools or any DAP client; Chrome has a "C/C++ DevTools Support (DWARF)" extension. `-sASSERTIONS=2`, `-sSAFE_HEAP`. See [remote-debug](../transports/remote-debug.md#node-inspector).

## Trace
- `[seeded]` `console.log`/`printf`, `--profiling-funcs`, `-sASSERTIONS`, `node --cpu-prof`, Chrome Performance tab. Hub: [activities/trace.md](../activities/trace.md).

## Instrument
- `[seeded]` `-fsanitize=address`/`undefined`, `-sSAFE_HEAP`, `-sSTACK_OVERFLOW_CHECK=2`; code size: `wasm-opt`, `twiggy`, `-Wl,-Map`. Hub: [activities/instrument.md](../activities/instrument.md).

## Package
- `[seeded]` Ship `.js` + `.wasm` (+ `.data` for preloaded files); for the web add an HTML shell. `-Oz` + `wasm-opt -Oz` + brotli for size. Hub: [activities/package.md](../activities/package.md).

## Transfer
- `[seeded]` Plain static hosting; pthreads/SharedArrayBuffer need `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers. Hub: [activities/transfer.md](../activities/transfer.md).

## Gotchas
- `[seeded]` Blocking main loops hang a browser tab: use `emscripten_set_main_loop` or `-sASYNCIFY`.
- `[seeded]` Sockets are emulated over WebSocket; no raw TCP. File system is in-memory (MEMFS) unless `NODERAWFS`/IDBFS/`-lnodefs.js`.
- `[seeded]` `.wasm` must be served with `application/wasm` for streaming instantiation.

## See also
[wasi](wasi.md)
