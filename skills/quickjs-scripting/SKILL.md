---
name: quickjs-scripting
description: Writing scripts (not native bindings) that run on QuickJS via qjsm and stay portable to Node.js, Bun, Deno and, where the API exists, the browser. Use whenever creating or editing a standalone .js/.mjs script for qjsm, choosing which module or library a script should import (fs, fsPromises, child_process, perf_hooks, process and the other qjs-* modules), checking whether a script runs the same on qjsm/node/bun/deno, or debugging a script with qjsm-debugger. For writing C/C++ bindings use quickjs-native-bindings instead.
---

# QuickJS scripting, portable across runtimes

The target: **one script file, ES module syntax, runs unchanged under `qjsm`,
`node`, `bun` and `deno`** (and in a browser when it only touches web APIs).
The interpreter is `qjsm` (QuickJS plus the qjs-modules standard library),
the debugger is `qjsm-debugger`.

## This skill is self-modifying: learn as you work

This file is a living document, not a frozen reference. **Whenever work done
under this skill teaches something it does not already say, edit the skill
before finishing the task**:

- a mistake you made and the rule that would have prevented it
- a user correction or stated preference ("always do X", "never Y")
- an API quirk, portability difference or gotcha found by running code
- a pattern that worked and is likely to recur
- a statement here that turned out wrong or outdated: fix or delete it

How to edit:

- put the fact in the section it belongs to; add a section only if none fits
- state the current rule and its reason in a few lines; no session history
- verify before writing (run it, `diff` it, `grep` it); never record a guess
- prefer one precise line over a paragraph; merge duplicates instead of appending
- comments follow the `comment-style` skill; code style follows the rules already in this file
- code style: **No braces around a one-statement body** of `if`/`else`/`for`/`while`: `if(remainder)` newline `remainder++;` and `while(cond && (0x03 & j))` newline `out[j++] = c;`. Braces only for two or more statements (or to disambiguate a dangling `else`).
- code style: Initialize a variable in its declaration when the value is known there; do not declare it and assign it on a later line. When declaration and first assignment cannot be adjacent and the variable is only tested, fold the assignment into the test, as long as readability holds and the line stays reasonably short (a short right-hand side and a simple comparison). A blank line separates the declarations from the statements that follow.
- code style: Group declarations of the same base type at one scope into one declaration; pointers to that type join it with their own asterisks. Order within the line: names without an initializer first, then initialized ones from the simplest initializer to the most complex; a variable another initializer depends on comes before its dependant. Keep an initialized variable on its own line when the initializer is a call or expression that does not fit comfortably, when it has side effects whose order matters, when the line would pass about 80 columns, or when the group would hold more than about four names. Never merge types that differ in indirection depth or qualifiers (const, volatile) just to save a line.
- the skill dir is a symlink into the `rsenn` repo; leave committing that
  repo to the user, and mention in your reply what you changed here

## Files in this skill

| File | Purpose |
|------|---------|
| `modules.yaml` | Index of importable modules: which runtimes support each (`compatibility`), import specifier per runtime, doc file, source file, why to use it, verified gotchas |
| `deno-import-map.json` | Lets Deno resolve the bare names (`fs`, `process`, ...) qjsm and node use |
| `scripts/portable-check.sh` | Runs a script under qjsm, node, bun, deno and reports where output or exit status differ |

Start every task by reading `modules.yaml`. It is short; do not guess an API
from memory when the entry points at a doc file.

## Tools

Tools: see `tool-registry/skill-uses.yaml` key `quickjs-scripting`; run them via `tool-registry/scripts/qtool`.
Facts per tool live in `tool-registry/tools.yaml`. Useful here:

- is a module or function portable: `qtool qjs-ffi-describe.sh -d qjsm,node --flat <mod>` (also `-l -d qjsm,bun` for
  builtin module lists, `--dts <mod>` for declarations); `runtime-diff` (run from `qjs-modules/`) gives
  "present in [runtimes]" per member. Record the result in `modules.yaml` notes instead of guessing
- what a lib module offers: `qtool list-exports <path>.js | grep -v ': took'`
- audit a script's imports: `qtool resolve-imports --list-imports -q script.js`, `-u` for unused ones
- a script that does not behave: `qjsm-debugger --plain -x cmds.txt script.js` (section 5; no tty needed)

