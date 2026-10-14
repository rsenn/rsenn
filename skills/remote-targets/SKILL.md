---
name: remote-targets
description: Build, test, debug, trace, package, deploy and transfer to remote or foreign targets - Raspberry Pi, Android (Termux, adb/NDK), Windows (MinGW, MSYS2, Cygwin, MSVC), musl, dietlibc, Cosmopolitan/cosmocc (APE), Emscripten, WASI - over ssh, sshfs, adb, serial, rdp, vnc or a remote debugger. Use when a task has to run, cross-compile for, deploy to or debug on a machine other than this one, when asked to "try it on the pi/phone/windows box", or when adding a new remote site or target. Site data lives only in sites.yaml, generic knowledge in knowledge/; the skill extends itself after every use.
---

# remote-targets

Work on machines that are not this one. Three layers, kept strictly apart:

| Layer | File | Holds |
|---|---|---|
| **Site** = a concrete machine/device | [`sites.yaml`](sites.yaml) | hosts, ports, users, key paths, serial devices, adb serials, service/port layout, directories. **The only file with site data.** |
| **Target** = a build/run environment | [`targets.yaml`](targets.yaml) | triple, libc, toolchain, how to run/test, pointer to its knowledge file. Generic. |
| **Knowledge** = how things are done | [`knowledge/`](knowledge/INDEX.md) | per target, per transport, per activity. Generic, no site data. |

A site lists the targets it can host (`targets: [...]`); a target never names a site.

## At a glance: how to start any task

