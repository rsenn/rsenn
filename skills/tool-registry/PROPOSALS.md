# Tool improvement proposals

Ideas for the tools themselves, found by using them. Nothing here is implemented yet.
Workflow: Claude adds an entry (status `open`); the user approves; Claude copies the entry into
the owning project's TODO.md (`env.todo_file` in tools.yaml, today qjs-modules) and implements it;
the entry becomes `done <date>` with the commit, or `declined`.
Newest first inside each section. One precise line beats a paragraph.

## Install / environment (affects every tool)

- [open] **Install the native modules where qjsm looks, or teach qjsm the arch dir.** `make install`
  puts `lexer.so`, `arraybuffer_sink.so`, `tree_walker.so`... into
  `/usr/local/lib/x86_64-linux-gnu/quickjs`, qjsm only searches `/usr/local/lib/quickjs`, so every
  installed tool fails with `could not load module 'lexer'`. Workaround: `scripts/qtool`.
  Found 2026-10-14. Owner: qjs-modules (cmake install dir / qjsm default path).
- [open] **Module-load failure message.** An unresolved import prints `TypeError: not a function`
  (process.js emitUncaught) before the real `ReferenceError: could not load module 'x'`; the real
  cause should come first (and mention the searched path). Owner: qjs-modules lib/process.js.
- [open] **Document the `;` separator** of `QUICKJS_MODULE_PATH` in doc/qjsm.md, and make `:` work
  on POSIX (it silently finds nothing today).

## Per tool

- [done 2026-11-03, uncommitted; takes effect after the next cmake install] **extract-c.js: install `extract-c-split.js` next to it.** The installed
  `/usr/local/bin/extract-c.js` fails with `could not load module '/usr/local/bin/extract-c-split.js'`;
  running `qjsm quickjs/qjs-modules/utilities/extract-c.js` from the source tree works.
  Found 2026-11-03. Owner: qjs-modules (install list for utilities/).
- [done 2026-11-03, uncommitted; verified: arena mmap path scan utf8 open str fmt byte hashmap give 0 gcc errors] **extract-c -J: output does not compile for `arena` and `mmap`.** (1) `*_internal.h` is neither
  inlined nor copied, so `struct arena_chunk` is incomplete in `arena.c`; (2) `#if WINDOWS_NATIVE` around
  `#include <windows.h>` is dropped (empty `#if/#else/#endif` left behind), so `mmap.c` includes
  `<windows.h>` on Linux. Also emits `"lib/x.h"` includes. Repro: `-J shish/lib/ --name arena|mmap -o DIR`.
  Same two defects also break `path` (internal.h), `scan` (config.h) and c-utils `dir` (dir_internal.h, unguarded
  windows.h); `utf8 open str fmt byte hashmap` join and compile fine.
  Found 2026-11-03. Owner: qjs-modules utilities/extract-c.js.
- [open] **runtime-diff**: `loadFile('lib/describe.js')` is cwd-relative; resolve it via
  `import.meta.url`/the installed module path (`describe` is importable). Fails from any other dir.
- [open] **nm-symbols**: add `--entry <symbol>` (default mode is hard-wired to `js_init_module`), so
  it can answer "what does `main` pull in" for C programs (diet-coding).
- [open] **nm-symbols -d**: refuse or warn on `.a`/`.o` input (reported 1109/1362 functions dead
  for a static archive).
- [open] **extract-c -i**: macro/registration-referenced data (`static const x_ops`, tables passed
  via macros) reported with 0 references; consider marking `kind: data` zero-ref results as
  "weak" or scanning macro bodies for identifiers.
- [open] **extract-c -t**: `size: null` for `struct buffer` of shish lib/buffer.h even though all
  fields have sizes; compute from the last field+padding or report which member blocked it.
- [open] **extract-structs**: delete (superseded by `extract-c -t`) or make it a thin alias; it has
  no `--help` and prints `cFuncListObjects {}` / `[]`.
- [open] **list-exports**: handle `--help` (it dumps the getOpt params table, colored) and send the
  `<file>: took Nms` timing lines to stderr or behind `-v`.
- [open] **resolve-imports**: give every flag a description in `--help`; document the interplay of
  `-f/-m/-E/-I/-u`.
- [open] **xml-shell / unused-functions / deadwood**: a non-interactive mode (script on stdin, JSON
  out) so Claude can drive them; xml-shell treats `--help` as a file name.
- [open] **highlight**: reconcile with `qjs-opencv/tools/site/highlight.js` (site copy) - one
  implementation, the site generator imports it.
- [open] **html2md**: tables, code-fence language (`class="language-x"`), nested lists, `<code>`.

- [done 2026-10-15] **qjs-debugger**: piped-stdin session (`break d.js:3`, `run`) ran to completion without stopping;
  find out whether it is the path form, spawn timing or piping, and offer a non-interactive batch mode
  (`--batch cmds.txt`, no ANSI) so it can be scripted/driven by Claude. Owner: qjs-debugger.
  Cause: engine breakpoint scanner (quickjs.c pc2line decoding), fixed in quickjs patches/008; batch/--json/library added in qjs-debugger.
- [open] **search**: handle `--help` (today it is sent as a query to the paid API) and document the key
  variable. Owner: qjs-lws.
- [open] **qjs-ffi-describe vs runtime-diff**: two tools for one job. Pick one (describe.sh has diff,
  dts, browser, list) and make the other a thin alias, or document the split. Owner: qjs-ffi + qjs-modules.
- [approved 2026-10-15, in qjs-ffi/TODO.md section 6; name clash, missing symbols, by-value unions, --cstring, --handle, --out, --owned-return, bun/deno/node stubs, literal default arguments, value classes, template instances, --out-auto and C++ wrappers done 2026-10-15] **qjs-ffi-genbindings** (found by doc/generated-vs-handwritten.md in qjs-ffi, 2026-10-15): struct and function with the same name break --structs output (lws_xos); symbols missing from the library abort the import; NVGcolor by value and unresolved C++ value types drop functions; unsigned char * returns are numbers; no finalizers for C handles. details in that page.
- [open] **qjs-ffi-genbindings --emit-ir**: IR could serve as the shared input for extract-c-style queries
  (list functions/enums by prefix); consider an `ir-query` mode or document the IR schema.

### ollama-repl (owner project qjs-lws)

- [open] **Stop a tool-call loop.** qwen3:8b repeated one failing `edit_file` call 15+ times (about
  16 s per round) until the connection dropped (2026-10-31). When the same tool name with identical
  arguments occurs twice in a row, answer with a nudge ("this exact call just failed, read the file
  again and change old_string"); on the third, abort the prompt and report it. Today `--max-rounds`
  (40) is the only limit.
- [open] **`/undo` did not restore files** after a prompt whose edits were then followed by /clear and
  a new prompt (2026-10-31); `send /diff` shows the whole working tree. Wanted: `/diff PATH...` and an
  undo that survives `/clear`.
- [open] **`send` flattens newlines**, so a multi-line `old_string` or replacement cannot be given in
  a job. Wanted: `send -f FILE` (or `@FILE`) that passes the file's text unchanged.
- [open] **`/system file ~/x` is not expanded**; expand `~` (error was "cannot read ~/...").
- [open] **Context overflow after about 3 jobs** at `--num-ctx` 16384 with whole files attached to
  each prompt; clear automatically between `send` jobs, or attach only the files the job names.

## Done / declined

(none yet)
