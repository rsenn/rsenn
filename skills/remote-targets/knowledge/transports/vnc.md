# vnc

Site key: `access.vnc` in [../../sites.yaml](../../sites.yaml). Bullets: `[seeded]` = not yet run here.

## Connect
- `[seeded]` Viewer: `vncviewer <host>::<port>` (or `<host>:<display>`; display N = port 5900+N). VNC is weakly encrypted or plain: tunnel it, `ssh -N -L 5900:localhost:5900 <user>@<host>`, then connect to `localhost::5900` ([ssh](ssh.md#tunnels)).
- `[seeded]` Scripted: `vncdotool` (`vncdo -s <host>::<port> [--password ...] capture out.png key enter type "text" move x y click 1`) gives screenshots and input without a GUI.
- `[seeded]` Servers: Raspberry Pi OS `raspi-config` -> Interfaces -> VNC (RealVNC; Wayland uses `wayvnc`); Termux `pkg install tigervnc`, `vncserver :1 -localhost` -> port 5901; Linux `x11vnc -display :0`.

## Gotchas
- `[seeded]` Pi OS: no monitor attached = no framebuffer; set a virtual resolution (`raspi-config` -> Display) or `hdmi_force_hotplug=1`.
- `[seeded]` RealVNC Server speaks a proprietary extension; plain viewers need "VNC password" authentication enabled on it.
- `[seeded]` Do not expose 5900 beyond a trusted network.

## See also
[rdp](rdp.md) · [ssh](ssh.md) · [linux-glibc](../targets/linux-glibc.md)