1. **Pick the site.** Read `sites.yaml`. Match by `id`, `aliases`, `targets`, or what the user said
   ("the pi", "my phone"). Unknown machine -> [onboarding](#onboarding-a-new-site-or-target).
2. **Read its `access` and `use`.** `use:` maps each activity (`run`, `transfer`, `debug`, `console`,
   `gui`) to one of its transports, so you know what to call without asking.
3. **Read the target entry** in `targets.yaml` for each target the site hosts: triple, toolchain,
   helper (`cfg-*`), how test binaries are run.
4. **Read the target's knowledge file** `knowledge/targets/<target>.md`. Fixed sections:
   Build, Test, Debug, Trace, Instrument, Package, Transfer, Gotchas.
5. **Read the transport page(s)** the site uses: `knowledge/transports/<kind>.md`.
6. Check `LESSONS.md` (grep the target and transport names) for recent surprises.
7. Act. Then [learn](#learning-loop).

## Task -> where to look

| I need to... | Site key | Target section | Cross-target hub | Transport page |
|---|---|---|---|---|
| reach the machine, run a command | `use.run`, `access.*` | - | - | [ssh](knowledge/transports/ssh.md) [adb](knowledge/transports/adb.md) [serial](knowledge/transports/serial.md) |
| build (native or cross) | `dirs.work` | `#build` | [build](knowledge/activities/build.md) | - |
| test uncommitted code on the remote / bring remote edits back | `dirs.repos` | - | [sync](knowledge/activities/sync.md) (`scripts/rt-sync.sh`) | [ssh](knowledge/transports/ssh.md) |
| copy files / mount the remote | `use.transfer`, `dirs.*` | `#transfer` | [transfer](knowledge/activities/transfer.md) | [ssh](knowledge/transports/ssh.md) [sshfs](knowledge/transports/sshfs.md) [adb](knowledge/transports/adb.md) |
| run tests on it | `use.run` | `#test` | [test](knowledge/activities/test.md) | - |
| debug (gdb/lldb/cdb/inspector) | `use.debug`, `access.debug` | `#debug` | [debug](knowledge/activities/debug.md) | [remote-debug](knowledge/transports/remote-debug.md) |
| trace / profile (strace, perf, logcat, ETW) | `use.run` | `#trace` | [trace](knowledge/activities/trace.md) | - |
| sanitizers, coverage, size/instrumentation | - | `#instrument` | [instrument](knowledge/activities/instrument.md) | - |
| package / deploy an artifact | `dirs.deploy` | `#package` | [package](knowledge/activities/package.md) | - |
| see or drive a GUI / boot console | `use.gui`, `use.console` | - | - | [rdp](knowledge/transports/rdp.md) [vnc](knowledge/transports/vnc.md) [serial](knowledge/transports/serial.md) |
| understand an oddity | - | `#gotchas` | - | - |

Targets: [termux](knowledge/targets/termux.md) · [android-ndk](knowledge/targets/android-ndk.md) ·
[linux-glibc](knowledge/targets/linux-glibc.md) (Raspberry Pi etc.) · [musl](knowledge/targets/musl.md) ·
[dietlibc](knowledge/targets/dietlibc.md) · [mingw](knowledge/targets/mingw.md) ·
[msys](knowledge/targets/msys.md) · [cygwin](knowledge/targets/cygwin.md) ·
[msvc](knowledge/targets/msvc.md) · [emscripten](knowledge/targets/emscripten.md) ·
[wasi](knowledge/targets/wasi.md) · [cosmo](knowledge/targets/cosmo.md) (cosmocc / APE). Full matrix: [knowledge/INDEX.md](knowledge/INDEX.md).

## Rules that never change

- **Remote state is the user's.** Before anything destructive or hard to reverse on a site
  (deleting outside the work dir, `rm -rf`, reboot, flashing, repartitioning, `pkg/apt upgrade`,
  changing sshd/network config, factory reset, writing to a block device or serial bootloader),
  say what and ask. An earlier yes does not cover the next one.
- **Stay inside the site's `dirs`.** Write only under `dirs.work` / `dirs.deploy` / `dirs.mount`.
  Anything else (system paths, other users' homes) is read-only unless the user says otherwise.
- **Secrets never enter this skill.** `sites.yaml` stores references only (key *paths*,
  `pass:`/env-var names, `ask`), never a password, token or key. Never echo secrets into
  commands that end up in logs or `LESSONS.md`.
- **Do not assume the host key / fingerprint.** Do not use `StrictHostKeyChecking=no` on a site
  that has not been accepted before; ask. Known-and-accepted lab devices may set it in `access.ssh.opts`.
- **Verified means run.** Say "builds", "tested", or "smoke-tested" by what actually happened on
  the target. An emulator (qemu-user, wine, node) result is reported as such, not as "on device".
- **One interactive owner per serial port / adb forward / debug port.** Check for a lingering
  `picocom`, `gdbserver`, `ssh -L` before opening another; close what you opened.
- **Time-box hanging remote commands** (`timeout 60 ssh ...`, `-o ConnectTimeout=10`,
  `-o BatchMode=yes`) so a dead device cannot stall the session. Long jobs: background + poll.
- **Site vs generic.** If a fact would be wrong on another machine of the same target, it belongs
  in `sites.yaml`; otherwise in `knowledge/`. Never put an IP, hostname, user, port, serial number
  or key path in `knowledge/`, `targets.yaml`, `LESSONS.md` or this file. Use `<host>`, `<user>`, `<port>`.

## Onboarding a new site or target

**New site:** copy the closest entry in `sites.yaml`, give it an `id`, fill `access` (only the
transports that exist), `use`, `dirs`, `targets`. Run `scripts/probe.sh -- <transport command>`
(e.g. `scripts/probe.sh -- ssh <alias>`, `scripts/probe.sh -- adb -s <serial> shell`) and copy the
facts it prints (arch, libc, OS, compilers, free space, tools present) into `sites.yaml` `facts:`
and, if they reveal something generic, into the target's knowledge file. Test each transport once
and write down what worked in `access.*.notes`.

**New target:** add an entry to `targets.yaml` (copy the closest one), create
`knowledge/targets/<id>.md` from [`knowledge/targets/_template.md`](knowledge/targets/_template.md),
add it to `knowledge/INDEX.md`, the target list above, and the relevant activity hubs. Run
`scripts/lint.sh`.

**New transport:** `knowledge/transports/<kind>.md` + a line in INDEX + the `access` schema comment in `sites.yaml`.

## Learning loop

This skill modifies itself, in these places only:

| What was learned | Goes to |
|---|---|
| a fact about a machine (address, port, quirk of *that* device, directory, installed tools) | `sites.yaml` (`facts:` / `notes:`) |
| a generic fact about a target, transport, or activity | the matching `knowledge/` file, under the right heading |
| a dated event, failed attempt, or something not yet understood | `LESSONS.md` (append-only, 3 lines max, no site data) |
| a rule that would have prevented a mistake, or a lesson seen twice | promote into `knowledge/` (or this file's Rules), mark the lesson `(promoted -> file)` |

Procedure, at the end of every use (and also mid-task when something surprising is resolved):

1. Re-read the file you are about to edit (it may have changed).
2. Write only what you **verified this session** (command run, output seen). Tag every knowledge
   bullet `[verified YYYY-MM-DD]`; upgrade a `[seeded]` bullet to verified when confirmed, and fix
   or delete it when it turned out wrong (note the correction in `LESSONS.md`).
3. Put it in the most specific generic place; add markdown cross-links both ways when a fact
   spans target + transport + activity. Do not duplicate: link.
4. Run `scripts/lint.sh` (dead links, unindexed files, site data in generic files, secret patterns).
   Fix what it reports.
5. Tell the user, in one or two lines, what you added to the skill.

Never weaken the Rules above; only the user can. Keep `LESSONS.md` under ~150 lines: fold old
entries into `knowledge/` and move the rest to `LESSONS-archive.md`.

## Layout

```
remote-targets/
  SKILL.md            this file: entry point and router
  sites.yaml          SITE DATA (hosts, creds refs, ports, dirs, which targets/transports)
  targets.yaml        generic target definitions -> knowledge/targets/<id>.md
  LESSONS.md          append-only learning log
  scripts/
    probe.sh          gather facts from a remote shell (stdin script)
    rt-sync.sh        push/run/pull/merge uncommitted work via private wip refs
    lint.sh           cross-reference + leak checks
  knowledge/
    INDEX.md          matrix: target x activity, transports, conventions
    targets/<id>.md   Build/Test/Debug/Trace/Instrument/Package/Transfer/Gotchas
    transports/<kind>.md   ssh sshfs adb serial rdp vnc remote-debug
    activities/<name>.md   build test debug trace instrument package transfer (cross-target hubs)
```
