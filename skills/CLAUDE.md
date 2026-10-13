# rsenn skills - index and load rules

Skills live in `~/Sources/rsenn/skills/<name>/SKILL.md` and are symlinked into `~/.claude/skills/`.
Reference this file from `~/.claude/CLAUDE.md` with `@/home/roman/Sources/rsenn/skills/CLAUDE.md`.

## How to apply this index

- **AUTO** = invoke the skill (Skill tool) *before* the first edit/command of the task; no need to ask.
- **SUGGEST** = the skill would help but the task is not clearly in scope; say in one line which skill
  and why, and load it on a yes.
- Several skills can apply at once; load all AUTO ones. A skill's own rules (confirmations for
  publishing, remote destructive actions) always stay in force.
- If a task touches a skill's domain while you are already deep in it, load it then; do not wait.
- Skills that "learn" (`release-management`, `remote-targets`) are loaded at the start **and**
  update themselves at the end of the task; do not skip the learning step.

## Index

| Skill | Domain | AUTO-load when | SUGGEST when |
|---|---|---|---|
| [`diet-coding`](diet-coding/SKILL.md) | lean C: one function per file, `lib/<module>/` primitives, explicit lengths, static linking, size measuring | writing/reviewing C in a project that has `lib/` primitives (c-utils, shish, chaosircd-style); adding a function/module/header to `lib/` or `../c-utils/lib/`; replacing a libc call (`strlen`, `printf`, `memcpy`, `str*`) with a primitive; the user says "diet", "small", "bloat", "binary size" | any new C code where binary size or startup time was mentioned; before adding a libc dependency to a size-sensitive tool |
| [`quickjs-native-bindings`](quickjs-native-bindings/SKILL.md) | C/C++ bindings that wrap a library as a QuickJS module | creating/editing a `quickjs-*.c`/`.cpp` file; designing a binding's JS API; adding a class/method/getter/enum/callback/Promise-returning function to a binding; wrapping a C++ class hierarchy | the user wants to "expose X to JS/qjs" and the route (binding vs script) is not decided; porting a library for qjsm |
| [`quickjs-scripting`](quickjs-scripting/SKILL.md) | JS scripts for qjsm, portable to node/bun/deno/browser | creating/editing a standalone `.js`/`.mjs` script meant for qjsm; choosing which qjs-* module to import; checking cross-runtime portability; debugging with qjsm-debugger | any small automation/tooling script in a QuickJS-using repo; the user asks to "script" something in JS without naming a runtime |
| [`github-pages`](github-pages/SKILL.md) | project landing/doc sites via `tools/site`, `sites/<name>` | creating or restyling a site under `sites/`; adding a doc page to a site's nav; syncing/publishing a site to a `gh-pages` branch; editing `base.css` or site themes | a project is released/changed in a way that makes its landing page numbers stale; the user asks for "docs", "a demo page" or "a playground" for a project |
| [`release-management`](release-management/SKILL.md) | version bump, changelog, build+package for many targets, tag, GitHub release | the user says release, bump version, changelog, release notes, tag, publish, "ready to release?"; building packages for several targets (cpack, cross toolchains) | the work is clearly the end of a feature cycle (`TODO`/`BUGS` empty, tests green) and no release was mentioned; before pushing a tag |
| [`remote-targets`](remote-targets/SKILL.md) | build/test/debug/deploy on other machines: Pi, Android/Termux, Windows (MinGW/MSYS2/Cygwin/MSVC), musl, dietlibc, emscripten, WASI; over ssh/sshfs/adb/serial/rdp/vnc/remote debugger | any task that must run, cross-compile for, deploy to or debug on a machine other than this one; "try it on the pi/phone/windows box"; adb, termux, gdbserver, sshfs, serial console, qemu-user, wine; adding a site to `sites.yaml` | a build is requested for a non-host target (`cfg-musl`, `cfg-mingw*`, `cfg-aarch64`, `cfg-termux`, `cfg-diet`, `cfg-emscripten`, `cfg-wasi`) even if only compiling; a test passes only under emulation and device confirmation would be valuable |
| [`mcu-firmware-engineer`](mcu-firmware-engineer/SKILL.md) | 8-bit PIC (PIC10/12/16/18) firmware, SDCC and XC8 portable | any work in `pictest`, `lc-meter`, or a PIC project: lib/ routines, `genmakefile`, `piccfg` config words, `.hex`/`.cof` for Proteus | the user mentions a PIC part number, a Microchip MCU, SDCC/XC8, or a breadboard/firmware idea on a small MCU |
| [`eagle-circuit`](eagle-circuit/SKILL.md) | design a circuit and emit an EAGLE `.scr` script | asked to design a circuit, schematic, breakout, harness or wiring for EAGLE; turning a circuit idea into something EAGLE loads | a firmware task needs a board/wiring description that does not exist yet |

## Combos (load together)

- Cross-build + release: `release-management` + `remote-targets` (target builds, device smoke tests).
- Size-sensitive tool for a foreign libc: `diet-coding` + `remote-targets` (`dietlibc`, `musl`).
- Phone/Pi deployment of a QuickJS thing: `quickjs-native-bindings` or `quickjs-scripting` + `remote-targets`.
- Landing page after a release: `release-management` then `github-pages`.
- PIC project with a new board: `mcu-firmware-engineer` + `eagle-circuit`.

## Maintaining this index

- When a skill is added, renamed or its `description` changes, update its row here (domain, AUTO,
  SUGGEST) in the same change, and add its symlink in `~/.claude/skills/`.
- Keep AUTO conditions concrete (file names, verbs, tool names) so they are checkable; move vague
  ones to SUGGEST.
- Do not put project or site specifics here; they belong inside the skill (`remote-targets/sites.yaml`
  for machines, `release-management/LESSONS.md` for release lessons).
