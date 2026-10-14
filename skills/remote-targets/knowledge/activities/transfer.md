# Activity: transfer

Moving files to/from a site. Site keys: `use.transfer`, `dirs.*`, `access.*`. Back to [INDEX](../INDEX.md). Bullets: `[seeded]`.

| Situation | Use | Page |
|---|---|---|
| single file, anything with ssh | `scp` (`-O` for legacy servers) or `ssh host 'cat > f' < f` | [ssh](../transports/ssh.md#file-copy) |
| a tree, repeated | `rsync -az -e ssh` (needs rsync both sides) or `tar c \| ssh tar x` | [ssh](../transports/ssh.md#file-copy) |
| edit/build with remote files, artifacts land remotely | sshfs mount, compile locally | [sshfs](../transports/sshfs.md) |
| Android without ssh | `adb push/pull` to `/data/local/tmp` | [adb](../transports/adb.md) |
| Windows GUI-only | RDP drive `\\tsclient\<name>` | [rdp](../transports/rdp.md) |
| uncommitted work, remote git clone, no clobbering | `scripts/rt-sync.sh` snapshot refs | [sync](sync.md) |
| nothing but a console | base64 over serial (`base64 -w0`, paste/`cat > f.b64`, `base64 -d`), then verify sha256 | [serial](../transports/serial.md) |

- `[seeded]` Always verify: `sha256sum` both ends (`certutil -hashfile f SHA256` on Windows) for binaries.
- `[seeded]` Exec-capable places: Termux `$HOME`/`$PREFIX`; NDK `/data/local/tmp` (not `/sdcard`); Linux any non-`noexec` mount (not `/tmp` on hardened systems). Per target: [termux](../targets/termux.md#transfer) [android-ndk](../targets/android-ndk.md#transfer) [linux-glibc](../targets/linux-glibc.md#transfer) [msvc](../targets/msvc.md#transfer) [msys](../targets/msys.md#transfer).
- `[seeded]` APE binaries (cosmo): binary-safe copy only, `.exe`/`.com` name on Windows, `chmod +x` elsewhere: [cosmo](../targets/cosmo.md#transfer).
- `[seeded]` Only write under the site's `dirs.work` / `dirs.deploy` / `dirs.mount`.
