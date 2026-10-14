# termux

Definition: [../../targets.yaml](../../targets.yaml) (`termux`). Bullets: `[seeded]` = from general knowledge, not yet run here.

## Identity
- `[seeded]` Bionic libc, but a private prefix: `PREFIX=/data/data/com.termux/files/usr`, `HOME=/data/data/com.termux/files/home`, tmp is `$TMPDIR` (`$PREFIX/tmp`). No `/usr`, `/bin`, `/tmp`.
- `[seeded]` Packages via `pkg`/`apt` (Termux repos, not Debian). Install from F-Droid / GitHub builds; the Play Store build is outdated.
- `[seeded]` Triple `aarch64-linux-android` (also arm, x86_64).

## Build
- `[seeded]` Native (simplest): `pkg install clang cmake make ninja pkg-config git`, then build as on Linux. Compiler is clang; `gcc` is a wrapper around it (see the compiler note below).
- `[seeded]` Cross from a host: use the NDK ([android-ndk.md#build](android-ndk.md#build)) but link against Termux libs only if you have a Termux sysroot (copy `$PREFIX/{include,lib}` from the device); otherwise build with the NDK and ship static or self-contained.
- `[seeded]` Executables must find libs in `$PREFIX/lib`; binaries built outside Termux need `-Wl,-rpath,$PREFIX/lib` or `LD_LIBRARY_PATH`.
- `[verified 2026-10-14]` Compilers: `clang` 21.1.8 (`gcc`/`cc` resolve to `clang-21`) and `tcc` 0.9.27; `make cmake ninja git python3 node wasmtime rsync` present. A real gcc may come from an extra repository (`pkg install tur-repo`, then `pkg search gcc`), not yet tried. Check which one a project really got: `gcc --version` (says clang) and `readlink -f $(command -v gcc)`.
- `[seeded]` Helper in rsenn projects: `cfg-termux`. See [activities/build.md](../activities/build.md).

## Test
- `[seeded]` Run tests in a Termux shell via ssh to Termux's sshd, not `adb shell` (adb shell lacks Termux's PATH/LD_LIBRARY_PATH). Hub: [activities/test.md](../activities/test.md).
- `[seeded]` Scripts with `#!/usr/bin/env sh` fail unless `termux-exec` is installed (`pkg install termux-exec`) or the shebang is `#!$PREFIX/bin/sh` / `#!/data/data/com.termux/files/usr/bin/sh`.

## Debug
- `[verified 2026-10-14]` **Why gdb/lldb "do not work"**: Termux binaries cannot be exec'd without `LD_PRELOAD=libtermux-exec.so` (Android 15: `Permission denied` from app data), which routes every exec through `/system/bin/linker64`. The debugger therefore sees `linker64` as the program: `info sharedlibrary` lists only `/system/bin/linker64` (not even libc), the thread is named `linker64`, the crash PC shows as `?? ()`, `break main` never resolves, and `bt` ends with "previous frame identical to this frame". The DWARF is fine (clang `-g` gives `with debug_info`); the debuggers just never learn where the program is mapped. Versions seen: gdb 16.3, lldb 21.1.8, clang 21.1.8, Android 15. Tried without effect: gdb attach (`-p`), `linker64 <abs path>` as the inferior, `set exec-wrapper env -u LD_PRELOAD` (dies at startup), `TERMUX_EXEC__SYSTEM_LINKER_EXEC__MODE=disable`, lldb attach.
- `[verified 2026-10-14]` **Working workaround (gdb)**: give gdb the load base by hand. Start the program (or attach), read the base from the first mapping of the exe, then `add-symbol-file`:
  ```
  base=$(grep "/path/to/prog" /proc/$pid/maps | head -1 | cut -d- -f1)
  gdb -batch -p $pid -ex "add-symbol-file ./prog -o 0x$base" -ex continue -ex bt
  ```
  Result: full backtrace with function names, source lines and arguments (`inner (p=0x0) at wait.c:2` / `outer` / `main`); frames inside libc remain `?? ()`. The program must be running (use a start-up pause, `sleep`, or `raise(SIGSTOP)`) so the base is known before the crash; an automated launcher can start it, wait for the maps entry, then attach. Not yet tried for lldb (`target modules load --file prog --slide 0x$base`).
- `[verified 2026-10-14]` **Crash location without any debugger**: `strace -f ./prog` shows `SIGSEGV {si_code=SEGV_MAPERR, si_addr=...}`; ASan with `ASAN_OPTIONS=symbolize=0` prints raw `module+offset` frames that `llvm-symbolizer --obj=prog 0xOFFSET` (or `addr2line -e prog`) resolves on the host or device. The built-in symbolizer fails ("Can't read from symbolizer at fd 3"), even with `ASAN_SYMBOLIZER_PATH` set or `LD_PRELOAD` unset, so use the offline route.
- `[verified 2026-10-14]` **tcc**: `tcc -g -o x x.c` failed to link here with `Unknown relocation type for got: 0` (tcc 0.9.27, AArch64 Linux, PIE-style code); no debug build from tcc. Use clang for anything you want to debug.
- `[verified 2026-10-14]` **gprof**: `clang -pg` fails at link with `undefined symbol: _mcount`; gprof is not usable with bionic. Use `perf`/`simpleperf` if available, `strace -c`, or ASan/UBSan plus timing.
- `[seeded]` `pkg install lldb gdb` on the device and debug locally over ssh, or run `gdbserver`/`lldb-server` on the device and connect from the host over ssh `-L` ([remote-debug](../transports/remote-debug.md)).
- `[verified 2026-10-14]` ptrace of your own children and attach to your own processes works (strace, gdb, lldb all attach and catch SIGSEGV); only symbol resolution is broken, see above.

## Trace
- `[seeded]` `pkg install strace ltrace`; `strace -f -o log cmd` works for same-uid children. `logcat` needs `adb`; inside Termux `logcat -d` shows only your app's lines on recent Android. See [activities/trace.md](../activities/trace.md).

- `[verified 2026-10-14]` **Profiling (callgrind and friends)**: `valgrind` (so no callgrind/cachegrind/massif/memcheck), `perf`, `heaptrack` and `gperftools` are **not** in the Termux or TUR repos; `clang -pg` fails ([debug](#debug)). What exists: Android's `/system/bin/simpleperf` (kernel `perf_event_paranoid` is -1) but it refuses to run until `adb shell setprop security.perf_harden 0` is done once per boot (changes a device property: ask first; needs a working adb connection to the phone), `strace -c` (syscall counts/time), `ltrace -c` (library-call counts). `[verified 2026-10-14]` simpleperf from a Termux (app uid) shell, after `perf_harden=0`: `simpleperf stat|record <cmd>` fails with "Running child command in app uid isn't allowed", so attach to a running process instead (`simpleperf record --call-graph fp -f 1000 -p $pid --duration 4`); `record` then fails with "Failed to SetProperty debug.perf_event_max_sample_rate to 100000" because the property is unset (kernel limit is already 100000) and an app uid cannot set it. Next step needing the user: `adb shell setprop debug.perf_event_max_sample_rate 100000`, then retry. This simpleperf (Samsung build, `1.build.G991BXXSJHZC2`) has no `--no-set-sys-settings`. Frame-pointer builds (`-fno-omit-frame-pointer`) are the prerequisite for `--call-graph fp`.
- `[seeded]` Fallbacks: (1) **run the same code on the host** under `valgrind --tool=callgrind` / `perf` and use `kcachegrind`/`callgrind_annotate`: instruction counts are architecture-independent enough for hot-spot hunting; only the device-specific timing needs the phone. (2) poor-man's sampling: repeat `gdb -batch -p $pid -ex "add-symbol-file ./prog -o 0x$base" -ex bt` and count the top frames. (3) manual instrumentation: `-finstrument-functions` hooks or `clock_gettime` counters. (4) sanitizers for memory problems instead of memcheck ([instrument](#instrument)): ASan/LSan/UBSan work, see the symbolizer note in [debug](#debug).

## Instrument
- `[seeded]` clang `-fsanitize=address,undefined` works in Termux's clang for native builds. `pkg install valgrind` is limited/unavailable on many arch/Android combos. See [activities/instrument.md](../activities/instrument.md).

## Package
- `[seeded]` Simple: `tar.gz` extracted to `$PREFIX` (watch hardcoded paths). Proper: a `.deb` for Termux (termux-packages `build.sh`, or `dpkg-deb` with files under `data/data/com.termux/files/usr`). See [activities/package.md](../activities/package.md).

## Transfer
- `[verified-by-user]` Mount both Termux halves with one sshfs: from a host, `sshfs <alias>:.. <mnt> -o reconnect,transform_symlinks` (remote `..` is the parent of Termux `$HOME`, which is the parent of `$PREFIX`'s dir), giving `<mnt>/home/` (= `$HOME`) and `<mnt>/usr/` (= `$PREFIX`). `transform_symlinks` rewrites absolute symlinks into the mount. See [sshfs](../transports/sshfs.md).
- `[verified 2026-10-14]` Test uncommitted work without committing and without clobbering phone-side edits: [activities/sync.md](../activities/sync.md) (`scripts/rt-sync.sh run termux -- '<cmd>'`, then `pull` / `merge`).
- `[seeded]` List git projects in the mount: `(cd <mnt>/home/; set -- */.git; echo "${@%/*}")` (POSIX sh; no `find`).
- `[seeded]` sshd: `pkg install openssh` then `sshd` (port 8022, user `u0_aNNN`; password via `passwd`, or put a key in `~/.ssh/authorized_keys`). `scp -P 8022`, `rsync -e 'ssh -p 8022'` (needs `pkg install rsync`), sshfs ([sshfs](../transports/sshfs.md)).
- `[seeded]` Via adb: `adb push f /sdcard/` then copy in a Termux shell after `termux-setup-storage`; `/sdcard` is `noexec`, never run from it. Hub: [activities/transfer.md](../activities/transfer.md).

## Gotchas
- `[seeded]` sshd dies when Android kills Termux: `termux-wake-lock`, disable battery optimisation for Termux.
- `[seeded]` Android 12+ "phantom process killer" kills long background jobs (children of Termux). Workaround via adb: `adb shell device_config put activity_manager max_phantom_processes 2147483647` (and `settings put global settings_enable_monitor_phantom_procs false`) .
- `[seeded]` No root, no `/proc` listing of other apps, `getifaddrs`/`/proc/net` restrictions on Android 11+, `ping` may lack permission.
- `[seeded]` `X11` forwarding (`ForwardX11`) only works if the Termux side has an X client and `xauth` (`pkg install xorg-xauth`), and the host runs an X server.
- `[seeded]` An ssh config `ConnectTimeout 0` means no timeout: pass `-o ConnectTimeout=10` for scripted use so a sleeping phone cannot hang the session.

## See also
[android-ndk](android-ndk.md) · [ssh](../transports/ssh.md) · [adb](../transports/adb.md) · [sshfs](../transports/sshfs.md)
