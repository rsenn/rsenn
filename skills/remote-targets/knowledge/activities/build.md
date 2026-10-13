# Activity: build

Cross-target hub. Site keys: `dirs.work`, `targets`. Back to [INDEX](../INDEX.md). Bullets: `[seeded]`.

## Decide where to compile
- `[seeded]` Prefer compiling **on this host** (fast, one toolchain, reproducible) and only run on the target. Compile **on the target** when no cross toolchain/sysroot exists or the build is tiny ([termux](../targets/termux.md#build), [msvc](../targets/msvc.md#build), [msys](../targets/msys.md#build), [cygwin](../targets/cygwin.md#build)).
- `[seeded]` Cross builds need a sysroot that matches the target's libc *version*; get it from the device ([linux-glibc](../targets/linux-glibc.md#build)).
- `[seeded]` One build directory per target (`build/<target>/`); never mix. rsenn projects: `cfg-*` helpers in `cfg-cmake.sh`.

## Per target
| Target | Compiler | Section |
|---|---|---|
| termux | clang (native) / NDK | [build](../targets/termux.md#build) |
| android-ndk | NDK clang `<triple><api>-clang` | [build](../targets/android-ndk.md#build) |
| linux-glibc | gcc-`<triple>` + sysroot | [build](../targets/linux-glibc.md#build) |
| musl | musl-gcc / zig cc | [build](../targets/musl.md#build) |
| dietlibc | `diet gcc` | [build](../targets/dietlibc.md#build) |
| mingw | `<arch>-w64-mingw32-gcc` | [build](../targets/mingw.md#build) |
| msys | gcc/clang in an MSYSTEM | [build](../targets/msys.md#build) |
| cygwin | gcc in Cygwin | [build](../targets/cygwin.md#build) |
| msvc | cl / clang-cl after vcvars | [build](../targets/msvc.md#build) |
| emscripten | emcc | [build](../targets/emscripten.md#build) |
| wasi | wasi-sdk clang | [build](../targets/wasi.md#build) |

Report build results as: toolchain, result, binary size, how it was run. Feeds the `release-management` skill.
