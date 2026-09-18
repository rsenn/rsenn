---
name: mcu-firmware-engineer
description: Embedded firmware engineering for 8-bit Microchip PIC (PIC10/12/16/18) low/mid-range MCUs, portable across SDCC and XC8. Use for any firmware work in pictest, lc-meter, or a similarly-structured PIC project — writing/porting lib/ routines, building with genmakefile, reading config words with piccfg, or producing .hex/.cof output for Proteus simulation.
---

# MCU Firmware Engineer

This is a global skill (`~/.claude/skills/mcu-firmware-engineer/`) — it
applies across every PIC firmware project (`pictest`, `lc-meter`, and any
future one built the same way), not just one project directory.

**This file is a living document — self-updating by design.** It starts
from the user's initial framing below plus a first pass of verified
tool/project facts, and is meant to grow every time it's actually used:
whenever a session does real coding, building, testing, or simulating
work on PIC firmware under this skill, before that session ends, add
back whatever was actually learned — a confirmed toolchain quirk, a
bring-up/debugging technique that worked, a corrected assumption, a
newly verified fact, or the user's own request — so the next session
starts one step ahead instead of re-discovering the same thing. This
isn't optional cleanup, it's the point of the skill: treat "did I update
this file" as part of finishing the task, not a separate nice-to-have.
Never do it silently, though — after adding something, notify the user
of exactly what was added/changed and ask them to confirm it before
treating it as settled. Small, incremental edits over time, not a
rewrite each time. Generic, reusable material (a debugging technique, a
compiler gotcha, a cross-chip-family trap) belongs directly in this file
or `hard-won-lessons.md`; project-specific facts (a board's pinout, one
project's own bug) belong in that project's own `## Projects` entry
below instead — keep the two separated so this file stays useful across
every project under this skill, not just the one being worked on today.

## Role

Embedded firmware engineer for 8-bit Microchip PIC (PIC10, PIC12, PIC16,
PIC18) low/mid-range MCUs. Crafts firmware for embedded projects and
implements firmware library routines that are **portable across two
compilers**: SDCC and XC8 — cross-compiler code follows the
`#if defined(__SDCC) || defined(__XC8) || defined(HI_TECH_C) || ...`
idiom already established in each project's own `lib/`, rather than
assuming one compiler.

- **Production firmware output**: Intel HEX (`.hex`).
- **Debug images for simulation**: Microchip COFF (`.cof`), loadable in
  Labcenter Proteus 8 or 9.

**Always flash a release/optimized build to real silicon via a PICkit2,
never a debug/unoptimized build** (per explicit user instruction,
2026-09-03, `pictest`) — this project currently has no ICD-class debug
probe, so there's no debugger attached that would need debug-build
codegen anyway, and unoptimized SDCC codegen has already been confirmed
(hands-on, `pictest/src/miditest2.c`) slow enough to make a
timer-interrupt-driven ISR miss its own period, causing behavior that
looks like a hardware/interrupt-vectoring bug but is actually just a
debug build being too slow. Revisit this if the project ever gets an
ICD/real debugger target, where debug-build codegen becomes relevant
again.

## Toolchains

| Tool | Path | Notes |
|---|---|---|
| XC8 v1.x | `/opt/microchip/xc8/v1.45/bin/xc8` | headers: `/opt/microchip/xc8/v1.45/include/` |
| XC8 v4.x | `/opt/microchip/xc8/v4.00/bin/xc8-cc` | headers: `/opt/microchip/xc8/v4.00/pic/include/` |
| SDCC | `/opt/sdcc-4.6.0/bin/sdcc` | headers: `/opt/sdcc-4.6.0/share/sdcc/{non-free/,}include/pic{14,16}/` |

SDCC's target-designation naming is a common trap — it names instruction
sets, not chip families:
- `pic14` = 14-bit instruction set = the **low-range** parts: PIC10,
  PIC12, PIC16.
- `pic16` = 16-bit instruction set = **PIC18**.

**SDCC's `__interrupt` ISR-declarator syntax differs by target, and
neither form takes a bare trailing number** (confirmed against SDCC
4.3.0rc1 on both targets, via `lc-meter`'s build — not yet re-confirmed
against the current 4.6.0 default above; re-check if an ISR-declarator
error ever looks version-specific):
- `pic14` (PIC10/12/16 — single interrupt vector, no priority concept):
  `void isr() __interrupt { ... }` — no argument at all.
- `pic16` (PIC18 — has high/low priority vectors): `void isr()
  __interrupt(1) { ... }` — the priority number is a **parenthesized
  argument**, not a bare trailing token. `__interrupt 1` (no parens)
  fails on both targets: `syntax error: token -> '1'`. A portability
  shim picking the ISR declarator by target must branch on chip family
  (e.g. this project's own `PIC18` feature macro — see `lc-meter`'s
  `lib/interrupt.h`), not just on `defined(__SDCC)`, and must use the
  parenthesized form for the `pic16`/PIC18 branch.

Other SDCC versions seen installed on this machine during real work (not
part of the "official" toolchain list above, but real and sometimes
relevant for isolating version-specific-vs-not bugs): `/opt/sdcc-3.6.0`,
`/opt/sdcc-4.0.0`, `/opt/sdcc-4.1.0-amd64-unknown-linux2.5`, and
`/opt/sdcc-4.3.0rc1` (the prior default in this skill, until switched to
4.6.0 above — 2026-08-29, per user request). See `pictest`'s project
notes below for a concrete case where checking multiple versions
mattered.

### genmakefile — quick compile-check tool

`/usr/local/bin/genmakefile` (source: `../c-utils/genmakefile.c`, sibling
to the project dirs). Generates build files for many toolchains/compiler
frontends and make-program flavors (`-m make/ninja/mplab/mplabx/shell/...`)
— for this role, the relevant compiler types are `-t xc8` and `-t sdcc`.

**Never add its generated output to a project repo** — it's a throwaway
quick-compile-check tool, not a build system generator for these
projects (`pictest`/`lc-meter` already have their own hand-maintained
`build/*.mk`). Its real value: a genmakefile command line is itself a
**source of truth artifact** — by construction it has to name every
source file, every `-I` include path, and every `-D` define the build
needs, so writing one out is a good way to double check (or discover)
exactly what a given firmware source actually needs to compile.

Confirmed real invocation shape (from `pictest/gen-mk.sh` and
`lc-meter/gen-mk.sh`, both scripts sweep the full chip/compiler/
build-type/make-program matrix — this is the pattern, adapt the
sources/defines per program):

```
genmakefile -t xc8 -m make \
  -I. -Ilib -Isrc \
  <PROGRAM>.c lib/*.[ch] src/config-<CHIP>.h src/config-bits.h src/*.c \
  -DUSE_TIMER0=1 -DUSE_UART=1 ... \
  --create-bins --no-create-libs \
  --debug \
  --chip=<CHIP> \
  -o <PROGRAM>-<CHIP>-<COMPILER>-<BUILD_TYPE>.mk
```

**Generic strategy for building a genmakefile command line for a given
firmware source — TBD, not yet fully worked out.** The intended method
(per the user, still to be validated/refined against real projects, one
program at a time):
1. Start from the `main()`-containing source (`src/<name>.c` in
   `pictest`, `<Name>.c` at the project root in `lc-meter`).
2. Scan it (and whatever it `#include`s) for `USE_*` preprocessor
   defines it needs or optionally supports — these drive which `lib/*.c`
   files actually need compiling in, and go on the `-D` list.
3. Cross-check against the project's own build-system source of truth —
   `build/vars.mk` (both projects) and, where present, `build/targets.mk`
   (confirmed present in `lc-meter/build/`; **not present in
   `pictest/build/`** as of this writing — `pictest`'s per-program
   `_SOURCES`/`_DEFS` variables live directly in `build/vars.mk` instead,
   see the `pictest` section below) — rather than re-deriving defines
   from scratch by reading source alone.
4. **A `-D` list isn't only what the main-entrypoint file itself
   references** — a `lib/*.c` module being linked in can have its own
   internal `USE_*` dependency that nothing in the application code ever
   calls directly. Confirmed concretely: `pictest`'s `lib/softpwm.c`
   hardcodes `timer1_init()` as its own internal tick source
   unconditionally (regardless of `lib/softpwm.h`'s `SOFTPWM_TIMER`
   macro, which turned out to be vestigial/unused by the real
   implementation) — so `USE_TIMER1` has to be defined for the link to
   succeed even though `rgbtest.c` itself never mentions Timer1 at all.
   Check every `lib/*.c` file actually being pulled in for its own
   `#if USE_*` guards, not just the top-level source, before finalizing
   a `-D` list.
5. **Before touching a prototype's design, confirm it against the
   CURRENT shared lib header it includes — don't trust the prototype's
   own comments or dead scaffolding.** Concretely: `pictest/src/rgbtest.c`
   referenced `SOFTPWM_ISR1/2/3`, `SOFTPWM_CHANNELS`, `SOFTPWM_MASK2/3` —
   none of which exist in the current `lib/softpwm.h` (single-port,
   fixed 3-channel). Tracing it back, `src/pictest.h` itself still has a
   large commented-out block sketching that exact multi-port scheme — it
   was planned once but never actually implemented in the library. A
   `main()`-containing source, once it's not brand new, can silently be
   written against an *aspirational* or *abandoned* library API rather
   than the real one — grep every macro/function the prototype uses
   against the header's actual current contents (or just try compiling
   it) before designing anything on top of it.
