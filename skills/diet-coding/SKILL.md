---
name: diet-coding
description: How to code, test, debug and document in the shish repo (a small POSIX shell in C on an in-tree libowfat, no stdio, no printf) - build presets, the test layers, the BUGS/TODO.md/fixes workflow, tracing and sanitizer builds, comparing against bash, and the traps that cost time. Use when changing anything under shish's src/, lib/ or text/, fixing a shish bug, adding a builtin, writing tests/fixed.sh cases, chasing an fd/redirection/expansion problem, or deciding where a change goes.
---

# Coding in shish ("diet" C)

`shish` is a proof-of-concept POSIX shell (IEEE P1003.2 target) in C that links an
in-tree copy of Felix von Leitner's `libowfat` (`lib/`) and uses as little libc as
possible. It is **not** a drop-in `sh`/`bash`. Repo rules live in `CLAUDE.md`; this
file is the working method.

## Where code goes

| Directory | What | Rule |
|---|---|---|
| `lib/` | generic portable primitives (`byte.h`, `alloc.h`, `str.h`, `buffer.h`, `stralloc.h`, `scan.h`, `fmt.h`) | no shell dependency; don't touch unused `lib/` code unasked |
| `src/` | the shell: `parse/ expand/ eval/ exec/ fd/ fdtable/ fdstack/ redir/ job/ sh/ builtin/` | one function per file, named `dir_name.c` |
| `src/builtin/` | shell-special and POSIX special/regular builtins | `B_SPECIAL` ones must exit a non-interactive shell on error |
| `src/builtin/extra/` | builtins that replace a coreutils program (`cat ls mkdir rm sleep touch ...`) | only compiled when enabled |
| `text/` | big text engines (`text/dfa` BRE/ERE) behind a thin `src/builtin/` wrapper | never a standalone binary |

- **No `stdio`, no `printf`.** Use `buffer_*`, `stralloc_*`, `fmt_*`, `scan_*`. Use
  `lib/byte.h`/`alloc.h`/`str.h` instead of `<string.h>`/`<stdlib.h>`.
- New source files: CMake globs `src/*/*.c`, but the autotools `Makefile.in` per
  directory lists files by hand. Prefer adding to an existing file when a helper
  belongs next to its only caller, or update both.
- A new builtin goes in `src/builtin/extra/` if it replaces an external program;
  register it in `cmake/Builtins.cmake` (`MINIMAL/DEFAULT/EXTRA_BUILTINS`) and
  `src/builtin/builtin_table.c`, and give it a `help_<name>` string.
- POSIX.1-2024 utilities volume is the **design spec** for every builtin that names a
  POSIX utility (options, operands, exit status, "unspecified" points). Builtins
  with no POSIX page (`dump`, `digest`, `hostname`, `timeout`, `which`, `mktemp`)
  follow coreutils and say so in `help_*`.

## Style

- Match the surrounding file: 2-space indent, `if(` without a space, return type on
  its own line, function name at column 0.
- Do not "improve" adjacent code. Every changed line traces to the request. Remove
  only the imports/variables **your** change orphaned; mention unrelated dead code.
- No error handling for impossible cases, no flexibility nobody asked for.

### Comments (strict)

- Struct member: 1-2 lines on the member.
- Behaviour comment: **4 lines max**, else restructure as a one-line summary plus a
  short list, or a table.
- Never mention `fixes/NN`, `BUGS` entries, issue names or "confirmed via repro X" -
  that is commit-message history. State the current rule and its reason.
- Show, don't tell: `flags & X_SPLIT`, `"a==" -> "a", ""`.
- Parameter comments: one per line, aligned columns:
  ```
  /* one-line summary.
   *
   *   const char*  name   what it is
   *   size_t       len    what it is
   * ----------------------------------------------------------------------- */
  ```

## Build

```sh
. ./cfg.sh && cfg                          # native build -> build/<triple>/
cmake --build build/x86_64-linux-gnu -j
```

