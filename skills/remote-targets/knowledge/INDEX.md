# Knowledge index

Generic, site-independent. Entry point: [../SKILL.md](../SKILL.md). Site data: [../sites.yaml](../sites.yaml).
Target definitions: [../targets.yaml](../targets.yaml). Event log: [../LESSONS.md](../LESSONS.md).

## Conventions

- Every bullet carries a status tag: `[seeded]` = written from general knowledge, not yet run by this
  skill; `[verified YYYY-MM-DD]` = a command was run and the output seen. Upgrade, fix or delete as you learn.
- Use placeholders `<host> <user> <port> <serial> <dev>`; never real site values.
- Target pages share fixed headings so links like `targets/termux.md#debug` always work:
  **Identity, Build, Test, Debug, Trace, Instrument, Package, Transfer, Gotchas, See also**.
- A fact that spans layers lives in one place and is linked from the others.

## Targets x activities

Each cell is a section of the target page (`targets/<id>.md#<section>`); the hubs in
`activities/` compare the targets side by side.

| Target | Page | Typical transports |
|---|---|---|
| termux | [targets/termux.md](targets/termux.md) | [ssh](transports/ssh.md) [sshfs](transports/sshfs.md) [adb](transports/adb.md) |
| android-ndk | [targets/android-ndk.md](targets/android-ndk.md) | [adb](transports/adb.md) [remote-debug](transports/remote-debug.md) |
| linux-glibc (Raspberry Pi) | [targets/linux-glibc.md](targets/linux-glibc.md) | [ssh](transports/ssh.md) [sshfs](transports/sshfs.md) [serial](transports/serial.md) [vnc](transports/vnc.md) |
| musl | [targets/musl.md](targets/musl.md) | [ssh](transports/ssh.md) |
| dietlibc | [targets/dietlibc.md](targets/dietlibc.md) | [ssh](transports/ssh.md) |
| mingw | [targets/mingw.md](targets/mingw.md) | [ssh](transports/ssh.md) [rdp](transports/rdp.md) |
| msys | [targets/msys.md](targets/msys.md) | [ssh](transports/ssh.md) [rdp](transports/rdp.md) |
| cygwin | [targets/cygwin.md](targets/cygwin.md) | [ssh](transports/ssh.md) [rdp](transports/rdp.md) |
| msvc | [targets/msvc.md](targets/msvc.md) | [ssh](transports/ssh.md) [rdp](transports/rdp.md) [remote-debug](transports/remote-debug.md) |
| cosmo (cosmocc, APE) | [targets/cosmo.md](targets/cosmo.md) | [ssh](transports/ssh.md) (copy the same file everywhere) |
| emscripten | [targets/emscripten.md](targets/emscripten.md) | local node/browser |
| wasi | [targets/wasi.md](targets/wasi.md) | local runtime |

Template for a new target: [targets/_template.md](targets/_template.md).

## Transports ([transports/](transports/))

[ssh](transports/ssh.md) · [sshfs](transports/sshfs.md) · [adb](transports/adb.md) ·
[serial](transports/serial.md) · [rdp](transports/rdp.md) · [vnc](transports/vnc.md) ·
[remote-debug](transports/remote-debug.md) (gdbserver, lldb-server, cdb/msvsmon, qemu stub, node inspector)

## Activity hubs ([activities/](activities/))

[build](activities/build.md) · [test](activities/test.md) · [debug](activities/debug.md) ·
[trace](activities/trace.md) · [instrument](activities/instrument.md) ·
[package](activities/package.md) · [transfer](activities/transfer.md) · [sync](activities/sync.md)
