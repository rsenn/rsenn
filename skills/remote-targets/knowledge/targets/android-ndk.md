# android-ndk

Definition: [../../targets.yaml](../../targets.yaml) (`android-ndk`). Bullets: `[seeded]` = from general knowledge, not yet run here.

## Identity
- `[seeded]` Bionic, API level chosen at build time (`android-24` is a sane floor for 64-bit). ABIs: `arm64-v8a` (aarch64-linux-android), `armeabi-v7a` (armv7a-linux-androideabi), `x86_64`, `x86`.
- `[seeded]` Standalone executables are PIE; they live in `/data/local/tmp` (writable and executable for the shell user). Not a Termux environment: see [termux](termux.md).

## Build
- `[seeded]` Direct: `$NDK/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android24-clang -O2 -o prog prog.c` (the `24` is the API level; `armv7a-linux-androideabi24-clang` for 32-bit).
- `[seeded]` CMake: `-DCMAKE_TOOLCHAIN_FILE=$NDK/build/cmake/android.toolchain.cmake -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-24`.
- `[seeded]` `-static` produces a self-contained executable (avoids linker/libc API mismatches); `-pie` is default. Helper in rsenn projects: `cfg-android`. Hub: [activities/build.md](../activities/build.md).

## Test
- `[seeded]` `adb push prog /data/local/tmp/ && adb shell chmod +x /data/local/tmp/prog && adb shell /data/local/tmp/prog args`. With shell protocol v2 (modern adb) the exit status of `adb shell` is the command's; check with `echo $?`. Use `adb exec-out` for binary-clean stdout. Hub: [activities/test.md](../activities/test.md).

## Debug
- `[seeded]` `gdbserver` is at `$NDK/prebuilt/android-arm64/gdbserver/gdbserver` (push to `/data/local/tmp`); `adb forward tcp:5039 tcp:5039`; on device `gdbserver :5039 ./prog`; on host `gdb-multiarch` / NDK lldb with `target remote :5039`. Keep unstripped binaries on the host ([remote-debug](../transports/remote-debug.md)).
- `[seeded]` NDK also ships `lldb-server` under `lib/clang/<ver>/lib/linux/<arch>/` for LLDB `platform connect`.

## Trace
- `[seeded]` `adb logcat -d -s TAG` for logs; `strace` is not on stock devices (push a static build); `simpleperf` ships in the NDK (`$NDK/simpleperf`) for CPU profiling; `perfetto`/`atrace` exist on device. Hub: [activities/trace.md](../activities/trace.md).

## Instrument
- `[seeded]` ASan/UBSan: `-fsanitize=address` needs the matching `libclang_rt.asan-<arch>-android.so` pushed next to the binary and `LD_LIBRARY_PATH` set; HWASan on arm64 Android 14+. Hub: [activities/instrument.md](../activities/instrument.md).

## Package
- `[seeded]` For standalone tools: `tar.gz`/zip of the binaries. For apps: gradle/APK is out of scope here. Hub: [activities/package.md](../activities/package.md).

## Transfer
- `[seeded]` `adb push/pull` ([adb](../transports/adb.md)); exec only from `/data/local/tmp` (not `/sdcard`, which is `noexec`). Hub: [activities/transfer.md](../activities/transfer.md).

## Gotchas
- `[seeded]` "CANNOT LINK EXECUTABLE ... cannot locate symbol": built for a higher API level than the device runs. Lower `ANDROID_PLATFORM` or link `-static`.
- `[seeded]` SELinux: `adb shell` domain can exec from `/data/local/tmp`, app domains (e.g. Termux on Android 10+) cannot exec files they did not install themselves from there.
- `[seeded]` `adb shell` mangles CRLF on very old adb; use `exec-out`.

## See also
[termux](termux.md) · [adb](../transports/adb.md) · [remote-debug](../transports/remote-debug.md)
