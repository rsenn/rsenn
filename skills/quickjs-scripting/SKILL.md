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

## Comments

These rules govern every comment you write or rewrite in a script or
module. A comment is something the eye takes in as a shape, like a table,
not a paragraph to read start to end. The project's own rules (its
`CLAUDE.md`) win where they differ.

- Start lowercase, unless the first word is an identifier that starts
  uppercase (`Map: ...`, `JSON.parse ...`). Later sentences are fragments
  or follow after `;`, not new capitalised ones.
- Text is 75 columns at most, measured after the leading ` * ` or `// `,
  so a closing ` */` still fits in 78.
- Inside a function or after a statement use `//`; for a block use
  `/* ... */` with ` * ` on each line.
- Any comment that explains behavior: 4 lines max. If more is needed,
  restructure: a one-line summary, then a list or a table, never an
  unbroken block of sentences.
- Never cite issues, `TODO.md`, "confirmed via repro X" or what the code
  used to do. State the current rule and, if not obvious, its reason; the
  history belongs in the commit message.
- Show instead of tell: a literal value, a call or a before/after pair
  beats a sentence describing it.
- Multi-line code in a comment is fenced, ` ```js ` for JS and ` ```sh `
  for shell, each fence on its own comment line. A one-line snippet stays
  in single backticks.
- A comment on a function says in plain words, in its first line, what it
  does. After two lines a reader who has not seen the code can say what
  goes in and what comes out; if they cannot, rewrite it.
- One comment per function, never one block shared by several. Name what
  each parameter is for in plain words, with the real value when it is a
  message (`"cannot read x.json"`), not jargon.
- Never a packed block: summary, example, parameter columns and `returns`
  are separate paragraphs split by an empty ` *` line.

### A function, class or module others call gets a header block

Order:

1. `name: what it is` (and the Node/Bun/Deno API it mirrors, if any).
2. The usage as code in a ` ```js ` fence.
3. Arguments as aligned columns, accepted forms and defaults in the
   description.
4. `returns` and `throws`: which value, which error type, for what.
5. One line on where it is exported, if not obvious.

```js
/* readJSON: reads and parses a JSON file; Node's fs + JSON.parse in one.
 *
 * ```js
 * const cfg = readJSON("config.json");
 * const cfg = readJSON("config.json", { fallback: {} });
 * ```
 *
 *   string  path              file to read
 *   object  options.fallback  returned when the file is missing
 *
 *   returns  the parsed value
 *   throws   SyntaxError for bad JSON; Error if missing and no fallback
 */
export function readJSON(path, options = {}) {
```

A class gets the same shape: the constructor call, one line per method and
getter, then `throws`.

### Shapes of data: a table for the keys, code for one entry

A comment that describes an object or JSON format lists the keys in a
table, then shows one entry as literal code with its notes after `//`.

```js
/* a symbol spec of dlopen(): one entry of `symbols`.
 *
 *   key       holds
 *   args      argument types, default none
 *   returns   return type, default "void"
 *   abi       libffi ABI name, default the platform's
 *
 * ```js
 * { abs: { args: ["i32"], returns: "i32" } }  // abs(-5) is 5
 * ```
 */
```

An optional key is written `key?`; a key that is only present under a
condition says the condition in its row, not in a paragraph below.

### The same helps in every script

- **File banner**: the exports, the runtime(s) it needs, the one rule that
  holds throughout.

  ```js
  /* config.js: readJSON, writeJSON.
   * runs on qjsm, node, bun and deno (fs from "fs", no std).
   * rule: paths are used as given, never resolved against the script. */
  ```
- **Where the code is a table** (a `switch`, a lookup `Map`, a list of
  flags), comment it as a table: `key | meaning` rows above it.
- **Portability tags**, so a runtime difference is one `grep` away:

  | Tag | Use for |
  | --- | --- |
  | `qjsm only:` | uses `std`, `os` or a qjs-* module that other runtimes lack |
  | `node:` / `bun:` / `deno:` | a branch or workaround for that runtime |
  | `async:` | the function returns a Promise on one runtime, a value on another |

- **A runtime quirk as one line of code**, with the surprise after `//`:

  ```js
  std.loadFile("x");       // returns null, does not throw, when x is missing
  fs.readFileSync("x");    // throws ENOENT
  ```

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
