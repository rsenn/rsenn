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
- [approved 2026-10-15, in qjs-ffi/TODO.md section 6; name clash, missing symbols, by-value unions, --cstring, --handle, --out and --owned-return done 2026-10-15] **qjs-ffi-genbindings** (found by doc/generated-vs-handwritten.md in qjs-ffi, 2026-10-15): struct and function with the same name break --structs output (lws_xos); symbols missing from the library abort the import; NVGcolor by value and unresolved C++ value types drop functions; unsigned char * returns are numbers; no finalizers for C handles. details in that page.
- [open] **qjs-ffi-genbindings --emit-ir**: IR could serve as the shared input for extract-c-style queries
  (list functions/enums by prefix); consider an `ir-query` mode or document the IR schema.

## Done / declined

(none yet)