6. **`genmakefile` itself has now actually been run and checked**
   (2026-09-15, `pictest`, generating a standalone Windows/wine-targeted
   `xc8`+`gmake` Makefile for a new program, `glcdtest`, so it could be
   built via `wine cmd /c 'mingw32-make.exe <path>'` with `xc8.exe` for
   a `.cof` with full debug symbols/source references for Proteus). It
   works, but has one real, reproducible bug in its `xc8`+`gmake`
   backend: **the generated `CPPFLAGS`'s `-I` paths are relativized
   against `BUILDDIR`'s directory depth (e.g. 3 path segments in
   `-d some/nested/dir` yields `-I../../../lib`), but the compile
   recipe's own source-file prerequisites (e.g. `lib/foo.c`) are left
   project-root-relative** — inconsistent, since both are read by the
   same `$(CC) ... -I../../../lib ... -c lib/foo.c` command line
   invoked from the same directory (wherever `make` itself is run from,
   which is the project root when a generated `.mk` file is passed by
   path rather than `cd`'d into and doesn't itself `cd`). Confirmed via
   direct comparison at three different `-d` depths (0, 1, 3 segments)
   -- the `-I` prefix's `../` count exactly tracks `-d`'s segment count
   every time, while the recipe/prerequisite paths never change.
   **Workaround**: after generating, hand-edit the `CPPFLAGS` line back
   to the plain `-I` values originally passed on the command line
   (e.g. `-I. -Ilib -Isrc`) -- confirmed this produces a working build
   (real `xc8 v1.43` invocation, full link, valid `.cof` with symbol
   names and source paths readable via `strings`). Also observed but
   apparently harmless: the generated implicit pattern rule for `.p1`
   files has a stray leading `:` (`: $(BUILDDIR)%.p1: %.c`) -- GNU make
   accepted it without error or warning in this run, sitting alongside
   working explicit per-object rules that take precedence anyway; not
   pinned down further since it never actually caused a problem.
   Everything else about the tool matched the reference invocation
   shape at the top of this section: `--chip=`, `--debug`/`--release`,
   `--create-bins --no-create-libs`, and `-m gmake` (not `-m make`,
   which `genmakefile --help` calls "Other make" -- `gmake` is the
   correct type for a real GNU-make-compatible program like
   `mingw32-make.exe`) all worked exactly as documented.

   **Two more real findings from a follow-up run the same day, adding
   `-s mingw` (`--system`) to the same invocation** — done specifically
   because the target really is Windows (`xc8.exe`/`mplink.exe` via
   `wine cmd /c 'mingw32-make.exe ...'`, no MSYS/coreutils on the
   Windows side), so the generated recipes must use `cmd.exe` builtins,
   not `test`/`mkdir -p`/`rm -f`. **Both since fixed by the user
   upstream in their own `genmakefile` fork (`../c-utils`, rebuilt and
   reinstalled to `/usr/local/bin/genmakefile` 2026-09-16) and confirmed
   fixed here by regenerating and re-testing** — a real case of this
   skill's own bug report round-tripping back into a fix, worth noting
   as precedent, not just recording the bugs themselves:
   - `-m gmake` now correctly emits `IF NOT EXIST <dir> MKDIR <dir>`
     (one line per path level, e.g. three chained lines for a
     3-segment `-d`) and `DEL /F <path>` with backslash separators
     already applied -- no more hand-editing needed for this part.
     Re-confirmed via real `wine cmd` that the exact chained
     `IF NOT EXIST a MKDIR a && IF NOT EXIST a\b MKDIR a\b && ...`
     output pattern creates every directory level correctly.
   - The bogus `EXTRA_LIBS = libkernel32.lpp` from `-s mingw` (meant for
     a native Win32 EXE target, meaningless for a PIC `.cof`, previously
     a real `mplink` link failure) is gone -- `EXTRA_LIBS` is no longer
     emitted at all for this compiler type.
   - **One of the three original findings is NOT fixed yet**: the `-I`
     paths in `CPPFLAGS` are still computed relative to `BUILDDIR`'s
     depth, inconsistent with every source-file prerequisite (which
     stays invocation-dir-relative) -- confirmed still reproducible
     with the rebuilt tool, and pinned down to the exact root cause by
     reading the (now-available) modular source tree directly:
     `../c-utils/src/genmakefile/includes.c`'s `includes_cppflags()`
     calls `path_relative_to(absdir.s, dirs.build.sa.s, &arg)` (line
     ~103, anchored on `dirs.build`), while
     `../c-utils/src/genmakefile/sources.c` anchors every source-file
     path on `dirs.this` instead (the invocation directory) -- two
     different anchors for the same command line.
     **Update, same day, after yet another rebuild+reinstall
     (`/usr/local/bin/genmakefile` mtime moved from 00:20 to 00:51):
     this is now fixed too.** Re-ran the identical invocation several
     times (varying `-d` depth, pre-existing vs. fresh `BUILDDIR`, an
     absolute vs. relative `-o`) and `CPPFLAGS` came out
     project-root-relative (`-I. -Ilib -Isrc`) every time -- so all
     three original findings are resolved as of this binary. The
     hand-edit workaround is no longer needed; `pictest`'s
     `glcdtest-18f25k50-xc8-{debug,release}.mk` were regenerated clean
     (byte-identical to a pure `genmakefile` run, no manual patching)
     and rebuild correctly both via the native Linux `xc8` and via real
     `wine cmd`+`mingw32-make.exe`+`xc8.exe`. **Caution for next time**:
     given how many rebuilds happened in one day, always regenerate and
     diff against a known-buggy sample rather than trusting this
     write-up's "still broken" claims at face value -- confirm current
     behavior directly before either applying or skipping the
     workaround.
   - Also worth knowing for next time: the tool's own source moved from
     a single `genmakefile.c` to a modular tree under
     `../c-utils/src/genmakefile/*.c` (`includes.c`, `sources.c`,
     `rule.c`, `output.c`, etc.) at some point in this fix -- grep the
     whole `src/genmakefile/` directory, not just the top-level
     `genmakefile.c`, when tracing a specific behavior in the future.
   - A still-live gotcha independent of any of the above, confirmed via
     real `wine cmd` both before and after this fix round: `cmd.exe`'s
     `MKDIR`/`DEL` builtins reject forward-slash paths outright
     (`Path not found.`/`File not found.`, confirmed hands-on -- both a
     single-level `DEL /F a/*.p1` and a multi-level `MKDIR a/b/c`
     failed, while the backslash forms `DEL /F a\*.p1`/`MKDIR a\b\c`
     worked). This is real Windows/`cmd.exe` behavior, not a
     `genmakefile`/`wine` quirk -- any Windows-targeted Makefile recipe
     (whether hand-written or `genmakefile`-generated) needs backslash
     paths specifically for `cmd.exe` builtins, even though the same
     Makefile's `$(CC)`/`$(LINK)` compile/link recipes can keep forward
     slashes (XC8/`mplink` tolerate both). The rebuilt `genmakefile`
     now gets this right on its own (see above); if hand-editing a
     `MKDIR`/`DEL` recipe for any other reason, keep the *target name*
     forward-slash (so GNU make's own path matching against the
     compile/link rules stays consistent) but hardcode a literal
     backslash-converted path inside the recipe text itself rather than
     reusing `$@`.

   **End-to-end confirmation, same day (2026-09-16)**: the fixed
   `genmakefile` output (just the CPPFLAGS hand-edit on top) was
   actually run through `wine cmd /c 'mingw32-make.exe -f <the .mk>'`
   against the real Windows `xc8.exe`/`mplink.exe` (not just the native
   Linux `xc8` proxy check from the first round) and produced a working
   `.cof` with full debug symbols and source paths (`strings` on it
   shows `D:\Projects\pictest\src\glcdtest.c`, every function and local
   variable name) -- this is as close to "will this actually work for
   the user's real Proteus workflow" as this skill can verify without
   Proteus itself. **The load-bearing gotcha that made this work**: the
   default `~/.wine` prefix is NOT where `xc8`/`mingw32-make` actually
   live for this setup -- the real prefix is `WINEPREFIX=/mnt/data/.wine`,
   which has **no `Z:` drive at all** (confirmed: `~/.wine/dosdevices/`
   has `Z:`, `/mnt/data/.wine/dosdevices/` does not) and instead maps
   `D:` → `/mnt/data` and `M:` → `/mnt/data/msys64` (`winecfg`-configured
   drives, not wine's usual default root mapping). Concretely, from
   this project's own root:
   ```
   WINEPREFIX=/mnt/data/.wine wine cmd /c \
     "cd /d D:\Projects\pictest && M:\mingw64\bin\mingw32-make.exe -f glcdtest-18f25k50-xc8-debug.mk"
   ```
   Using bare `Z:\mnt\data\...` paths against the *default* prefix
   instead silently either resolves to a *different*, mostly-empty wine
   environment (no `xc8`, `where xc8` finds nothing) or intermittently
   fails outright (`Path not found.` / "Can't recognize ... as an
   internal or external command", seen a few times switching back and
   forth between prefixes in the same session -- not fully root-caused,
   but the fix is the same either way: use the real prefix and its real
   drive letters, don't assume `Z:` is `/`). If `xc8`/`mingw32-make.exe`
   ever can't be found via a bare `wine cmd` invocation again, check
   `WINEPREFIX`/`echo %PATH%`/`dosdevices` before assuming the Makefile
   itself is broken -- this cost real back-and-forth before being
   isolated to the wine prefix/drive-mapping, not the build files.

   **SDCC backend, same day, same real-`wine` method**: generated
   `glcdtest-18f25k50-sdcc-{debug,release}.mk` with `-t sdcc -m gmake -s
   mingw` (otherwise identical invocation shape/defines to the `xc8`
   pair above) and ran both through the same
   `WINEPREFIX=/mnt/data/.wine wine cmd /c 'cd /d D:\Projects\pictest &&
   M:\mingw64\bin\mingw32-make.exe -f <file>'` pattern, against a real
   Windows SDCC 4.6.0 (`C:\SDCC\bin`) with gputils' `gplink.exe`
   (`C:\gputils\bin`) also on `PATH`. Both produced a working
   `<program>.cod` with real debug symbols (`strings` shows
   `src/glcdtest.c` and mangled function names like
   `_st7735r_draw_line`) -- no manual fixes needed at all this time
   (this was already past the `-s mingw`/`CPPFLAGS` fix round above).
   Two things worth knowing about this backend specifically:
   - **The two-step "compile each `.c` with `-c`, then link all the
     `.o` in one final `sdcc ... -o file.cod obj1.o obj2.o ...`
     invocation" pattern this backend generates matches the "reliable
     two-step form" already documented above (SDCC pic16 CLI gotchas)
     -- and it's `sdcc` itself doing the link, not a direct `gplink`
     call.** `sdcc`'s own driver auto-detects `gplink.exe` on `PATH`
     and invokes it internally (confirmed via the link step's own
     stdout: `message: Using default linker script
     "C:\gputils\lkr\18f25k50_g.lkr".`) -- no separate `gplink`
     Makefile rule is needed, unlike this project's own hand-written
     `build/sdcc.mk`, which does call `gplink` directly. Both are
     legitimate, working paths; `genmakefile`'s is simpler to generate.
   - `genmakefile`'s generic (non-compiler-specific) post-processing
     unconditionally appends `-O2` (or `-O1` for minsizerel) to
     `CFLAGS` for any non-debug build type, assuming a gcc-style `-O`
     flag -- SDCC doesn't have one (`--opt-code-speed` is what the
     sdcc-specific branch already adds instead). Harmless here: SDCC
     just emits `warning 117: unknown compiler option '-O2' ignored`
     and proceeds, but it's a real, reproducible quirk worth knowing
     about rather than mistaking for something wrong in the generated
     Makefile. `-DSDCC=1` (also auto-added, no underscore) and
     `-llibm18f.lib` (an unused floating-point math lib, since this
     program does no float math) are similarly harmless no-ops for this
     specific program, not something to "fix" preemptively.

### piccfg — dump config word (fuse) settings from a hex file

`/usr/local/bin/piccfg` (source: `../c-utils/piccfg.c`).

```
piccfg <hex-file> <cfgdata-file>
```

| Flag | Meaning |
|---|---|
| `-h, --help` | show help |
| `-o, --oneline` | output oneliner |
| `-D, --no-default` | don't output settings with default value |
| `-d, --default` | output settings with default value |
| `-C, --no-comments` | don't output description comments |
| `-n, --name` | output register name |
| `-N, --no-name` | don't output register name |
| `-v, --verbose` | show verbose messages |

`cfgdata` files (one per chip) — confirmed real paths:
- XC8 v1.43: `/opt/microchip/xc8/v1.43/dat/cfgdata/<chip>.cfgdata`
- XC8 v4.00 (via MPLAB X device family pack): `/mnt/data/opt/microchip/mplabx/v6.35/packs/Microchip/PIC18F-K_DFP/1.16.308/xc8/pic/dat/cfgdata/<chip>.cfgdata`
  (the DFP path segment — `PIC18F-K_DFP` here — varies by chip family;
  confirmed for `18f25k50` only so far).

### pathtool — convert a Linux path to the Windows path wine sees

`/usr/local/bin/pathtool` (source: `../c-utils`). Useful whenever
driving a wine-hosted toolchain (XC8/mingw32-make under wine, see
`pictest`'s project notes below) from a shell script — computes the
drive-letter path a given wine prefix would actually resolve, instead
of hand-typing `D:\...`/`M:\...` paths (error-prone across prefixes
with different drive mappings, see the `pictest` wine notes below).

```
pathtool -a -w build/
D:\Projects\pictest\build
```

`-a` = absolute, `-w` = Windows-style output. Confirmed real (2026-09-16,
`pictest`, `roman@gniltag`).

### mdb — MPLAB X's command-line debugger, for scripted simulator round-trips

`/opt/microchip/mplabx/<version>/mplab_platform/bin/mdb.sh` (confirmed
present at `v5.35`, `v5.50`, `v6.35` on this machine). Full reference:
`mdb-user-guide` in `sources.yaml` (a copy of Microchip's own MDB
User's Guide PDF ships with every MPLAB X install at
`<version>/docs/MDBUserGuide.pdf` — read that local copy rather than
fetching the online doc page, which has timed out via WebFetch more
than once).

**What it's for here**: driving MPLAB X's *built-in software
simulator* (`Hwtool SIM` — no physical debug probe or board needed)
from a script, to answer "does this firmware actually compute the
right answer on the real target" — not just "does it compile." This
is the load-bearing capability: `Print <symbol>` reads live simulated
device memory by name once a debug-symbol-bearing image (`.cof`/
`.elf`) has been programmed and run, so a test firmware can compute a
result into a plain global variable and a host-side script can read
that variable back after running the simulation — a full round-trip
with zero UART/serial-output code needed in the firmware itself.

**The invocation pattern** (a `.txt` command file passed as `mdb`'s
sole argument — the "running a command file" mode, not the
interactive REPL):

```
Device <DEVICE_NAME>       # e.g. PIC16F876A
Hwtool SIM                 # built-in simulator, not real hardware
Program "dist/<name>.cof"  # NOTE: must live under a dist/ subdirectory
Reset MCLR
Run
Wait 5000                  # simulated instructions/cycles — halts on its own
Print <global_var_name>    # reads live simulated memory by symbol name
Quit
```

```sh
mdb.sh commandfile.txt
```

Three non-obvious gotchas, all confirmed hands-on (see lc-meter's
`tests/run_mdb_sim.sh`/`tests/README.md` for the worked example this
was extracted from):
- **`Program`'s `.cof`/`.elf` must sit in a directory literally named
  `dist/`, one level below the source directory** — undocumented in
  the User's Guide; discovered by triggering and reading
  `ProgramFileProcessingException`'s own message
  ("...the parser expects a COFF debug file to be located in a
  sub-directory called 'dist'..."). Stage a copy there rather than
  fighting it.
- **Disable the watchdog on the test firmware** (`#pragma config ...
  WDTE = OFF` for XC8, or the matching `__CONFIG(... & WDTE_OFF & ...)`
  for SDCC/HI-TECH-style) if the computation under test takes more
  than a few hundred cycles. Without it, the simulator silently resets
  the chip mid-computation (`W0004-CORE: Watchdog Timer has caused a
  Reset.` spam in the output) and any result-readback variable is left
  at its stale/zero value with no error — this looks exactly like a
  real bug in the firmware being tested if you don't know to check for
  it.
- **Prefer `Run` + `Wait N` over a source-line `Break`** for reaching a
  firmware's halt point. A breakpoint on a bodyless `for(;;){}` loop
  (a common "done, sit here" pattern for this style of test firmware)
  did not reliably resolve to an address in XC8's own debug info
  across otherwise-identical rebuilds — `Wait N` (simulated
  instructions/cycles) has no such dependency and halts on its own
  once elapsed.

**General pattern this establishes for future projects**: to
numerically verify a piece of PIC firmware logic (not just that it
compiles) without real hardware, write a small test `main()` that
computes into `volatile` global result variables and then halts in an
infinite loop — build it for the real target with debug symbols
(`-G --opt="default,+asm,+debug"` for XC8), then drive it through
`mdb`'s `Hwtool SIM` exactly as above. This is strictly better than
trying to decode a bit-banged/hardware-UART serial output from inside
the simulator (also possible — gpsim has a built-in `usart` module
type for this — but adds baud-rate/timing/pin-wiring complexity that
buys nothing when `Print`/`x` can just read the memory directly).
Reach for `mdb`/XC8 by default; reach for gpsim (below) instead when
targeting SDCC specifically, or when MPLAB X isn't available — it's a
legitimate alternative simulator, but needs a different toolchain
(SDCC+gputils, not XC8) to get the `.cod` symbol file it requires; see
the `gpsim` section immediately below for the working pattern and its
real, current limits.

### gpsim — the GNUPIC simulator, for SDCC-targeted scripted simulator round-trips

`/usr/bin/gpsim` (Debian package `gpsim`, confirmed v0.32.1 on this
machine; full source also present at `/mnt/data/Projects/gpsim-0.32.1`
— `gpsim-source` in `sources.yaml`). Unlike `mdb` (which pairs with
XC8's `.cof`), gpsim's `load` command only accepts **gputil's own
`.cod` symbol format** — that comes from **SDCC's pic14/pic16 backend
+ `gputils`** (the `gpasm`/`gplink`/`gputil`/`gpdasm` package,
confirmed installed here), never from XC8. Pick the toolchain by which
simulator you're targeting, not just by habit.

**The invocation pattern** — compile with SDCC, link with `gplink`
directly (not just via `sdcc`'s own linker invocation — see the SDCC
pic14 gotchas below for why), then drive gpsim with a command file:

```sh
sdcc -mpic14 -p16f876a --use-non-free -c firmware.c
gplink -I<sdcc-share>/lib/pic14 -I<sdcc-share>/non-free/lib/pic14 \
    -m -w -r -o firmware.hex firmware.o libsdcc.lib pic16f876a.lib
# -> firmware.cod, the file gpsim's `load` wants
gpsim -i -c commands.stc
```

where `commands.stc` (a `.stc` **command file**, not the assembler
`.asm` — gpsim's own naming, don't confuse the two) looks like:

```
load firmware.cod
step 500
x _result_a
quit
```

Three non-obvious gpsim CLI gotchas, all confirmed hands-on (see
lc-meter's `tests/run_gpsim_sim.sh`/`tests/README.md`/`TODO.md` for
the worked example this was extracted from):
- **Symbols from a loaded `.cod` carry a leading underscore** (C name
  mangling) — `_result_a`, not `result_a`. Use the `symbol` command
  (no arguments) after `load` to list every symbol gpsim actually
  picked up if a name doesn't resolve.
- **`x <symbol>` shows only ONE byte** (the symbol's base address) —
  fine for a `uint8_t`, not enough for a multi-byte type like
  `uint32_t`. There is no multi-byte-aware `print`/`x` equivalent for
  a `.cod`-loaded symbol in this gpsim version's CLI; read a plain
  `dump` (the whole GPR address space) instead and reassemble the
  bytes little-endian by hand/script from the symbol's known base
  address (get that address from the `x`/`symbol` output, or the
  `gplink -m` map file).
- **An `.stc` command file passed via `gpsim -c` must live in the same
  directory as the `.cod` it loads.** gpsim changes its own working
  directory to match wherever that command file sits before executing
  `load` — a command file written to `/tmp` (e.g. via `mktemp`, the
  usual shell-scripting instinct) causes `load firmware.cod` to look
  in `/tmp` instead of wherever `firmware.cod` actually is. Write the
  command file into the same directory as the build output instead.

**Command reference, batch-mode gotchas, and gpsim's own regression
harness** (2026-08-29 pass, via a fork studying `/mnt/data/Projects/
gpsim-0.32.2/` — a newer source checkout than the `gpsim-0.32.1` tree
the notes above were written against; the installed binary is still
0.32.1, and everything below was cross-checked hands-on against that
actual binary, so the version gap doesn't matter here. `/mnt/data/
Projects/gpsim-code/` is an empty, uninitialized git checkout — not a
real source, don't waste time on it):

`gpsim --help`'s real flags worth knowing: `-i/--cli` (CLI mode —
**does not mean "exit when the script ends," see gotcha below**),
`-c/--command=FILE` (startup command file, changes cwd to match — this
is the existing "`.stc` must live next to its `.cod`" gotcha above),
`-I/--include=FILE` (startup command file that does **not** change
cwd — usually the better choice for a test harness), `-D/--define=SYM`
(repeatable, define a gpsim symbol — the mechanism `regression/
make.regression` uses to pass which `.cod` to load into a shared
`startup.stc`), `-p/--processor=NAME` (needed only when loading a bare
symbol-less `.hex`), `-S/--source=disable` (skips source-line loading —
documented as faster for regression runs, see the verbosity gotcha
below), `-E/--echo` (echo command-file lines to the console).

Command-language equivalents of `mdb`'s `Device`/`Program`/`Break`/
`Run`/`Print`/`Quit` (full table in `cli/cmd_*.cc`, one file per
command):

| mdb | gpsim | notes |
|---|---|---|
| `Device`+`Hwtool SIM` | (implicit) | processor comes from the `.cod`, or `-p <type>` for a bare `.hex` |
| `Program` | `load s <file.cod>` (or `load h <type> <file.hex>`) | |
| `Break` | `break e\|r\|w ADDR[,expr][,"msg"]`, plus register-value/change, cycle-count (`break c N`), stack over/underflow, WDT-timeout breaks | richer than mdb — conditional expressions, not just addresses |
| `Wait N` | `break c <cycle>` then `run` | halts at an exact cycle, not mdb's heuristic |
| `Print <sym>` | bare `<sym>` (or `reg(SFR)`) | no dedicated print command — gpsim's expression parser resolves any known symbol directly; can also assign (`myvar = 10`) while stopped |
| `Quit` | `quit` | |

**gpsim's own `regression/` directory is a real, working precedent for
"orchestrate gpsim from a shell script"** — not a design guess, gpsim's
own test suite does exactly this. Full detail in `gpsim-regression-
harness` in `sources.yaml`; the load-bearing pattern:
- Pass/fail signal is an unconditional `.assert "'*** PASSED <msg>'"`
  (or `FAILED`) placed at the program point that means success —
  halts the sim the instant that instruction executes and prints the
  message. `.assert`/`.sim`/`.print`/`.log` are four macros in
  `/usr/share/gputils/header/coff.inc` wrapping a generic `.direct`
  COD directive — assembly-only (or SDCC inline-asm), not usable from
  a `.stc` script alone.
  **Correction (2026-08-29, verified by reading `gpsim-0.32.2/src/
  cod.cc:483-530` directly, not just the macro names/comments in
  `coff.inc`)**: of the four `coff.inc` macros, only `.assert` (the
  `'a'`/`'A'` directive type) is actually implemented as advertised —
  it becomes a `break asrt <addr>, <msg>` breakpoint. **`.print`/`.log`
  (`'f'`/`'l'`) are unimplemented stubs — parsed and accepted, but
  their switch-case bodies are empty; they silently do nothing.**
  `.sim` (`'e'`) does NOT run its command "when this PC is reached" —
  it **ignores its address entirely and runs once, unconditionally,
  right when the `.cod` file loads** (`cpu->add_command(...)` called
  directly at load time, same call gpasm's own startup-script handling
  uses) — so `.sim "quit"` at a firmware "done" point does NOT work as
  a self-terminating checkpoint; it would just quit immediately at
  load. The directive type that DOES run an arbitrary gpsim command
  exactly when a specific instruction executes, without halting —
  genuinely a "printf checkpoint" primitive, and the closest thing to
  "firmware pushes a live value out mid-run" — is `'c'`/`'C'`
  (`CommandAssertion`, `src/breakpoints.cc:2166-2210`: runs the given
  command through the CLI, then executes the replaced instruction).
  **It has no macro in `coff.inc`**, but reaching it from assembly IS
  confirmed to work: `.direct`'s first argument (gputils-1.5.2's
  `gpasm/directive.c:_do_direct`, `Value = 2643`) is parsed via
  `coerce_str1()` (`gpasm/util.c:587`), which coerces ANY single-
  character string literal to its raw byte value — there is no
  whitelist restricting it to the four letters `coff.inc`'s own macros
  happen to use. So a hand-written macro works:
  ```asm
  .checkpoint macro x
    .direct "c", x
    endm
  ```
  placed right after an instruction, e.g. `.checkpoint "myvar"`, prints
  `myvar`'s live value at that exact point without halting the run
  (lowercase `'c'` → `bPost=true`, i.e. the command runs AFTER the
  instruction at that address executes — use uppercase `'C'` instead
  for a pre-execution checkpoint). **This is the real, confirmed
  firmware-push mechanism** for round-tripping a value mid-run without
  stopping the simulation — genuinely new territory, not yet exercised
  end-to-end (no real test has driven a `.checkpoint`-instrumented
  build through gpsim yet; do that before depending on it for real
  pictest/lc-meter tests). Until it's been run for real, the proven
  fallback for round-tripping a live value remains the host-pull
  approach both simulators already support: write to a plain global,
  halt, and read it back via mdb's `Print <symbol>` or gpsim's
  bare-symbol evaluation (see the `mdb` section above and the command
  table below) — not a
  firmware-push mechanism, but the one with real mileage in this
  project (lc-meter's `tests/run_mdb_sim.sh`).
- The driver (`regression/rt.sh`) determines pass/fail by **grepping
  stdout text** (`grep -e "FAILED" -e "PASSED" LOGFILE`), not exit
  code — match this convention rather than inventing an exit-code
  scheme.
- Confirms independently (matching the `build/sdcc.mk` `.cod`-tracking
  work done the same session) that `gplink` writes `.cod` as a side
  effect of every link, no extra flag needed.

**Real gotchas found by actually RUNNING gpsim, not just reading
source — treat these as open, not solved:**
- **`-i` does not mean "exit when the script ends."** gpsim always
  drops to its interactive `gpsim>` prompt (reading stdin) after a
  startup command file finishes, success or failure, unless that file
  itself runs `quit`.
- **A failed `load` aborts the rest of that command file** (gpsim's
  parser sets `quit_parse`/`YYABORT`) and falls straight to the
  interactive prompt — any `run`/`quit` lines after a bad `load` never
  execute. Always confirm the `.cod` exists before invoking gpsim.
- **Closing stdin (`</dev/null`) does NOT make gpsim exit cleanly on
  EOF** — empirically observed busy-looping printing the prompt (4.9MB
  in 15s) until `timeout` killed it. **Any test-harness invocation of
  gpsim MUST be wrapped in `timeout`** as a hard safety net — don't
  rely on stdin redirection or an expected `quit` alone.
- **Default verbosity is very high once any breakpoint/trace fires**
  (full per-instruction register read/write logging). A same-session
  `sim.verbosity = 0` assignment did NOT visibly suppress the flood in
  limited testing; `-S disable` is the more likely correct lever
  (documented as speeding up regression runs) but is **untested** —
  don't treat verbosity control as solved.
- **A minimal hand-written single-`.assert` test file (no `GLOBAL`
  declarations, no separate `UDATA`/`CODE` sections) built/loaded
  cleanly but did not visibly print `PASSED`**, while gpsim's own
  `regression/breakpoints/breakpoints.asm` (properly `GLOBAL`-declared,
  real sections, `errorlevel -302`) registered the assert correctly per
  the `break` listing but then hit the verbosity flood above and never
  exited in 15s. The discrepancy between the two files is
  **unresolved**. Before trusting this pattern for real pictest/
  lc-meter test firmware: isolate a minimal `GLOBAL`-declared
  single-assert file, and separately confirm SDCC's own `.o`/`.cod`
  output (not just hand-written `gpasm`-assembled `.asm`, which is all
  that was tested here) round-trips through `gplink` the same way.

Recommended shell pattern (mirrors gpsim's own `rt.sh`, plus the
`timeout` safety net `rt.sh` itself doesn't need since its own test
`.asm` files are known-good):

```sh
gpasm -c test.asm                                  # -> test.o (needs `include <coff.inc>` for .assert — .sim/.print/.log don't do what their names suggest, see above)
gplink --map -s "$LKR" -o test.hex test.o           # -> test.cod (symbols) + test.hex
cat > run.stc <<EOF
load s test.cod
run
quit
EOF
timeout 15 gpsim -i -c run.stc </dev/null > gpsim.log 2>&1 || true
grep -q '\*\*\* PASSED' gpsim.log && echo PASS || { echo FAIL; cat gpsim.log; exit 1; }
```

**SDCC pic14 toolchain gotchas surfaced getting this far** (distinct
from — and in addition to — the `--interrupt`-syntax and
`__config_word` gotchas in the Toolchains section above):
- **SDCC's pic14/pic16 backend compiles exactly one source file per
  invocation** (`sdcc -c a.c b.c` errors: "cannot compile more than
  one source file"). Compile each `.c` separately with `-c`, producing
  a gputils-format `.o` (not `.rel` — passing `-o foo.rel` to force
  that extension causes `error 119: don't know what to do with file`
  at the link step; let SDCC choose `.o` on its own).
- **The config-word idiom for SDCC pic14 is NOT `__CONFIG(...)`** (that
  macro is HI-TECH-C-only, and doesn't exist in SDCC's own headers —
  using it gives `syntax error: token -> '&'`). SDCC's own convention:
  declare a variable at the fixed config-word address instead, using
  SDCC's own underscore-prefixed bit constants (from
  `<pic16f876a.h>`, distinct from the non-underscore HI-TECH-style
  names like `FOSC_HS` used elsewhere in this codebase for
  `HI_TECH_C`):
  ```c
  #include <pic16f876a.h>
  __code unsigned int __at(_CONFIG) __config_word =
      (_FOSC_HS & _WDTE_OFF & _PWRTE_ON & _BOREN_ON & _LVP_OFF & _CPD_OFF & _DEBUG_ON & _CP_OFF);
  ```
  This matches the `__code unsigned int __at(_CONFIG) __config_word`
  pattern lc-meter's own `lib/device.h`/`DEVICE_EMIT_CONFIG_WORD`
  already uses for real firmware builds — reuse that convention rather
  than reinventing one.
- **A register-heavy function (many live 32-bit locals in a loop, e.g.
  a bit-serial long-division routine) can fail SDCC pic14's default
  register allocator outright**: `error 8: Out of stack Space.
  'Register' not allocated`. Worked around by raising
  `--stack-size` from its default of 16 to 32 (`sdcc ... --stack-size
  32 -c file.c`) — confirmed this alone resolves the error for a
  64-iteration restoring-division loop with several live `uint32_t`
  temporaries.
- **A pointer/output-param-style C API (the exact style this skill
  recommends elsewhere to dodge SDCC's pic16 struct-by-value crash —
  see the lc-meter project notes below) has a real cost on pic14 that
  doesn't show up on pic16/XC8**: SDCC's pic14 backend lumps every
  address-taken local variable across a whole translation unit into
  ONE non-splittable `udata` section, and `gplink` was observed
  failing to place even a 72-byte such section (well under
  PIC16F876A's largest 96-byte GPR bank) — `error: No target memory
  available for section "UDL_<name>_0"`, with `gplink` only trying a
  tiny 16-byte shared-memory fallback, never retrying the chip's other
  GPR banks. Splitting the address-taking C API back into scalar
  return values (where the struct-by-value crash isn't a concern —
  e.g. code that will only ever target pic14, not pic16) avoids this;
  there's no known compiler flag workaround yet. Root cause not fully
  isolated — see lc-meter's `tests/sdcc-pic14-bank-overflow.md` for
  the full standalone writeup (data table of every build's exact byte
  count, every workaround tried, the two root-cause hypotheses) before
  re-deriving it from scratch; `TODO.md`'s "Second simulator
  investigated: gpsim" entry has the short version.
- Even a function that DOES compile and link cleanly under this can
  still fail to *run* correctly: a trimmed-down division routine (48
  bytes of locals, well within one bank) linked fine but never
  completed when actually stepped in gpsim — the program counter
  wrapped at the chip's memory-size boundary
  (`increment PC=0x2000 == memory size 0x2000`) after ~15-20k
  simulated instructions and stayed wedged there through 200,000
  steps. Not yet root-caused (candidates: an SDCC pic14 codegen bug
  specific to that loop shape, or a gpsim simulation bug) — treat a
  gpsim round-trip that never sets its own "done" flag as a real
  signal worth investigating, not just "needs more `step`s."

**gpsim's LCD support**: real source exists
(`gpsim-lcd-module` in `sources.yaml`) — an HD44780-style character
LCD module (`extras/lcd/lcd.cc`), a genuine match for lc-meter's own
LCD hardware (`LC_meter_HD44780`) — but the installed Debian package
does **not** ship it (confirmed: `module list` after loading both
`libgpsim_modules` and `libgpsim_extras` shows no `lcd` type, only
`DS1307`/`DS1820`/`DS18B20`/`DS18S20`/`Solar`/`dht11` from `extras/`).
Using it would require building gpsim from the local source tree with
`extras/lcd` enabled — not yet done; a real option if a future project
needs to verify actual LCD *output* (not just a result variable) in
simulation.

**uCsim** (SDCC's own bundled simulator, `sdcc-4.6.0/sim/ucsim`) —
checked and ruled out: it has **no PIC support at all** (its target
list is MCS51/8051, 8080/8085, XA, Z80, Rabbit, SM83, TLCS90, ST7,
STM8, PDK, MC6800/6809, M68HC08/11/12, MOS6502, PicoBlaze, F8,
p1516/p2223, AVR — confirmed by listing `src/sims/` directly, not
inferred from its README's prose). Don't reach for it on a PIC
project under this skill; see `ucsim-no-pic-support` in
`sources.yaml`.

### INSIDER — 1-bit hardware in-circuit debugger, real-chip breakpoints

Full detail: `insider-debug-tool` in `sources.yaml`. Local copies:
`/mnt/data/Projects/pictest/insider/` and (git-tracked, same author's
files under lowercase-renamed paths) `/mnt/data/Projects/rsenn/insider/`.

A third-party (E.E. Atanasios Melimopoulos) DIY ICD alternative: a
separate PIC16F628 debug pod talks to the target over **one** spare I/O
pin (any port/pin, even shared with a low-importance LED/pushbutton) via
a self-clocking 512/256-cycle pulse-width 1-bit link, instead of ICD's
fixed RB6/RB7 2-bit interface — useful when those pins are needed for
something else, or the target runs at a clock speed ICD's UART-multiple
constraint doesn't like. PC side is plain Hyperterminal at 38400bps (no
MPLAB plug-in); up to 256 breakpoints (enable/disable/trace by group),
view/edit DATA/SFR RAM, read/write ports, EEPROM dump, W/STATUS edit,
rerun from breakpoint. **This debugs real silicon on real hardware** —
complementary to, not a replacement for, the `mdb`/`Hwtool SIM` round-trip
above (which never touches a physical chip).

Target-side integration is a small assembly bootstrap placed at the end
of program memory (~160 words 12F6xx / ~170 16Fxx / ~400 18Fxx) plus two
macros dropped into the user program: `INSIDER` (call once after
reset/init — halts until the PC issues `G`) and `BREAK nn` at each
breakpoint site.

**Portability into an SDCC/XC8 project — investigated 2026-08-29, not
attempted, and not straightforward:**

- **Not a candidate for a literal C conversion.** The 1-bit link's timing
  (512cyc/256cyc pulses, scaled by a `DBN` speed-multiplier `EQU`) is
  bit-banged using fixed, hand-counted instruction-delay loops that only
  work because MPASM gives deterministic per-instruction cycle counts.
  Neither SDCC's nor XC8's C codegen guarantees that, so a C port would
  just have to re-become hand-tuned inline-asm delay primitives anyway —
  there's no real simplification to be had by "converting" it.
- **Assembly inclusion is the realistic path, but only confirmed
  compatible with XC8 v1.x so far.** The bootstrap and the `Source/
  DEMO1_*.asm` integration examples are genuine **MPASMX** syntax
  (`LIST P=<chip>`, vendor `#include <P18Fxxxx.INC>` headers, `CONFIG`
  directives) — the assembler XC8 v1.x still bundles/supports per this
  skill's Toolchains table above. **XC8 v2.x/v4.x's `pic-as`** is a
  different, GNU/LLVM-MC-syntax assembler with incompatible directives —
  linking the bootstrap into a `pictest`-style v4.x XC8 build would need
  real syntax translation, not just a drop-in. Compatibility with SDCC's
  own pic14/pic16 (gpasm-flavored) assembler backend hasn't been checked
  at all yet — gpasm is MPASM-*like* but not guaranteed identical,
  particularly around macro-local-label and conditional-assembly
  directives this bootstrap uses (`MACRO`/`ENDM`, `IF DBRK==1`/`ENDIF`,
  `IFDEF EEADRH`/`ELSE`/`ENDIF`).
- **The raw `Bootstrap/*.asm`/`Source/*.asm` files are not directly
  assemblable as they sit.** They're CRLF text that's been flattened/
  rewrapped at some point — multiple MPASM statements and their trailing
  `;` comments run together onto one text line with no reliable
  code/comment boundary. Where a matching `.lst` file exists (confirmed
  for the 18F bootstrap: `Bootstrap/18FDBUG_v1r1.lst`), it shows the
  true one-instruction-per-line source and is the right reference to
  restore correct formatting from before assembling anything — the
  `.lst` wasn't generated from a mis-flowed file, the flattening
  happened to the `.asm` afterward.
- **Net recommendation, if this is ever actually wired into a project
  under this skill**: pick a single target family/chip, reflow that
  one bootstrap `.asm` back to proper MPASM (using its `.lst` as ground
  truth where available), assemble+link it as a standalone object under
  XC8 v1.x first (the only toolchain confirmed syntax-compatible without
  translation), call its `DBUG`/breakpoint entry point via `extern` from
  the C `main()`, and only then evaluate porting the assembled object
  (or the reflowed source) to SDCC/XC8-v2+ if that chip/toolchain
  combination is actually needed. Don't attempt a general "SDCC+XC8
  portable inline-asm" version up front — verify one real path end to
  end first, same pattern as the still-open `genmakefile` item in "Open
  items" below.

## Knowledge sources — datasheets, MLA, and everything else

**`sources.yaml`** (same directory as this file) is the manifest of
every place expertise for this role has actually come from — not just
datasheets. Read its own header comment for the full schema and lookup
order; short version:

1. **Datasheets** live in `~/Dokumente/Microchip/` (~173 PDFs already
   there — chip datasheets, app notes, compiler/tool guides). Consult
   the datasheet to look up a chip's capabilities, which peripherals it
   has, its pinout, and register/flag-level detail. **If a needed
   datasheet is missing from that folder, download it there and read it
   from that local copy** — don't work from a URL fetch alone. Every
   datasheet actually consulted gets an entry in `sources.yaml` (`category:
   datasheet`), not just downloaded silently.
2. **MLA** (`/opt/microchip/mla/v2013_06_15/`) — Microchip's own
   higher-level peripheral libraries (USB, graphics, MDD/SD, TCP/IP,
   etc.). **Learning-only source, never a code source**: read it to
   learn which registers/flags a peripheral driver needs to touch and
   the contract it implements (init sequence, buffer ownership,
   interrupt handshake) — never copy its source directly. Its
   Pascal-Case-mixed-with-underscores identifier style doesn't match
   this codebase's `lib/` conventions, and its drivers are far more
   general/configurable than these lean projects want — port only the
   minimal register-level contract actually needed for the task at
   hand, not the whole abstraction.
3. **Everything else** (vendor app notes, tutorials, tech blogs like
   Hackaday, private sites like Roman Black's, forum posts, books) — use
   when the datasheet/MLA don't cover *how* to implement something (a
   driver technique, a timing trick, a worked example). Check
   `sources.yaml` first in case it's already there; if a web search
   turns up something that actually answers the question, add an entry
   (download it if practical, otherwise link the URL) — **only** for
   sources that were actually relevant to answering a real question, not
   speculatively.

See "Boards" below for the two `USB-Stack`/`USB-uC` `sources.yaml`
entries that come up constantly on this board's USB-capable builds.

## Boards

### picstick_25k50 — the main USB-capable target

A small PIC18F25K50 USB-stick board (plugs directly into a USB port,
LeoStick/Arduino form factor) — the primary target for anything doing
USB CDC/HID/MIDI work, and already `pictest`'s most-used board this
session (`miditest`, `rgbtest`).

- **Pin mapping / on-board specialties — `pictest/picstick.md`** (i.e.
  `/mnt/data/Projects/pictest/picstick.md`). This is the load-bearing
  reference: the board is **not** a bare PIC18F25K50 — on-board reset
  button/chain, a User LED on RA4 (JP1-6) with side effects, an
  unlabeled always-on power LED fixed to VDD, an optional crystal
  sharing RA6/RA7, no 5V→3.3V regulator (runs at 5V), and two
  independent, unrelated pin-numbering schemes (JP1/JP2 header pin vs.
  PIC DIP pin) that must both be stated together in any comment/doc
  naming a specific pin. Already the `pictest` project's own required
  reading for this board per its `CLAUDE.md`. **Read this before
  assuming any picstick pin is "free"** — several vendor-pinout-JPEG
  labels are confirmed wrong against the real schematic netlist (see
  its §1).
- **Design files — `/mnt/data/Projects/rsenn/picstick_25k50/`**:
  `picstick_25k50_v1.sch`/`.brd` (source of truth `picstick.md` was
  cross-checked against directly, not just the vendor pinout JPEG),
  render/pinout images, and a `construction/` subdirectory with a BOM
  (`.csv`/`.txt`/`.xlsx`) and build-order photos — useful for exact part
  values/footprints beyond what `picstick.md` already states.
- **Lineage**: a fork (by GitHub user `kaza007`) of the Pinguino
  project's PIC18F45K50 Pinguino board, shrunk to the 28-pin
  PIC18F25K50. Its own `README.md` says it originally shipped with the
  **Pinguino bootloader** (`Bootloader_v4.14_18f25k50_INTOSC.hex`), a
  *different* bootloader from the Johnny Drazi `USB-uC` one `pictest`'s
  own build matrix targets (see below). **Open/unverified**: whether the
  Pinguino bootloader's own app-region offset actually matches
  `USB-uC`'s `PROG_REGION_START=0x2000` — don't assume they're
  interchangeable without checking which bootloader a given physical
  board is actually currently flashed with before choosing
  `CODE_OFFSET`.
- **USB CDC/HID/MIDI work on this board** should reuse `USB-Stack`
  (CDC-ACM, USB-MIDI streaming) per `sources.yaml` — not MLA's USB
  stack, and not written from scratch — and, if it needs to coexist with
  a bootloader, `USB-uC` (see the two entries directly below, already in
  `sources.yaml`). USB-HID hasn't been touched by any project yet;
  check whether `USB-Stack` has an HID example the same way it has
  CDC-ACM/MIDI ones before assuming one needs to be written from
  scratch.

Two non-datasheet projects already in `sources.yaml`, worth knowing
about directly since they come up often in `pictest`'s USB-capable
builds (25K50/2550):
- **`USB-Stack`** (`/mnt/data/Projects/USB-Stack/USB_Stack/`) — Johnny
  Drazi's PIC18 USB device stack (found via Hackaday), used instead of
  MLA's USB stack — CDC-ACM and USB-MIDI streaming class examples.
- **`USB-uC`** (`/mnt/data/Projects/USB-uC/USB_uC.X/`) — the matching
  USB-MSD bootloader, same author. Its app region starts at
  `PROG_REGION_START=0x2000` — this is *why* the build matrix compiles
  each program at both `CODE_OFFSET=0x0000` (bare ICSP/debug) and
  `CODE_OFFSET=0x2000` (bootloader-relocated) in the same run.

## Hard-won design principles

**`hard-won-lessons.md`** (same directory) distills generalized
engineering techniques — compiler portability shims, timebase/blink
tricks, interrupt architecture, sensor/ADC robustness, control-loop
safety (defense in depth), EEPROM endurance, peripheral-driver shape,
and project/build structure — worth defaulting to across every project
under this skill, not just once. Read it before designing anything
safety-relevant (a control loop driving a real actuator), anything
EEPROM/NVM-heavy, or a new peripheral driver. **It is itself written
generically and contains no proprietary details** — its own header
explains the confidentiality constraint it was produced under; that
constraint applies to how *new* material gets added to it too (see
`sources.yaml`'s `reference-only` entries for what "confidential, learn
but never copy or attribute" means in practice).

## Bringing up clock/PLL, timers, and interrupts on new hardware

A "the chip looks dead" or "the ISR never fires" bug report is almost
never one bug — it's a stack of independent, easy-to-conflate problems
(power/reset, clock/PLL, timer configuration, interrupt vectoring,
compiler codegen, build-type speed, a library bug) that all produce the
*same* visible symptom (an LED that never lights). Chasing it by editing
the real firmware and re-flashing is slow and confounds variables. The
technique below — developed and repeatedly validated hands-on against
real PIC18F25K50 silicon — resolved exactly such a case where five
distinct real bugs were stacked on top of each other; each individual
fix alone still left the symptom unchanged until the last one landed.

### Bisection methodology

1. **Rule out power/reset first**, cheaply and non-programmatically if
   possible (does removing/reseating an LED's current-limit resistor
   make it light via board power alone? does the programmer's own
   "identify device" command see the chip at all?).
2. **Write a maximally isolated bare-metal test** — a single `.c` file
   with NO project `lib/`/shared-header code at all, just raw SFR
   writes and `#pragma config` lines copied from a known-working
   reference. This is the single highest-leverage move in the whole
   technique: it eliminates the entire shared codebase as a suspect in
   one step, so every subsequent finding is attributable to something
   in the *isolated test* alone, not "somewhere in lib/".
3. **Verify the clock/PLL by polling a hardware ready-flag, never by a
   timed delay.** A chip with a firmware-enabled PLL (see below) takes
   a real, silicon-specific number of cycles to lock — a
   `_XTAL_FREQ`-derived `__delay_ms()` called *before* the PLL has
   locked computes its delay assuming the wrong (not-yet-reached) clock
   speed, so the actual elapsed real time is wrong in an unintuitive
   direction. Poll the ready bit (`while(!OSCCON2bits.PLLRDY) continue;`
   on PIC18 K-series parts) instead — it needs no timing assumption at
   all and is strictly more correct.
4. **Prefer a *continuous, ongoing* signal over a one-shot "reached
   threshold" test when checking whether an ISR fires at all.** A test
   like `while(ticks < N) continue; LED = ON;` only ever shows success
   once, at the very end — if anything periodically interrupts forward
   progress (a watchdog reset restarting `main()`, a starved main loop),
   the test looks identical to "the ISR never fires" even though it
   actually fires constantly. A free-running toggle (e.g. a Bresenham-
   accumulated 1-second LED toggle, see below) instead shows *any*
   forward progress immediately and continuously, and — because a reset
   restarting `main()` from scratch still resumes toggling at roughly
   the right rate — is far more robust evidence than it might seem.
   Use the one-shot form only after the continuous form has already
   confirmed the ISR fires at all, to pin down a specific numeric
   threshold or timing detail.
5. **Change exactly one variable per flash-and-observe cycle**, and keep
   every prior test's `.c` file around under a scratch directory rather
   than overwriting it — the working sequence of small diffs is itself
   the debugging record, and stepping back to compare two adjacent
   variants (`diff old.c new.c`) is often what actually reveals the
   real distinguishing factor once a fix is found (see "Timer0 needs an
   explicit enable bit" below for a case where this diffing directly
   found a library bug that random guessing would have missed).
6. **Once the isolated test works, re-introduce real project code in
   stages** (bare peripheral drivers first, then the real ISR content,
   then the real build type/optimization flags) rather than jumping
   straight back to the full original firmware — each stage re-confirms
   nothing new broke, and a regression at any stage narrows the search
   to just what changed in that step.

### Clock / PLL bring-up (INTOSC + firmware-controlled PLL parts)

On PIC18 parts with an internal-oscillator-driven PLL path (e.g. the
K-series, `FOSC=INTOSCIO`-style config), the PLL itself is
**firmware-enabled, not config-fuse-enabled** — the config fuses only
select which multiplier/divider chain is *available*. The actual
sequence (verified against PIC18F25K50, likely the same shape on
sibling K-series parts — check the specific chip's datasheet's
oscillator block diagram, e.g. "Simplified Oscillator System Block
Diagram" and its PLL-select truth table, before assuming identical bit
names on a different part):

```c
OSCCONbits.IRCF = 7;       // select the HFINTOSC frequency that feeds the PLL (e.g. 16MHz)
OSCTUNEbits.SPLLMULT = 1;  // select the PLL multiplier (e.g. 3x: 16MHz -> 48MHz)
OSCCON2bits.PLLEN = 1;     // engage the PLL
while (!OSCCON2bits.PLLRDY) continue; // poll, don't assume a fixed delay (see bisection step 3)
```

**A known real compiler-generation bug**: this exact sequence, byte-
identical, was confirmed (via reading `PLLRDY` directly on real
hardware, independent of any software timing assumption) to lock
correctly under XC8 v2.x/v4.x but to *never* actually lock under legacy
XC8 v1.45 — `PLLRDY` simply stayed 0 forever with the v1.45-compiled
binary. This is a genuine codegen-generation difference, not a source
bug — if a PLL refuses to lock and the enable sequence above looks
correct, recompiling with a different compiler *generation* (not just a
different chip header) is a legitimate, cheap thing to try before
assuming the sequence itself is wrong.

### Interrupt Service Routine declarator syntax across compilers

See "SDCC's `__interrupt` ISR-declarator syntax differs by target"
above for the SDCC pic14-vs-pic16 argument-count rule. Modern XC8
(v2.x+/v4.x, detectable via `__XC8_VERSION`, distinct from legacy v1.x
which has no such macro) uses an attribute-style specifier instead of
the legacy `interrupt` keyword:

```c
void __interrupt() isr(void) { ... }             // single-vector (compatibility-mode) form
void __interrupt(high_priority) isr_hi(void) { ... }  // dual-priority: high
void __interrupt(low_priority)  isr_lo(void) { ... }  // dual-priority: low
```

**Placement matters and fails silently if wrong**: `__interrupt(...)`
MUST appear *before* the function name, matching every example in the
XC8 PIC C Compiler User Guide (`xc8-v4-user-guide-pic` in
`sources.yaml`). Writing it *after* the parameter list instead
(`void isr(void) __interrupt()`) compiles with no error or warning at
all, but the function is never actually wired to the interrupt vector —
confirmed hands-on on real hardware. This is exactly the kind of bug
bisection step 2's isolated test is built to catch cheaply.

SDCC's pic16 (PIC18) port places `__interrupt(1)` at vector 0x0008 and
`__interrupt(2)` at vector 0x0018 — confirmed directly by compiling a
two-ISR test file and reading the generated `.asm`'s vector-table
entries (`grep` for `0x000008`/`0x000018` in the `.asm`; each should
show a `GOTO` to the corresponding ISR), which is a reliable, fast way
to confirm vector placement for *any* new compiler/target combination
before trusting it on hardware.

**A real SDCC pic16 CLI gotcha**: invoking `sdcc file.c -o out.hex` as
one combined compile+link step can fail opaquely
(`out.hex.o: No such file or directory`) even though the source compiles
fine. The reliable two-step form is `sdcc -c file.c` (produces
`file.o`) then `sdcc file.o -o out.hex` (links using the actual `.o`,
not `.rel` — despite `.rel` being the traditionally-documented SDCC
intermediate format name, `-c` on this port's toolchain actually emits
`.o`). This project's own `build/sdcc.mk` already does the two-step
form correctly via `gplink`; only hand/ad-hoc SDCC invocations outside
that build system hit this.

### Dual-priority interrupts (PIC18)

`RCONbits.IPEN` must be set to `1` **before** `GIE`/`PEIE` are enabled
— with `IPEN=0` (POR default), PIC18 hardware routes every interrupt
through the single 0x0008 vector regardless of any peripheral's own
priority bit, so enabling `IPEN` after interrupts are already live does
nothing useful. Each peripheral's own priority bit (`TMR0IP`/`IOCIP` in
`INTCON2`, `RCIP`/`TMR1IP`/... in `IPRx` — names vary by peripheral,
grep the chip header for `*IP` fields) steers that specific source to
the high (0x0008) or low (0x0018) vector; the dual `__interrupt()`
declarations above only place the two ISR *bodies* at the right
addresses, they don't touch `IPEN` or any peripheral's priority bit —
that division of responsibility is deliberate and needs both halves
done for dual-priority to actually take effect.

**When splitting pays off**: a single shared-vector ISR that calls
several peripherals' self-guarding "check my own flag, bail if clear"
service macros unconditionally is correct, but the per-call overhead of
each check is paid on *every* interrupt regardless of source — this is
free when all sources fire at similar, low rates, but becomes real,
measurable overhead once one source (typically a fast free-running
timer) fires far more often than the others. Splitting the fast
source's servicing into a high-priority ISR and moving the
infrequent-but-heavier peripherals to a separate low-priority ISR means
those low-priority handlers only actually run when their own interrupt
fires, instead of being polled at the fast source's rate — confirmed to
matter in practice (see "debug vs release build speed" below for the
concrete case this was diagnosed from).

**A serious, reproducible SDCC pic16 bug: calling a non-trivial function
before dual-priority interrupts are configured can silently corrupt
something**, breaking every ISR that runs afterward (symptom: a
main-loop `while(shared_var != X) continue;`-style wait hangs forever —
looks exactly like "the ISR never fires" even though the interrupt
mechanism itself is fine). Confirmed via careful bisection against real
PIC18F25K50 silicon (2026-09-03): with `RCONbits.IPEN=1` and dual
`__interrupt(1)`/`__interrupt(2)` ISRs declared, calling a ~5-local/
temporary-byte function (a real driver init routine) before interrupts
are enabled broke the whole mechanism, while an otherwise-identical
trivial 1-local-byte function call at the same point did not — isolated
by swapping only that one function call between an already-confirmed-
working raw-register test and the failing one, and independently
confirmed by reading the correct-looking generated `.asm` for the
"breaking" function in isolation (its own codegen was fine on its own;
the corruption only manifested in combination with the dual-priority
interrupt declarations elsewhere in the same program). The leading
suspect is SDCC pic16's default argument-passing "stack" — gplink links
in a fixed `_stack` section (`sdcc -mpic16 --help` documents
`--stack-size` for it, default 16 bytes, minimum 4) that a deeper call
can plausibly overflow — but neither `--stack-size=N` (rejected as an
"unknown compiler option" at both compile and link stages on this
build) nor gplink's own `-t SIZE`/`--stack SIZE` (`gplink --help`;
errors with `The "_stack" symbol already exists` — it collides with the
one SDCC's own runtime startup already links in) actually fixed it, so
the root cause and a proper fix remain unconfirmed. **The practical
workaround that DID work**: inline the offending function's register
writes directly at the call site instead of calling it, avoiding
whatever the corruption mechanism is rather than fixing it. If this is
ever hit again, the fully-isolated bisection method above (swap one
function call at a time between a minimal working dual-priority test
and the suspect code, holding declarations/priority-bit setup fixed) is
the fast way to confirm/deny the same cause; if a real fix is ever
found (a working stack-size override, a linker script edit, an SDCC
version where this is fixed), replace the inlining workaround and
update this note.

### Timer0 needs an explicit enable bit on PIC18 (not on baseline/mid-range parts)

A cross-chip-family porting trap, found via bisection-step-5 diffing
between a working isolated test and a broken one: **PIC18's Timer0 has
an explicit `TMR0ON` enable bit (`T0CON` bit 7)** that must be set for
the timer to run at all. Baseline/mid-range parts (PIC10/12/16) have no
such bit — Timer0 there is always running whenever its clock source is
selected, so driver code written against/ported from a baseline/mid-
range Timer0 init routine can compile cleanly for a PIC18 target, run
with no errors, configure every *mode* bit correctly, and yet Timer0
simply never starts — no ticks, no overflow interrupt, ever. Always
verify a `TMR0ON`-equivalent (or the target family's own timer-enable
mechanism) is explicitly set when porting a timer driver across PIC
families; don't assume "no error, no crash" means the peripheral is
actually enabled.

**A further, more subtle finding, confirmed via careful bisection**
(isolate this specifically if a timer configures correctly per the
above but still doesn't visibly run): writing `TMR0ON` in the *same*
instruction/statement as other `T0CON` mode bits (e.g.
`T0CON = 0x88;` setting `TMR0ON` and `T08BIT` together) was observed to
silently fail to actually start the timer on real PIC18F25K50 silicon,
while writing the mode bits first and setting `TMR0ON` in a separate,
later statement worked reliably in both 8-bit and 16-bit Timer0 modes.
This wasn't cross-checked against the chip's errata sheet, so the exact
mechanism (a real silicon quirk vs. some other coincidental factor in
the specific tests that isolated it) isn't fully confirmed — but the
two-statement form (mode bits first, `TMR0ON` set separately afterward)
is now the safe default to use, and worth deliberately re-testing (with
the errata sheet checked first) if it's ever suspected not to generalize
to a different PIC18 part or Timer0 mode.

### Debug vs. release build speed can look exactly like "the ISR is broken"

An ISR that must keep up with a fast, frequent interrupt source (e.g. a
free-running timer with no prescaler) can take measurably longer to
execute under an unoptimized/debug build than under a release/optimized
one. If that ISR's own execution time exceeds its interrupt's period,
the interrupt effectively re-fires back-to-back, starving the main loop
of almost all its CPU time — main-loop-driven behavior (an LED sequence,
a boot indicator) then runs in extreme slow motion instead of stalling
outright, which reads exactly like "nothing is happening" over a short
observation window and only reveals itself as "it's just very slow" if
watched for tens of seconds rather than a few. Two independent
takeaways from this: (1) **always flash a release/optimized build to
real silicon via a programmer with no attached debugger** — see the
note under Role above; a debug build is for a debugger-attached target,
not for judging whether real firmware works — and (2) if a slow-but-
real signal is ever observed on what looked like completely dead
hardware, don't dismiss it as noise; extend the observation window
before concluding the interrupt truly never fires.

### Defensive default: don't trust a config-bit's POR default for a firmware-gated feature

When a config fuse selects "firmware-controlled" for some feature (e.g.
`WDTEN = SWON`, meaning the watchdog's actual on/off state is gated by
the runtime `SWDTEN` bit rather than fixed by the fuse), explicitly
write that runtime bit to the desired state early in `main()` rather
than assuming its Power-On-Reset default — the POR default for this
class of bit isn't necessarily 0 on every device/silicon revision, and
getting it wrong (e.g. the watchdog turning out to be enabled when the
firmware assumed it was off) produces a periodic-reset symptom that
looks exactly like other timing/interrupt bugs in this same section.
Cheap to add, and rules out a whole class of "looks like it resets
itself" reports in one line.

## Projects

### pictest — `/mnt/data/Projects/pictest` (also checked out at `/home/roman/Projects/pictest`)

Test firmware for several PIC boards/experiments.

- `src/*test.c` — sources with `main()` entrypoints.
- `lib/` — `libpicp`, the shared library submodule common to all PIC
  projects (this repo and `lc-meter` both use it).
- `build/*.mk` — GNU-make build system: `xc8.mk`, `sdcc.mk`, `htc.mk`
  (HI-TECH C — discontinued compiler, present for legacy reasons only),
  `vars.mk` (per-program `<program>_SOURCES`/`<program>_DEFS`, chip/baud/
  code-offset handling — the actual source of truth for what a program
  needs), `common.mk`. **No `build/targets.mk` in this project** (unlike
  `lc-meter`).
- `eagle/` — CAD/CAM files for the boards; `eagle/lbr/` — the EDA
  libraries (schematic/board parts) used by those designs.
- Build matrix example (top-level `Makefile`):
  ```
  BUILD_TYPES="debug release" CHIPS="18f252 18f2550 18f25k50" COMPILERS="xc8" PROGRAM=miditest make compile
  ```
  `CCDIR` must be passed as a `make` variable on the command line (not
  exported as a shell env var) when using a non-default SDCC install —
  the top-level `Makefile` drops an env-only `CCDIR` before it
  re-invokes `build/sdcc.mk`, silently falling back to whatever `sdcc`
  is on `$PATH`.
- Known real bug fixed here (not an SDCC version issue, despite first
  appearances): `lib/device.h` used to unconditionally emit an absolute
  `__config_word` at `0x2007` into *every* SDCC+PIC16 (`16f876a`)
  translation unit, so any multi-file link collided. Fixed via a
  `DEVICE_EMIT_CONFIG_WORD` opt-in macro, defined only by
  `src/config-bits.h` (included solely by top-level program files, never
  `lib/*.c`). Worth remembering as a general pattern: a "some other SDCC
  version might fix it" hypothesis is worth checking directly (multiple
  versions were installed and tested here) before assuming it's a
  compiler bug rather than something in this codebase's own headers.
- `build/xc8.mk`/`build/sdcc.mk` already run `piccfg` on every built
  `.hex` automatically as part of the normal build recipe (producing a
  matching `.cfg` file next to it) — no separate manual step needed to
  get a config-word dump for a program that's just been built.
- `lib/softpwm.[ch]`: `SOFTPWM_RANGE` (currently `100`) is the ISR's
  actual duty-cycle domain, **not 0..255** — the ISR's free-running
  counter only ever reaches `SOFTPWM_RANGE`, so any `softpwm_set()`
  value above it just saturates to always-on. Express duty values
  directly in `0..SOFTPWM_RANGE`, don't assume an 8-bit 0..255 PWM
  range. Only single-port, fixed `SOFTPWM_PIN_COUNT=3` is actually
  implemented today (see the genmakefile-strategy item above for the
  abandoned multi-port design still visible as dead code in
  `src/pictest.h`).
- `src/rgbtest.c` is a real, exercised example of all of this: a minimal
  SoftPWM RGB-LED color-cycle demo, `18f25k50`, builds clean under both
  SDCC and XC8, debug and release. Applies two `hard-won-lessons.md`
  techniques directly (confirmed they hold up outside the reference
  firmware, not just in theory): the free-running-tick-counter timebase
  (`BRESENHAM_INC8`/`BRESENHAM_COND`/`BRESENHAM_SUB` on Timer0, same
  idiom `miditest.c` already uses) and duty-cycle-from-tick-modulo
  actuator control (here: color animation step timing, not an actuator,
  but the same "no dedicated timer/state needed" shape).
- The `bresenham.h` macro set's actual origin/rationale is Roman Black's
  zero-cumulative-error timing algorithm (`roman-black-bresenham-timing`
  in `sources.yaml`) — applying Bresenham's line algorithm to timer-tick
  accumulation so a binary timer overflow (256/65536 ticks) yields an
  exact real-world period at any crystal speed, with the remainder
  carried forward each time instead of dropped. Read that source before
  touching this macro set or building an equivalent timebase elsewhere —
  it's the reason the accumulate/compare/subtract-remainder shape is
  correct, not just a description of what the macros do.
- Roman Black's site has several other cheap-integer-math/low-RAM
  techniques worth knowing about before reaching for something heavier,
  none used by a project here yet (see `sources.yaml` for the full
  write-up of each): `roman-black-integer-degree` (XY vector → compass
  degree without ArcTan/ArcCos), `roman-black-dtmf-algorithm` +
  `roman-black-dtmf-remote-example` (DTMF tone decoding via period
  measurement, no FFT/Goertzel — theory page plus a complete worked
  PIC12F675 implementation), `roman-black-btc-sound` (1-bit/sample audio
  playback from a single GPIO pin, integer-only RC-curve modeling), and
  `roman-black-picthread` (cooperative multitasking via
  `THREAD_START()`/`THREAD_BREAK`/`THREAD_END()` macros — the natural
  step up from flat main-loop polling before reaching for a real RTOS).

### lc-meter — `/home/roman/Projects/lc-meter`

An LCF (inductance, capacitance, frequency) meter. `LC_meter_HD44780`
(main-entrypoint `LC-meter.c`) is the flagship program; `Cap_meter_HD44780`
(`Cap-meter.c`) and `Freq_meter_HD44780` (`Freq-meter.c`) are secondary
programs sharing the same `lib/`.

- Targets: PIC16F876A, PIC18F252, PIC18F2550, PIC18F25K50. **Correction:
  PIC18F252 does NOT have an onboard analog comparator** — confirmed
  against its actual XC8 v1.43 header (`pic18f252.h` has zero
  comparator-related symbols: no `CMCON`, `CM1CON0`, `CVRCON`, `C1OUT`,
  anything), unlike 18F2550 (`CMCON`+`C1OUT`/`C2OUT`) and 18F25K50
  (`CM1CON0`+`C1OUT`, single comparator only, no `C2OUT`). The
  frequency-counter/oscillator scheme this project uses genuinely needs
  that peripheral, so `Cap_meter_HD44780`/`Freq_meter_HD44780` (both
  reference `CMCON`/`C2OUT` directly or via `HAVE_COMPARATOR`) fail to
  build on 18F252 with a real, correct compiler error — this isn't a
  build-system bug to route around, it's this specific chip lacking the
  hardware the program needs. `LC_meter_HD44780` itself still builds on
  18F252 (its own comparator setup is guarded `#ifdef __16f876a` only,
  so it silently does nothing on 18F252 — worth knowing if 18F252 is
  ever actually the flashed target, since the LC-meter's own oscillator
  input then isn't configured at all). Don't repeat the "all four chips
  have a comparator" assumption without checking the specific chip's
  header first — a whole chip family sharing a peripheral is not
  something to assume across every member.
- Folder structure is approximately the same as `pictest` — `lib/`,
  `build/`, `src/`, `eagle/` all present — but **does** have
  `build/targets.mk` (confirmed present, unlike `pictest`) alongside
  `build/vars.mk`. `build/targets.mk` turned out to just be dead/
  superseded scaffolding sitting alongside the real `build/vars.mk` —
  it defines its own `LC_meter_HD44780_SOURCES`/`_DEFS` etc. for extra
  variants (`LC_meter_Nokia5110`, `LC_meter_julznc`, `serialtest`) that
  aren't in the default `PROGRAMS` list and were never exercised here;
  the actual programs that build (`LC_meter_HD44780`, `Cap_meter_HD44780`,
  `Freq_meter_HD44780`) get their real `_SOURCES`/`_DEFS` from
  `build/vars.mk`, which is included after `targets.mk` and wins on
  any overlap.
- Main-entrypoint sources live at the project root, not under `src/`
  (`LC-meter.c`, `Freq-meter.c`, `Cap-meter.c`, each with a matching
  `.h`) — `src/` here holds per-chip `config-<chip>.h` headers instead
  (confirmed: `config-12f1840.h` through at least `config-18f2550.h`
  present). Curiously `measure.c`/`measure.h` and `print.c`/`.h` (real
  library-ish helper modules used by `LC-meter.c`) also live under
  `src/`, not `lib/` — despite the project's own convention (mirrored
  from `pictest`) that `src/` is for chip-config headers and main
  entrypoints. Check `src/` as well as `lib/` when looking for a
  lc-meter-specific helper module, don't assume it's in `lib/` just
  because it isn't a chip config or a `main()` file.
- `gen-mk.sh`/`gen-mk-mplab.sh` present at the project root, same shape
  as `pictest`'s — real, runnable examples of `genmakefile` invocations
  for this project specifically.
- **Full real build matrix exercised** (2026-08-28): `make compile
  COMPILERS=<xc8|sdcc> CHIPS=<chip> BUILD_TYPES=<debug|release>
  PROGRAMS=LC_meter_HD44780`, all 4 chips × both compilers × both build
  types = 16 combinations. **14/16 succeed** after the fixes below;
  the 2 failures (SDCC on 16F876A, debug and release both) are a
  genuine flash-capacity overflow, not a bug: SDCC's `pic14` software
  floating point is much larger than XC8's, and `LC_meter_HD44780`'s
  Thompson-formula float math plus its HD44780 driver don't fit in
  16F876A's 8K-word flash under SDCC (`error: No target memory
  available for section "S_format__format_float"`) even though the
  same source fits comfortably (13%) under XC8. Shrinking this would
  need real size-reduction work (e.g. fixed-point instead of
  float/double math) — noted here, not attempted. `sdcc` itself isn't
  on `$PATH` on this machine; `PATH=/opt/sdcc-4.6.0/bin:$PATH` before
  invoking `make` is required (`build/sdcc.mk` resolves the compiler via
  `which sdcc` with no fallback to the toolchain path in the table
  above).
- **Five real, project-specific bugs found and fixed while getting that
  matrix green** — each is a build-system/portability bug independent
  of any single chip, and each is the kind of thing worth checking for
  in *any* project under this skill, not just here:
  1. `build/vars.mk` added three `MATH_SOURCES` (`frexpf.c log10f.c
     logf.c`) to every XC8 build, but those `.c` files don't exist
     anywhere in the repo (not even under the `lib/math/` the build's
     own `VPATH` expects) — `make: *** No rule to make target
     'frexpf.c'`. Only `log10f` was actually still called anywhere
     (`lib/format.c`); fixed by calling `log10()` there instead (see
     #2) and deleting the dead `MATH_SOURCES` inclusion outright — no
     source files needed to exist for either compiler once the call
     site uses the right name.
  2. `lib/device.h` already has exactly the right portability idiom for
     this — a `MATH_LIB_ALIASES` block that, only under SDCC, `#define`s
     the plain math name to the float-suffixed one SDCC actually
     declares (`log10` → `log10f`, `pow` → `powf`, etc. — SDCC's PIC
     math.h only declares the `f`-suffixed forms; XC8 declares the
     plain forms directly). `lib/format.c` wasn't using this shim: it
     called `log10f(num)` directly, which XC8 has no declaration or
     symbol for at all (`undefined identifier "_log10f"`). Fixed by
     calling the plain `log10(num)` at both call sites, so XC8 resolves
     it natively and SDCC resolves it through the existing alias.
     **General lesson**: when a project already has a compiler-name-
     aliasing shim for a whole class of symbols (SFR bits, or here, math
     functions), a call site bypassing it with a compiler-specific name
     directly is the bug, not the shim being wrong — grep for the
     alias table before assuming a missing symbol needs a new one.
  3. `lib/interrupt.h`'s `INTERRUPT_FN()` macro picked the
     priority-numbered SDCC ISR form (needed only for PIC18/`pic16`
     target — see the Toolchains section above) by checking this
     project's own `PIC16` macro — but this project's `PIC16` means
     "is a PIC16-series chip" (16F628A/16F876A), the **opposite** of
     SDCC's own `pic14`-vs-`pic16` instruction-set naming (where
     `pic16` = PIC18). So the guard fired backwards: it added the
     PIC18-only priority-number ISR form for 16F876A instead of for the
     PIC18 chips. Fixed by keying it on this project's own `PIC18`
     macro instead (which does mean what it says), and by fixing the
     syntax itself as covered in the Toolchains section
     (`__interrupt(1)`, not `__interrupt 1`).
  4. Same `__config_word`-collides-at-0x2007 class of bug the `pictest`
     notes above already describe (and the fix for it —
     `DEVICE_EMIT_CONFIG_WORD`, opt-in, defined only by the top-level
     program's own `config-bits.h`) — but lc-meter's own copy of
     `lib/device.h` had never actually received that fix; it still
     guarded config-word emission on `defined(PIC16)`, which (see #3)
     means the *opposite* of what was intended and fired for every
     translation unit on 16F876A. Ported the same `DEVICE_EMIT_CONFIG_WORD`
     pattern into lc-meter's `lib/device.h`/`src/config-bits.h`.
     **General lesson**: a fix already made in one project under this
     skill (`pictest`) does not automatically apply to another project
     that happens to share the same file by name (`lib/device.h`) — the
     two projects' copies had diverged, and only actually building the
     second project surfaced that the fix hadn't traveled with it.
  5. `lib/format.c`'s `format_double()` (a double-precision variant only
     meant to compile outside SDCC) was guarded `#ifndef SDCC` — but
     `SDCC` (no underscore) is never defined anywhere in this codebase;
     the project's real convention throughout is `__SDCC`. Because the
     guard's macro name was simply wrong, `format_double` always
     compiled, including under SDCC, where it (along with the unrelated
     `format_float`, once MATH_SOURCES/log10f above stopped masking it)
     was part of what overflowed 16F876A's flash. Fixed by correcting
     the guard to `__SDCC`; unrelated to the genuine flash-overflow in
     point above, which remains after this fix.
- **Prescaler/timer sub-tick readout technique** (`lib/timer.c`'s
  `timer0_read_ps()`, used by `src/measure.c`'s `measure_freq()` to
  extend Timer0's resolution beyond its own raw 8-bit-plus-prescaler
  count) — generalizable to any low/mid-range PIC frequency-counting
  design that gates an external signal into a timer for a fixed window
  and needs more resolution than that timer's raw increment count
  alone gives:
  1. During the gate window, the timer counts real external clock edges
     (here: the comparator output, wired into `T0CKI`) at whatever
     prescaler is configured — this gives a coarse count, one LSB per
     prescaled input edge.
  2. The instant the gate window ends, before doing anything else,
     re-point the timer's clock source at itself: switch it to
     external-clock mode and then rapidly toggle the edge-select bit
     (`T0SE`) in a tight NOP-delimited loop. Each toggle is itself a
     software-generated clock edge as far as the timer's increment
     logic is concerned.
  3. Count how many toggle-loop iterations run before the timer's count
     register visibly increments by one more. That iteration count is a
     direct, cheap measurement of *where in the current (partially
     elapsed) input period* the gate window actually ended — a phase
     reading with resolution equal to one loop iteration, far finer
     than one full prescaled input period.
  4. Combine coarse and fine: `final_count = (coarse_count << 8) +
     (max_loop_iterations - measured_iterations)` — the coarse count
     supplies the high bits, the fine phase measurement fills in a
     sub-LSB correction, all from one free-running 8-bit hardware timer
     and no extra peripheral.
  - Why it matters generically: this turns an 8-bit timer/prescaler
    combination into an effective ADC for *phase within the current
    tick*, at the cost of only a handful of instructions and no
    additional hardware — the same shape as the free-running-tick-
    counter timebase technique in `hard-won-lessons.md`, but applied to
    extracting sub-LSB timing resolution instead of scheduling. Worth
    reaching for whenever a design needs finer frequency/period
    resolution than a single hardware timer's raw count gives, before
    reaching for a bigger/faster timer or an external peripheral.
- **Design-verification pattern: `tests/` with three parallel numeric
  implementations, cross-checked host-side, then round-tripped through
  a real simulator** — built while migrating `LC_meter_HD44780`'s
  Thomson-formula (frequency → capacitance/inductance) math off
  `double` (too big for 16F876A's flash under SDCC, per the flash-
  overflow bullet above) toward fixed-point. Generalizes to any
  numerically-nontrivial piece of PIC firmware logic that needs
  verifying for both *correctness* and *code size/precision trade-off*
  before committing to one implementation:
  1. Write each candidate implementation (here: plain `double` as the
     oracle, a pure `uint32_t` fixed-point version using only
     widening-multiply + restoring-division primitives — no 64-bit
     type, since SDCC has none on `pic14`/`pic16` — and a byte-accurate
     model of the vendor's own AN575 24-bit software-float library) as
     a small, independent, pointer/output-param-style module under
     `lib/` (never struct-by-value/struct-return across a multi-call
     chain — see the Toolchains section's SDCC struct notes).
  2. Give each implementation a **dual-target test file** under
     `tests/`: the *same* source builds two ways — as a no-stdio
     embedded `main()` (for the real target) that computes into
     `volatile` global result variables and halts in an infinite loop,
     or, gated by one build-time macro (e.g. `-DHOST_TEST=1`), as a
     host `main()` with `printf` that runs the identical computation
     through a synthetic sweep against a `double`-oracle reference and
     reports precision statistics. This means one source file is both
     the embedded test AND its own host-side correctness check — no
     drift between what's verified on the host and what actually ships.
  3. **Host round-trip first, with two independent compilers** (`gcc`
     and `tcc`) — cheap, fast, no simulator/hardware dependency, and a
     two-compiler cross-check catches an implementation silently
     depending on one compiler's handling of unspecified/
     implementation-defined behavior. A shared `common.h` (trial
     generator + error-stats accumulator, host-only) keeps the sweep
     logic out of each test file.
  4. **Then the real-target round-trip via a simulator** — `mdb`'s
     built-in simulator (see the `mdb` tool section above for the full
     command pattern and its three gotchas — the `dist/` staging
     requirement, disabling the watchdog, and preferring `Wait N` over
     a source-line breakpoint) for an XC8 build, or gpsim (see the
     `gpsim` tool section above — needs SDCC+gputils instead, produces
     a `.cod` not a `.cof`, and has its own set of gotchas around
     multi-byte symbol reads and SDCC pic14's RAM-bank placement
     limits) for an SDCC build: build the embedded variant for the
     actual target chip with debug symbols, run it in the simulator,
     and read the result globals back — confirming the firmware
     doesn't just compile but actually computes the right answer once
     linked and running as real target code, not host-compiled test
     code. **Pick the simulator by which compiler produced the
     binary being verified**, not by habit — `mdb` cannot load an
     SDCC/gputils `.cod`, and gpsim cannot load an XC8 `.cof`.
  5. Only after both rounds agree, wire the winning implementation into
     the real firmware behind a compile-time selector macro (kept
     alongside the retained original as a fallback/comparison path, not
     deleted outright, until the new path has itself been through the
     same verification).
  - Concrete numbers from this pass (see lc-meter's own `TODO.md` for
    the full derivation): all three implementations converge on the
    same known test case to within the method's own near-cancellation
    precision floor (not a representation bug in any one of them); the
    `mdb` simulator round-trip reproduced the host build's result
    exactly, bit-for-bit. The gpsim/SDCC round-trip mechanism itself
    was separately proven correct (byte-exact) with a minimal
    standalone demonstrator, but the real `lib/fixedmath.c`/
    `lib/float24.c` libraries don't yet link/run cleanly under SDCC
    pic14 on this specific chip (16F876A) — see the `gpsim` tool
    section's SDCC pic14 gotchas above; this is real, load-bearing
    context for step 4 above whenever the target compiler is SDCC
    rather than XC8, not a solved problem to assume away.

## Open items / not yet explored

Tracked here so nothing gets silently assumed finished. Remove an item
once it's actually been worked through with real output checked, not
just read about.

- `Cap_meter_HD44780`/`Freq_meter_HD44780` (lc-meter) still have real,
  unfixed source bugs surfaced by the SDCC build matrix above and not
  yet chased down (out of scope for the portability-bug pass that fixed
  the other five): `Cap-meter.c` has at least two `error 78:
  incompatible types ... char [10] fixed to unsigned-int fixed` (a
  string literal apparently being assigned somewhere it shouldn't be,
  around lines 75/123) under SDCC on every PIC18 target, and an
  `Undefined identifier 'C2OUT'` on 18F2550/18F25K50 under SDCC
  specifically (works under XC8 on the same chips, so likely a header/
  alias gap rather than a hardware gap — device.h's `COUT`/`C2OUT`
  aliasing may need the same kind of SDCC-vs-XC8 check that the math-
  function aliases got). Not yet investigated further.
