# sshfs

Site keys: `access.sshfs`, `dirs.mount` in [../../sites.yaml](../../sites.yaml). Bullets: `[seeded]` = not yet run here.

## Mount / unmount
- `[seeded]` `mkdir -p <mnt> && sshfs -o reconnect,ServerAliveInterval=15,ServerAliveCountMax=3,follow_symlinks [-p <port>] <user>@<host>:<remote-dir> <mnt>`; options after `-o` come from the site's `access.sshfs.opts`.
- `[seeded]` Unmount: `fusermount3 -u <mnt>` (or `fusermount -u`); `-uz` lazily if busy. Check mounted: `mountpoint -q <mnt>`; a stale mount shows `Transport endpoint is not connected`: unmount and remount.
- `[seeded]` Windows OpenSSH servers: remote path form `<user>@<host>:/C:/path`. Needs the sftp subsystem enabled (default).

## How to use it well
- `[seeded]` Edit and **write build artifacts** through the mount, but **run the compiler locally**; builds over sshfs are slow (many `stat` calls) and mtime skew breaks make. Run the artifacts on the device ([ssh](ssh.md)).
- `[seeded]` Executable bit and ownership map through the remote user; files created via the mount belong to the remote user. `-o idmap=user` aligns uid.
- `[seeded]` Caching hides remote changes for a few seconds (`-o cache_timeout=...`, or `-o cache=no` when debugging sync problems).

## Gotchas
- `[seeded]` Never leave a mount behind after a task unless the site's `dirs.mount` says it is a standing one.
- `[seeded]` Case-insensitive remotes (Windows, macOS) mis-order case-only renames.

## See also
[ssh](ssh.md) · [activities/transfer.md](../activities/transfer.md)
