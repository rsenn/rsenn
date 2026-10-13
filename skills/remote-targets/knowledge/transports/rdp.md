# rdp

Site key: `access.rdp` in [../../sites.yaml](../../sites.yaml). Bullets: `[seeded]` = not yet run here.

## Connect
- `[seeded]` `xfreerdp /v:<host>:<port> /u:<user> /from-stdin /cert:ignore +clipboard /size:1280x800` (FreeRDP 3 binary may be `xfreerdp3`/`sdl-freerdp3`). Give the credential through `/from-stdin` or a secret manager, never on the command line (shows in `ps`). Use `/cert:ignore` only for a known lab host.
- `[seeded]` File transfer: `/drive:share,<localdir>` appears on Windows as `\\tsclient\share`. Clipboard: `+clipboard`.
- `[seeded]` The Windows side needs Remote Desktop enabled and the user in "Remote Desktop Users"; NLA is on by default (needs a password account).

## Using it as a tool
- `[seeded]` RDP is for GUI-only steps (installers, VS UI, debugging a GUI program). Prefer [ssh](ssh.md) for builds. For screenshots in headless/scripted use, run the client inside `Xvfb` and capture with `import -window root out.png` / `xwd`.
- `[seeded]` A non-interactive ssh session is not the RDP session (session 0 vs 1/2): GUI programs started via ssh are invisible in the RDP desktop. Start them in the RDP session (e.g. a scheduled task with "run only when user is logged on").

## Gotchas
- `[seeded]` Disconnecting (not logging off) keeps the session; logging off kills programs started in it.
- `[seeded]` Keyboard layout mismatches: `/kbd:layout:0x<hex>`.

## See also
[vnc](vnc.md) · [msvc](../targets/msvc.md) · [msys](../targets/msys.md)
