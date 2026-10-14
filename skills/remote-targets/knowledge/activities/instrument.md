# Activity: instrument

Sanitizers, coverage, size accounting. Back to [INDEX](../INDEX.md). Bullets: `[seeded]`.

| Target | What works | Section |
|---|---|---|
| termux | clang ASan/UBSan native; no valgrind/perf/gprof (profile on host or via simpleperf) | [instrument](../targets/termux.md#instrument) |
| android-ndk | ASan with pushed runtime; HWASan on new arm64 | [instrument](../targets/android-ndk.md#instrument) |
| linux-glibc | ASan/UBSan/TSan, valgrind, gcov | [instrument](../targets/linux-glibc.md#instrument) |
| musl | UBSan only (static); no ASan | [instrument](../targets/musl.md#instrument) |
| dietlibc | size only | [instrument](../targets/dietlibc.md#instrument) |
| mingw / cygwin | UBSan; clang-mingw partial ASan | [mingw](../targets/mingw.md#instrument) [cygwin](../targets/cygwin.md#instrument) |
| msys | clang env ASan/UBSan | [instrument](../targets/msys.md#instrument) |
| msvc | `/fsanitize=address`, AppVerifier | [instrument](../targets/msvc.md#instrument) |
| cosmo | size via `-mtiny`; `-mdbg` UBSan runtime | [instrument](../targets/cosmo.md#instrument) |
| emscripten / wasi | ASan (emcc), `wasm-opt`/`twiggy` size | [emscripten](../targets/emscripten.md#instrument) [wasi](../targets/wasi.md#instrument) |

- `[seeded]` Size: `size prog`, `nm --size-sort -S prog | tail -20`, linker map. Coverage: build with `--coverage`, run on target, pull `*.gcda`, run `gcov`/`lcov` here with the same source tree path.