Other presets in `cfg-cmake.sh`: `cfg-diet cfg-musl cfg-mingw64 cfg-emscripten cfg-wasm
cfg-tcc cfg-aarch64 cfg-android cfg-termux cfg-msys`. Options: `CMAKE_BUILD_TYPE`
(default `MinSizeRel`), `LINK_STATIC`, `ENABLE_LTO`, `USE_EFENCE`, `WARN_WERROR`,
`-DBUILTIN_<NAME>=ON/OFF` (permanent in cache; the old `ENABLE_<NAME>` spelling is
gone), `-DENABLE_ALL_BUILTINS=ON`.

- A `WINDOWS_NATIVE`-only code path cannot be tested here: build it
  (`cfg-mingw64`/`cfg-mingw32`), confirm it compiles and links clean, and say so in
  a comment in `tests/fixed.sh` instead of padding the file with a vacuous test.
- Autotools alternative: `./autogen.sh && ./configure && make`.

### Build variants worth keeping around (put them outside the tree, e.g. in the scratchpad)

```sh
# sanitizers - a gate for every language/builtin change, not a one-off
cmake -S . -B $D/asan -DCMAKE_BUILD_TYPE=Debug -DCMAKE_C_FLAGS="-fsanitize=address,undefined"
ASAN_OPTIONS=detect_leaks=0 $D/asan/shish tests/fixed.sh     # leaks are tracked separately

# tracing (SHISH_TRACE) + dump builtin
cmake -S . -B $D/dbg -DCMAKE_BUILD_TYPE=Debug -DDEBUG_OUTPUT=ON -DBUILTIN_DUMP=ON
```

- `DEBUG_OUTPUT` is only declared when the build type contains `Deb` (`Debug`,
  `RelWithDebInfo`) or `-DBUILD_DEBUG=ON`; with `MinSizeRel` the flag is silently
  ignored and `SHISH_TRACE` does nothing. The old `DEBUG_FD/FDSTACK/FDTABLE` flags are not
  needed. The full trace/strace/gdb/lldb method is in shish's `CLAUDE.md`, "Debugging with TRACE()".
- Leak reports on stderr make every posix `.tst` fail under ASan unless
  `detect_leaks=0` is set; that is noise, not a regression. `ASAN_OPTIONS` set in one
  shell call does not persist to the next.
