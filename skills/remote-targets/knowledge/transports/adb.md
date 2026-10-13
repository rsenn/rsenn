# adb

Site key: `access.adb` in [../../sites.yaml](../../sites.yaml). Bullets: `[seeded]` = not yet run here.

## Connect
- `[seeded]` `adb devices -l` lists devices; with more than one, always `adb -s <serial|host:port> ...`. `adb start-server` / `adb kill-server` to reset a wedged daemon.
- `[seeded]` USB needs developer options + USB debugging + accepting the RSA prompt (shows as `unauthorized` until then). Wi-Fi: Android 11+ "Wireless debugging": `adb pair <host>:<pairport>` once, then `adb connect <host>:<port>`; older: `adb tcpip 5555` over USB then `adb connect <host>:5555`.
- `[seeded]` `adb wait-for-device` before scripting right after a reboot; check `adb shell getprop sys.boot_completed` = 1.

## Commands
- `[seeded]` `adb shell <cmd>` (exit status propagates with shell protocol v2), `adb exec-out <cmd>` for binary-clean output (no CRLF translation, no tty), `adb push/pull <src> <dst>`, `adb install -r`, `adb logcat -d`, `adb bugreport`.
- `[seeded]` Run location: `/data/local/tmp` is writable and exec-capable for the shell user. `/sdcard` is `noexec`. See [android-ndk](../targets/android-ndk.md).
- `[seeded]` Ports: `adb forward tcp:<lport> tcp:<dport>` (host -> device, e.g. gdbserver, see [remote-debug](remote-debug.md)); `adb reverse tcp:<dport> tcp:<lport>` (device -> host).
- `[seeded]` `adb root` only works on userdebug/eng builds; otherwise stay unprivileged. `adb shell run-as <pkg>` for debuggable apps.

## Gotchas
- `[seeded]` `adb shell` is a different environment from a Termux shell; to run Termux things use ssh to Termux ([termux](../targets/termux.md#test)).
- `[seeded]` Quoting passes through two shells (host, device): use single quotes around the whole command, or push a script.

## See also
[android-ndk](../targets/android-ndk.md) · [ssh](ssh.md) · [activities/transfer.md](../activities/transfer.md)
