# Activity: test

Cross-target hub. Back to [INDEX](../INDEX.md). Bullets: `[seeded]`.

## Verification levels (use these words)
- `builds` compiled and linked; `smoke-tested` ran once; `tested` the suite ran; add where: **on device**, **under qemu/wine/node**.
- `[seeded]` Emulated results are never reported as on-device. Exit code is the primary signal; capture stdout/stderr to a file and copy it back.

## How to run per target
| Target | Run with | Section |
|---|---|---|
| termux | ssh into Termux | [test](../targets/termux.md#test) |
| android-ndk | `adb shell` from `/data/local/tmp` | [test](../targets/android-ndk.md#test) |
| linux-glibc | ssh; qemu-user for smoke | [test](../targets/linux-glibc.md#test) |
| musl / dietlibc | host if same arch, else qemu or a board | [musl](../targets/musl.md#test) [dietlibc](../targets/dietlibc.md#test) |
| mingw | wine, or Windows over ssh | [test](../targets/mingw.md#test) |
| msys / cygwin / msvc | Windows over ssh (`bash -lc` / cmd) | [msys](../targets/msys.md#test) [cygwin](../targets/cygwin.md#test) [msvc](../targets/msvc.md#test) |
| emscripten | node | [test](../targets/emscripten.md#test) |
| wasi | wasmtime | [test](../targets/wasi.md#test) |

## Patterns
- `[seeded]` Time-box every remote run (`timeout`); on hang, collect `ps`, then kill. Run the suite twice to catch flakes from thermal throttling or cold caches.
- `[seeded]` Transports: [ssh](../transports/ssh.md#running-commands), [adb](../transports/adb.md#commands).
