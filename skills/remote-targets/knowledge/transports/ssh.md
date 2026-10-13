# ssh

Site key: `access.ssh` in [../../sites.yaml](../../sites.yaml). Bullets: `[seeded]` = not yet run here.

## Connect
- `[seeded]` Always non-interactive and bounded: `ssh -o BatchMode=yes -o ConnectTimeout=10 -i <key> -p <port> <user>@<host> <cmd>`. Wrap long ones in `timeout`.
- `[seeded]` Multiplex to make many small commands fast: `-o ControlMaster=auto -o ControlPath=~/.ssh/cm-%C -o ControlPersist=10m`; close with `ssh -O exit`.
- `[seeded]` Jump host: `-J <user>@<jump>`; keys via `ssh-add`/`IdentityAgent`, never passwords on the command line.

## Running commands
- `[seeded]` The exit status of `ssh host cmd` is the remote command's (255 = ssh itself failed). Quote once for the local shell and once for the remote: safest is to send a script on stdin: `ssh host 'sh -s' < script.sh` (or `bash -s -- args`).
- `[seeded]` Allocate a tty (`-t`) only for interactive programs; it merges stderr into stdout and mangles line endings.
- `[seeded]` Remote shell differs per target: POSIX sh/bash on Linux/Termux/Cygwin, `cmd.exe` (default) or PowerShell on Windows OpenSSH ([msvc](../targets/msvc.md#gotchas), [msys](../targets/msys.md#build)).

## File copy
- `[seeded]` `scp` (OpenSSH 9+ uses SFTP; for servers without `sftp-server`, e.g. dropbear/busybox, use `scp -O`). `rsync -az -e 'ssh -p <port>'` needs rsync on both ends. Fallback anywhere: `tar c dir | ssh host 'tar x -C dest'`, or `ssh host 'cat > f' < f`.

## Tunnels
- `[seeded]` `-L <lport>:localhost:<rport>` (reach a debug/VNC port), `-R` (let the device reach this host), `-N -f` for background; kill the tunnel when done. Used by [remote-debug](remote-debug.md) and [vnc](vnc.md).

## Gotchas
- `[seeded]` Host key changes after reflashing a device: `ssh-keygen -R '[<host>]:<port>'` only with the user's OK, then re-accept.
- `[seeded]` Termux listens on 8022 ([termux](../targets/termux.md#transfer)); Windows needs the OpenSSH Server feature.

## See also
[sshfs](sshfs.md) · [adb](adb.md) · [activities/transfer.md](../activities/transfer.md)