- A Debug/ASan build has no `HAVE_MMAP`, so the script is read through a real fd:
  behaviour (and `tests/fixed.sh`'s assertion count) differs from the default build.

## Tests

Layers, cheapest first:

1. `tests/*.sh` - one script each, run **through the freshly built shish**; CTest
   registers every file except `common.sh` and `run-tst.sh`.
2. `tests/fixed.sh` - one regression case per fixed bug.
3. `tests/posix/*.tst` (yash's POSIX suite, 123 files; on by default, off with
   `-DDO_CONFORMANCE_TESTS=OFF`) via `tests/run-tst.sh`.
4. `tests/yash/*.tst` - `-DDO_YASH_TESTS=ON` (off: several files hang to their 120 s timeout).
5. `-DDO_PTY_TESTS=ON` - the `%REQUIRETTY%` files under `tests/pty-run.c`.

```sh
cd build/x86_64-linux-gnu
ctest -R if.sh -V                                         # one test, verbose
./shish ../../tests/if.sh                                 # run a test directly
sh tests/run-tst.sh "$PWD/build/x86_64-linux-gnu/shish" tests/posix exec-p.tst   # testee path MUST be absolute
```

Per-file failures land in `tests/posix/<name>.trs` (`%%% FAILED:`/`PASSED:` lines,
diffs of stdout/stderr/status). Scoreboard / "what is this family failing on":
```sh
for f in tests/posix/*.trs; do grep -Ec '^%%+ FAILED' $f; done
grep -h -E '^%%+ FAILED' tests/posix/sig*.trs | sed -E 's/.*: SIG[A-Z]+ //; s/ \(.*//' | sort | uniq -c | sort -rn
```

### Writing a `tests/*.sh`

- Start with `. "$(dirname "$0")/common.sh"`; every check goes through
  `assert_equal / assert_match / assert_nomatch / assert_greater / assert_less`, last
  argument a **description of what must be true**.
- **Argument order:** `assert_equal EXPECTED ACTUAL desc`, but
  `assert_match VALUE PATTERN desc` (value first). Swapping them passes nothing.
- End with `summary`: it is what makes the script exit non-zero. A file without it
  always "passes".
- Assertions do not stop the script, so one run lists every check, pass or fail.
- In `tests/fixed.sh` run the thing under test in a **child** (`"$SHISH_SELF" -c '...'`)
  when it exits the shell or changes process-wide fds; do not rely on `$TESTDIR`
  still existing (earlier sections `rm -rf` it) - make your own `mktemp -d`.
- A description containing `$(...)` in double quotes is *executed*; escape it
  (`\$(...)`).

## The fix workflow (all in one change)

1. **Reproduce** with a concrete command; compare against `bash` (see below).
2. **Write the failing test** in `tests/fixed.sh` first; confirm it fails (revert the
   fix temporarily, or run it on a baseline binary) and then passes.
3. **Fix** with the smallest change. Run the new test, the neighbouring posix files,
   the full `ctest`, and the ASan build.
4. **`fixes/NN-short-name.patch`** - the next number after the highest in `fixes/`
   (`ls fixes | sort -n | tail`), plain `git diff` of the source change, no commit message.
5. **`BUGS`** - delete the entry (or narrow it) you fixed; add any new bug you
   stumbled into with a **concrete repro command**. Flat list, `- name: description`.
6. **`TODO.md`** - keep it in sync with `BUGS`: update or remove the mention.
   `TODO` (no extension) is the old pre-2010 file; ignore it.

A stale `BUGS`/`TODO.md` is worse than a stale comment. Update them in the same
change, not later.

## Debugging methods

### Compare with bash first
```sh
for sh in bash $PWD/build/x86_64-linux-gnu/shish; do echo "== $sh"; $sh t.sh 2>&1; done > out
awk '/^== /{f++} {print > "out.part" f}' out; diff out.part1 out.part2   # only the header differs when they agree
```
Use absolute paths for the shish binary (a relative one breaks after a `cd`). Error
*wording* differs (`file:LINE:COL: msg` vs bash's `line N:`); compare behaviour,
not message text.

### Baseline binary for "did I break it?"
```sh
git worktree add -f $SCRATCH/base <commit> && cmake -S $SCRATCH/base -B $SCRATCH/base/b && cmake --build $SCRATCH/base/b -j8
git worktree remove --force $SCRATCH/base
```
Better than `git stash` (no risk to the working tree). Diff the sorted `FAILED:` lines
of the posix files before/after; a pre-existing failure is not a regression.

### SHISH_TRACE (runtime, compiled in with `DEBUG_OUTPUT`)
```sh
SHISH_TRACE=fd,fdstack,fdtable,redir,exec SHISH_TRACE_FILE=/tmp/x/trace.log build/dbg/shish -c '...'
```
Modules: `exec builtin fd fdstack fdtable eval redir var sh job sig`; `all`, `-name`
to exclude; `SHISH_TRACE_FILE=-` is stderr. Each line is `[pid:level] module.event(...)`.
Read `fdtable.exec.table(vfd=, shadow=, fd={n=, e=, level=, mode=...})` to see the
virtual-to-effective fd map at fork time and `fdtable.exec.fds {...}` for what the
child really has. Details: `doc/debug-output.md`. `dump [-Fvl] [-u fd]` (`-t -s -f -j`
in debug builds) prints internal tables.

### Kernel view
- `strace -f -o st.txt -e trace=close,dup,dup2,dup3,fcntl,pipe2,execve,write ./shish ...`
  shows what the child actually does (an `ld.so` `close(3)` right after `execve`
  means fd 3 was close-on-exec).
- `ls -l /proc/self/fd` from a child, and `ls /proc/$$/fd | wc -l` before/after a
  loop, for descriptor leaks.

### Targeted instrumentation
To prove an invariant is never violated, add a temporary `abort()` guarded by the
condition, run the test suites against a Debug build, then remove it (verify with
`git diff` that only the real fix remains).

### Other
- `shformat` (pretty-printer reusing the parser) and `shparse2ast`
  (`-DBUILD_SHPARSE2AST=ON`) for parser questions.
- Timing-sensitive signal tests (`sig*-p`) must be measured on an idle machine; the
  same binary scored 36/180 and 177/180 depending on load.
- `tests/posix` leaves `tests/posix/tmp.NNNNN/` behind after a hard failure.

## Architecture notes that save time

- **Non-forking scopes.** `(...)` (`eval_subshell`) and `$(...)` (`expand_command`)
  run in-process. Each pushes an fdstack level and pairs `fd_state_save()` with
  `fd_state_restore()`, plus `vartab_push/pop`, `sh_push/pop`,
  `exec_functions_save/restore`, trap snapshot. A new in-process scope repeats all
  of them. `fd_scope_note()` journals fds owned by outer levels so the restore can
  put them back.
- **Virtual vs effective fds.** `struct fd` has `n` (the number the script sees) and
  `e` (the kernel descriptor); they are reconciled only when a child is forked
  (`fdtable_exec`). Shadowed structs sit under newer ones in `fdtable[n]`.
  `fdtable_dup` relocates a live occupant of its target with a plain `dup()`; never
  `dup2` onto a number another struct lives on.
- **Command substitution fd 1** is a stralloc (`e == -1`): an external child needs a
  pipe (`fdstack_npipes/fdstack_pipe`); the parent drains it (`fdstack_data`). The
  child closes the pipe's read end first (`fdstack_closerd`).
- **Close-on-exec** marks only the shell's private relocated copies (`e != n`); a
  user fd on its own number (`exec 3>&1`) must be inherited.
- **Special builtin errors** exit a non-interactive shell (`sh_exit` unless
  `sh_interactive`); `readonly`, `export`, `unset` follow the same pattern.
- **Expansion** works on `N_ARG` node chains; `expand_args()` is the per-command
  driver, `expand_param()` handles `$@`/`$*`/modifiers, `expand_cat()` does field
  splitting. `"$@"` with no parameters must be zero fields, `""$@` one.
- `exit`/`return`/`break` unwind by `longjmp` to the nearest `E_ROOT`/`E_FUNCTION`
  eval frame; `sh_forked()` clears `jump` on inherited frames in a child.

## Shell-session traps

- **Never `pkill -f <pattern>`** from the tool shell: the pattern matches the command
  line of your own shell and kills it. Use the PID, or `pkill -x`.
- `git stash` / `stash pop` around a baseline build works but a killed shell between
  them leaves the work stashed - prefer `git worktree`.
- `tests/builtin-cp.sh` hangs; run `ctest -E builtin-cp --timeout 30` and bound
  anything else with `timeout`.
- Keep scratch files in the session scratchpad, not `/tmp`; don't leave `gmon.out`
  or the `*.log` files in a commit (`git add` named paths, never `-A`).
- `sleep N && check` is blocked; poll with an `until` loop under Monitor.

## Commits

- Omit the `Co-Authored-By:` trailer (the repo's `CLAUDE.md` overrides the default).
- Commit and push only when asked. Subject line says what changed; the body lists
  the user-visible effect, the tests added and the `fixes/NN` range.
- Stage by path: `git add BUGS TODO.md tests/fixed.sh src fixes/NNN-*`.

## The GitHub Pages site

Generated, never hand-edited. Use the `github-pages` skill and the shared generator in
`rsenn/rsenn` (`sites/shish/`, `tools/site/`). Do not add a `tools/site/`, Pages
workflow or `publish.sh` to this repo. Sync with `tools/site/sync.sh shish` (commits
locally; `--push` only after the user confirms).
