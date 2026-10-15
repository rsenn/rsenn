# Assessment of the qjs-* tools (2026-10-14)

16 tools come from qjs-modules (`utilities/`, html2md: `examples/`), 5 from qjs-ffi/qjs-debugger, 1 from qjs-lws; all installed in
`/usr/local/bin`. Run them through `scripts/qtool` (module path fix). Facts per tool: `tools.yaml`;
per-skill employment: `skill-uses.yaml`; ideas for the tools: `PROPOSALS.md`.

Rating: 5 = reach for it routinely, 3 = good when the situation fits, 1 = skip.
"Run" = what I actually executed (not just read).

| Tool | Does | Rating | Run | Best employed in |
|---|---|---|---|---|
| **extract-c** | lexer-based C/C++ index: functions (+source), types with LP64 layout, macros, cross-file identifier refs, reachability | 5 | listing, source, types, unused, deps on shish | diet-coding (dedupe/dead code/split to one-fn-per-file/struct cost), quickjs-native-bindings (API surface of a C header, completeness), release-management (API diff between tags), github-pages (live numbers) |
| **runtime-diff** | member-set diff of modules/globals across qjsm/node/bun/deno | 5 | `path` on 4 runtimes | quickjs-scripting (modules.yaml compat lines), quickjs-native-bindings (Node-API parity), release-management (compat claims), github-pages (compat table) |
| **extract-comments** | comments of C/JS/sh/cmake/make/... with doc/style/length filters, JSON out | 4 | doc, multi-line, filters | diet-coding (contracts, TODOs), bindings (doxygen -> JS docs), github-pages (API docs), release (TODO gate) |
| **source-scanner** | fast NDJSON identifier/reference stream, follows local includes | 4 | one file | diet-coding / dead code by jq or script; feeds unused-functions |
| **nm-symbols** | link-level reachability + dead-code (-d) from nm/objdump | 4 | -d on .a (misleading), default not run | diet-coding (why is the binary this big), release size gate, remote-targets (per-target size) |
| **remove-dead-functions** | apply a dead list as sed script (dry run default) | 4 | not run (destructive) | diet-coding, bindings pruning |
| **list-exports** | exports of JS modules as an import statement | 4 | events.js | quickjs-scripting, bindings JS side, release diff |
| **resolve-imports** | ES import graph: list, check, unused, flatten/bundle | 4 | --list-imports | quickjs-scripting (audit, single-file delivery) |
| **highlight** | lexer-based highlighter: ansi/html/json/rtf | 4 | ansi, html fragment | github-pages (code samples), scripting (terminal output) |
| **parse-ast** | Earley parse with BNF/EBNF/g4/yacc/jison grammars -> JSON tree | 3 | EBNF sample | scripting (small formats), grammar prototyping |
| **unused-functions** | interactive unused-function browser | 3 | not run (tty) | the user, at a terminal, after source-scanner |
| **deadwood** | interactive dead-function remover (nm-symbols + removal) | 3 | not run (tty, destructive) | the user; Claude supplies the report |
| **html2md** | HTML/URL -> Markdown | 3 | snippet | github-pages import, pulling upstream docs |
| **jsonpp** | streaming JSON pretty/compact/JSON5, in-place | 3 | all modes but -w | any skill that touches JSON data files |
| **xml-shell** | DOM REPL on XML/HTML | 2 | piped only | exploration by the user |
| **qjs-ffi-genbindings** | clang-AST based C/C++ -> FFI binding + JSON IR (types, enums, sizes) for qjs/bun/deno/node | 5 | header with struct/enum/fns | bindings (API design, throwaway prototype), diet-coding (compiler-true types) |
| **qjs-ffi-describe.sh** | dump a module's API in qjsm/node/bun/deno/browser: flat, json, js skeleton, .d.ts; diff two runtimes | 5 | diff, dts, list | scripting (compat), bindings (parity, .d.ts), release (API diff), github-pages (reference) |
| **qjs-ffi-genstructs** | struct classes in JS, or C header with sizeof/offsetof asserts | 4 | C asserts | diet-coding & bindings (ABI/layout guard), release |
| **qjs-debugger / qjsm-debugger** | gdb-style JS debugger (repl/server/dap) | 4 | batch/json/library verified; qjs binary stale (32-bit) | scripting & bindings (JS-side debugging) |
| **qjs-ffi-describe.js** | qjsm-only entry of describe | 3 | help | prefer the .sh |
| **search** | SerpApi web search | 2 | not run (paid API) | scripted batch research only |
| **extract-structs** | legacy struct extractor | 1 | help only | none; use `extract-c -t` |

## Strategy notes

1. **Two toolchains, one question each.** *Source-level* (extract-c, source-scanner, extract-comments)
   answer "what is declared/used/said in the code"; they need no build. *Link-level* (nm-symbols
   -d, remove-dead-functions, deadwood) answer "what did the linker keep"; they need a build with
   `-ffunction-sections -fno-inline` and a linked `.so`/executable. Use the source level first, confirm
   with the link level before deleting anything.
2. **Evidence ladder for dead code** (diet-coding): `extract-c -i -c -C 0` (candidate) ->
   `extract-c -d -m main` (unreachable from entry points) -> `nm-symbols -d` on the linked binary
   (really not linked) -> human review -> `remove-dead-functions` dry-run -> build + tests. Data
   tables with 0 references are the usual false positives.
3. **JSON in, jq/qjs out.** Anything bigger than a screen goes to a scratch file (`-o`), then is queried.
   extract-c over a project takes seconds, not milliseconds; run once, reuse the JSON.
4. **Interactive tools (unused-functions, deadwood, xml-shell) are for the user.** Prepare their
   input, give the exact command line, do not try to drive them.
5. **runtime-diff replaces guessing** about portability: the answer for "does X exist on node/bun/deno"
   is a command, not memory. Run from `qjs-modules/` until the cwd bug is fixed.
6. **Compiler-true vs lexer view.** extract-c (lexer, no build, macro-blind unless -E) is fast and
   works on broken code; qjs-ffi-genbindings `--emit-ir` (clang) is exact on types/sizes but needs
   include paths and a parseable header. Use extract-c to browse, clang IR to decide layouts.
7. **Sharpest gap:** no tool diffs two *API versions* (extract-c output at tag A vs B) or two
   *C vs JS surfaces* (binding completeness). Both are one `diff`/`jq` over extract-c JSON today;
   if used often, a small `api-diff.js` in qjs-modules would be the natural next tool (PROPOSALS).