## 1. Choosing modules

1. Find the capability in `modules.yaml` (`grep -n "^  [a-zA-Z_]*:$"` lists the
   module names; the `use:` text says what each is for).
2. Check `compatibility`. The script may only depend on a module whose
   compatibility line contains **every runtime the user named**. If the user
   named none, require `quickjs node bun deno`. A module missing a token is
   fine only for a quickjs-only script, and then say so at the top of the file.
3. Read the entry's `notes` and the linked `doc` (path is relative to the
   project root in `projects:`). Notes are gotchas seen in real runs, e.g.
   `execSync` output capture, `readFileSync` returning ArrayBuffer instead of
   Buffer.
4. If a module you need is not in the index, follow "Adding a module" below
   before using it. Do not import it blind.

The modules come from these projects (all under `~/Projects/plot-cv/`):
qjs-modules (Node/Bun/WHATWG-style stdlib, the default), qjs-lws (HTTP,
WebSocket), qjs-ffi (call C), qjs-opencv, qjs-glfw, qjs-nanovg, qjs-sound.
Only qjs-modules is portable to other runtimes by design; the rest are
`quickjs`-only bindings to native libraries, so a script that imports them is
quickjs-only.

## 2. Portability rules

- **ES modules only** (`import`/`export`, top-level `await`). No `require()`,
  no CommonJS, no `module.exports`.
- **Bare specifiers for built-ins** as listed in each entry's `import.quickjs`
  (`fs`, `process`, `perf_hooks`, `child_process`). They resolve on qjsm, node
  and bun. Deno needs `--import-map=<skill>/deno-import-map.json`.
- **qjsm cannot resolve the `node:` prefix** and cannot alias names. Where the
  specifier differs between runtimes (today only `fsPromises` vs
  `fs/promises`), put that one import in its own small file
  (`fsp.mjs`) and provide one variant of that file per runtime, or use the
  `*Sync` functions from `fs`. Never scatter runtime tests through the script.
- **Never import `std` or `os`** (quickjs-only) in a portable script. The
  same jobs are done by `process` and `fs`.
- **Text vs bytes**: always pass an encoding for text (`readFileSync(p, 'utf8')`);
  for binary wrap the result: `new Uint8Array(result)`. qjsm returns an
  ArrayBuffer where node returns a Buffer.
- **Booleans**: coerce results that are compared or printed (`!!fs.existsSync(p)`).
- **Exit** with `process.exit(n)`, not `std.exit`.
- **Diagnostics**: `console.error`/`warn` go to stderr on qjsm built from qjs-modules `src/qjsm.c` after
  2026-10-20; an older installed qjsm writes them to stdout. Where stdout is data, use `process.stderr.write(...)`.
- **Timing**: `import { performance } from 'perf_hooks'`; qjsm has no global.
- **Arguments**: user arguments are `process.argv.slice(2)` on all runtimes.
- **Resolving a specifier**: `import.meta.resolve(spec)` works on qjsm (built from qjs-modules after
  2026-10-21), node, bun and deno, and finds `node_modules` packages everywhere. A second argument (the parent)
  works only on qjsm and bun: node ignores it without `--experimental-import-meta-resolve`, deno throws.
- **Child processes**: do not rely on `execSync`/`spawnSync` returning captured
  output on qjsm; redirect to a file and read it (see the `child_process` notes).
- Prefer the synchronous fs API in short scripts; use promises only when the
  script is already async, and then via the one swapped `fsp` import file.
- Browser: none of the five indexed modules exist there. A browser-portable
  script confines itself to web APIs (`fetch`, `URL`, `performance`, streams).

## 3. Running

```sh
qjsm script.mjs arg1 arg2          # the interpreter
qjsm -l                            # modules built into this qjsm
qjsm -e 'import("fs").then(m => console.log(Object.keys(m).length))'   # probe one
qjsm --std script.mjs              # exposes std/os to the script (quickjs-only)
```

Look at `qjsm -l` before assuming a module exists: the installed
`/usr/local/lib/quickjs/*.js` can be older than the repo's `lib/` (seen with
`fsPromises`). When behaviour contradicts a doc, the installed build wins for
what the user will actually run; report the mismatch.

