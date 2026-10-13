# serial

Site key: `access.serial` in [../../sites.yaml](../../sites.yaml). Bullets: `[seeded]` = not yet run here.

## Open
- `[seeded]` Use the stable name `/dev/serial/by-id/...` (the `ttyUSBn` number changes). User must be in `dialout` (`uucp` on Arch). Interactive: `picocom -b <baud> <dev>` (exit `Ctrl-A Ctrl-X`), `tio <dev>`, `screen <dev> <baud>` (exit `Ctrl-A \`).
- `[seeded]` Only one process may own the port: check `fuser <dev>` / `lsof <dev>` first; close your terminal program when done (a forgotten `picocom` blocks the next attempt and is invisible).

## Scripted (non-interactive) use
- `[seeded]` Configure: `stty -F <dev> <baud> raw -echo -crtscts cs8 -cstopb -parenb`. Send/receive: `exec 3<>dev; printf 'cmd\r' >&3; timeout 5 cat <&3`. Always bound reads with `timeout`.
- `[seeded]` To get a command's output and status over a shell on a serial console, wrap it with markers: `echo __BEGIN__; cmd; echo __RC=$?__` and parse between them.
- `[seeded]` Python `pyserial` (`python3 -m serial.tools.miniterm`) when stty is awkward.

## Typical uses
- `[seeded]` Boot logs and early-boot debugging, bootloader prompts (U-Boot: press a key within the autoboot delay), rescue shell when the network is down. Raspberry Pi: `enable_uart=1`, 3.3 V TTL adapter, 115200 8N1 ([linux-glibc](../targets/linux-glibc.md#gotchas)).

## Gotchas
- `[seeded]` 3.3 V vs 5 V vs RS-232 levels: never connect RS-232 to TTL pins; crossover TX/RX; share ground.
- `[seeded]` Sending to a bootloader can erase/flash things: confirm before any `flash`/`erase`/`mmc write` command.
- `[seeded]` Line endings: many consoles want `\r` (CR), not `\n`.

## See also
[ssh](ssh.md) · [vnc](vnc.md) · [linux-glibc](../targets/linux-glibc.md)
