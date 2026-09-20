---
name: quickjs-scripting
description: Writing scripts (not native bindings) that run on QuickJS via qjsm and stay portable to Node.js, Bun, Deno and, where the API exists, the browser. Use whenever creating or editing a standalone .js/.mjs script for qjsm, choosing which module or library a script should import (fs, fsPromises, child_process, perf_hooks, process and the other qjs-* modules), checking whether a script runs the same on qjsm/node/bun/deno, or debugging a script with qjsm-debugger. For writing C/C++ bindings use quickjs-native-bindings instead.
---

# QuickJS scripting, portable across runtimes

The target: **one script file, ES module syntax, runs unchanged under `qjsm`,
`node`, `bun` and `deno`** (and in a browser when it only touches web APIs).
The interpreter is `qjsm` (QuickJS plus the qjs-modules standard library),
the debugger is `qjsm-debugger`.

## Files in this skill

| File | Purpose |
|------|---------|
| `modules.yaml` | Index of importable modules: which runtimes support each (`compatibility`), import specifier per runtime, doc file, source file, why to use it, verified gotchas |
| `deno-import-map.json` | Lets Deno resolve the bare names (`fs`, `process`, ...) qjsm and node use |
| `scripts/portable-check.sh` | Runs a script under qjsm, node, bun, deno and reports where output or exit status differ |

Start every task by reading `modules.yaml`. It is short; do not guess an API
from memory when the entry points at a doc file.

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
- **Timing**: `import { performance } from 'perf_hooks'`; qjsm has no global.
- **Arguments**: user arguments are `process.argv.slice(2)` on all runtimes.
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

```sh
qjsm-debugger script.mjs                 # gdb-style REPL, debuggee runs under qjsm
qjsm-debugger --args script.mjs a b c    # pass arguments
qjsm-debugger -m gui script.mjs          # native GUI (needs qjs-glfw, qjs-nanovg)
qjsm-debugger -m dap script.mjs          # Debug Adapter Protocol, for editors
```

REPL commands follow gdb: `break file.js:12` / `break fn` / `break Class.prototype.method`,
`run`, `start`, `continue`, `next`, `step`, `finish`, `backtrace`, `print expr`,
`display expr`, `info locals`, `list`. Breakpoints by function name work
through imports. Full manual: `~/Projects/plot-cv/quickjs/qjs-debugger/README.md`
(entry `qjs-debugger` in `modules.yaml`). Use it when a script misbehaves on
qjsm only: reproduce with the check script, then step through on qjsm.

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
