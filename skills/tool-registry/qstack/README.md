# qstack - menuconfig for a QuickJS runtime stack

Pick engine, target, dependency policy and the qjs-* projects (with their options) in a
Kconfig menu, get the cmake arguments out. Run it through `scripts/qstack`.

```
qstack menu                      # mconf (lxdialog), writes ./.qstack.config
qstack defconfig FILE            # NAME=y lines over the defaults, no menu
qstack args                      # "global -D..." and one "qjs-<p> -D..." line per project
qstack save [FILE]               # minimal defconfig (only what differs from the defaults)
qstack --check                   # builds the kconfig tools, runs a musl+lws scenario
```

Each project is configured with its own cmake call, so `args` prints one line per project:
`global` goes to every call, `qjs-<p>` only to that project.

## Layout

| Path | What |
|---|---|
| `Config.in`, `modules/Config.in` | the menu. Edit these to add a project or an option. |
| `kconfig/` | copy of `~/Sources/buildroot/support/kconfig/` (kernel 4.17-rc2 kconfig with Buildroot patches; the quilt `patches/` dir is left out). GPL-2.0, `COPYING.GPL-2.0` next to it. |
| `../scripts/qstack` | builds the kconfig tools on first use into `~/.cache/qstack` (`QSTACK_BUILD`), runs them, converts `.config`. |

Update the copy by copying the Buildroot directory again (its `README.buildroot` has the
procedure). Nothing in `kconfig/` is edited here.

## Symbol naming

A plain bool is a global cmake variable (`BUILD_QUICKJS` -> `-DBUILD_QUICKJS=ON`), a string keeps
its value. In a `choice` the bools are named `NAME__VALUE` -> `-DNAME=VALUE`. `PROJ_<p>` switches a
project on, `PROJ_<p>__<VAR>` is `-D<VAR>` for that project only (p is the name without `qjs-`).
There is no `CONFIG_` prefix (the build sets `-DCONFIG_=""`).

## Gotchas (verified)

- The Buildroot copy reads the config file name from `BR2_CONFIG`, not `KCONFIG_CONFIG`; without it
  conf/mconf write `./.config`. qstack sets `BR2_CONFIG=.qstack.config` (override with `QSTACK_CONFIG`).
- `source "modules/Config.in"` resolves against the env var `srctree`; qstack sets it to this directory.
- Build with GNU make 4.3 (`/usr/bin/make`); the one from MPLAB X first on PATH (4.2) failed.
  `CONFIG_SHELL=/bin/sh` is needed outside Buildroot, and the object dir needs a `lxdialog/` subdir.
- Needs `libncurses-dev` for mconf. bison/flex are not needed (`zconf.*_shipped`).
- `modules/Config.in` is a first cut read from each project's `option()` lines on 2026-11-20.