A `lib/` module compiled into qjsm (`BUILTINS_COMPILED`) may import only other builtins that qjsc can follow
from its directory: `lib/loaders/*.js` use `std` and `os`, since `import 'fs'` fails to compile there
(`could not load module filename 'node/events'`).

To run against a repo's `lib/` instead, give absolute paths:
`QUICKJS_MODULE_PATH="$PWD/build/<triplet>;$PWD/lib"`. A relative entry breaks
a child qjsm a test starts in another cwd: the module silently resolves to the
installed copy instead.

## 4. Verifying portability

```sh
skills/quickjs-scripting/scripts/portable-check.sh script.mjs [args...]
RUNTIMES="qjsm node" scripts/portable-check.sh script.mjs        # a subset
```

The first runtime (qjsm) is the reference; the others are diffed against its
stdout and exit status. Have the script print deterministic output (no pids,
timestamps, absolute temp paths) or the check reports noise. A `DIFF` is a
finding: fix the script, or add a note to the module's entry if it is a runtime
quirk. Do not claim a script is portable without running this.

## 5. Debugging

Drive it from a script, not a tty; the output is parseable and the exit status tells the result:

```sh
printf 'break d.js:3\nrun\nbt\nprint a\ncontinue\nquit\n' | qjsm-debugger --plain --timeout 60 d.js
qjsm-debugger --json --timeout 60 -x cmds.txt script.mjs   # one JSON record per line, schema in doc/json-protocol.md
qjsm-debugger -e -c --plain -x cmds.txt                    # attach to QUICKJS_DEBUG_LISTEN_ADDRESS=host:port
```

- `--plain`/`--no-color` removes line editing and ANSI; `-x FILE|-` runs commands from a file or stdin
- exit status: `quit N`, else 124 on `--timeout`, else 1 if any command failed, else the debuggee's code
- commands follow gdb: `break FILE:LINE [if EXPR]` / `break fn` / `tbreak`, `run`, `continue`, `next`, `step`,
  `finish`, `until`, `watch EXPR`, `backtrace`, `print EXPR`, `eval EXPR`, `set var X = V`, `info locals|source`
- a test or tool drives it as a library: `import { Debugger } from 'qjs-debugger'`
  (`launch`, `break`, `continue`, `step`, `eval`, `backtrace`, `on('stopped')`)
- interactive: `qjsm-debugger script.mjs`, `-m gui` (qjs-glfw, qjs-nanovg), `-m dap` for editors
- `watch` single-steps, so it is slow; `return` is unsupported; the installed `qjs` may be a stale 32-bit build,
  use `qjsm-debugger`

Manual: `~/Sources/quickjs/qjs-debugger/README.md` and `doc/json-protocol.md`. Use it when a script misbehaves on
qjsm only: reproduce with the check script, then break and print on qjsm.

## Comments

Every comment follows the `comment-style` skill; load it and print the
ruleset of the context you are writing in (`comment-style/scripts/rules-for`):

| What you write | Context |
|---|---|
| top of a script or module (banner) | `JS \| script \| file` |
| function or method others call | `JS \| script \| function` |
| class | `JS \| script \| class` |
| object or JSON format | `JS \| script \| data-shape` |
| switch, lookup Map, list of flags | `JS \| script \| table` |
| inside a function, after a statement | `JS \| script \| inline` |

The project's own `CLAUDE.md` wins where it differs.

## Adding a module

1. Find the implementing project (see `projects:`) and the module's doc file
   (`<name>.md` under that project's `doc/`), and its source (`.c` for native,
   `.js` for pure JS).
2. Probe it: `qjsm -e 'import("<name>").then(m => console.log(Object.keys(m)))'`.
   Then `node`, `bun`, `deno` (with the import map) with a five-line script
   that uses its main function. Use `scripts/portable-check.sh`.
3. Add the entry to `modules.yaml` with `compatibility` = the runtimes where the
   check agreed, the `import` per runtime, `doc`, `source`, a `use` text that
   says why a script wants it, and every difference found under `notes`.
4. Update `verified_with` if the runtimes changed.

Never list a runtime in `compatibility` that was not tested.
