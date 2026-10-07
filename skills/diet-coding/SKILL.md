---
name: diet-coding
description: How to write lean, bloat-free C - one function per source file, a small library of string/byte/buffer primitives in lib/<module>/ instead of libc stdio/printf/string.h, explicit lengths instead of NUL scanning, static linking where unused code never reaches the binary, measuring size with size/nm. Use when writing or reviewing C that must stay small and fast, when adding a module to lib/ (or ../c-utils/lib/), when deciding where a function or header goes, when replacing a libc call with a lib/ primitive, or when asked to "diet" code.
---

# Diet coding: small, fast, nothing you did not ask for

The goal is a binary that contains only what it uses, runs without a runtime to speak of,
and can be read in one sitting. The style descends from the small-library tradition (libowfat, dietlibc),
and from the self-contained single-purpose C of tools like tcc and QuickJS: **few
dependencies, plain data, small functions, no framework.** The rules below are the
consequences, not taste.

Check the repo for its own `CLAUDE.md` first; where it differs, it wins.

## The rules in one screen

1. **One function, one source file.** `foo_bar()` lives in `foo/foo_bar.c`, nothing else does.
2. **One directory per module, one public header per directory:** `lib/foo/`, `lib/foo.h`.
3. **No stdio, no printf, no `<string.h>`, no `<stdlib.h>` in code that wants to be small.**
   Use the module primitives (`byte_*`, `str_*`, `fmt_*`, `scan_*`, `buffer_*`, `stralloc_*`,
   `alloc`) instead.
4. **A string is a pointer and a length** whenever the length is known or can be kept. Scan for
   the NUL only at the border (argv, the environment, literals).
5. **The caller owns memory.** Functions fill what you hand them; allocation is explicit, and
   the amount is computable before the call.
6. **No hidden state.** No static buffers, no locale, no `errno` games beyond "return -1, errno
   says why". State lives in a struct the caller holds.
7. **Measure.** Size is a test result, not a feeling (see "Measure").
8. **Surgical.** Add the function the task needs, in its own file; do not rework neighbours.

## 1. One function, one source file

The linker pulls whole object files out of a static archive. If `str_chr` and `str_rchr` share
a `.o`, a program that only needs one of them carries both - multiply by hundreds of helpers
and that is the difference between 20 KB and 400 KB. So:

- The file is named exactly like its public function: `byte_copy.c` defines `byte_copy` and
  nothing else with external linkage. A family member is its own file (`byte_copy.c`,
  `byte_copyr.c`, `byte_ccopy.c`).
- A `static` helper may sit in the same file **only if no other file needs it**. As soon as a
  second function wants it, it becomes a function in its own file and is declared in the
  module's `<name>_internal.h` (below) - or in the public header if callers can use it.
- No file-scope tables or state shared by several functions in one `.c`: a function that pulls
  the table in should be the only thing that does. Shared state is a struct declared in the
  header and defined in the one file that owns it.
- A file's first line is `#include "../<name>.h"`; then the function, with its contract in a
  short comment above it (what it returns in the edge cases: empty input, not found, error).
- Write the function in the plainest loop that is correct. Tricks (word-at-a-time copies,
  unrolling) belong behind `#if`s with the plain loop as the fallback, and only after a
  measurement says they matter.

```c
#include "../str.h"

/* str_chr returns the index of the first needle in in[], or strlen(in) if none. */
size_t
str_chr(const char* in, char needle) {
  const char* t = in;

  for(;;) {
    if(!*t || *t == needle)
      break;
    ++t;
  }
  return (size_t)(t - in);
}
```

## 2. Directory layout of lib/

```
lib/
  Makefile.in              recursive: builds each subdir into its archive, then ../libowfat.a
  typedefs.h               size_t, ssize_t, fixed-width ints: the one place for them
  byte.h                   public header of module byte      } one <name>.h per subdirectory,
  str.h  fmt.h  scan.h  buffer.h  stralloc.h  alloc.h ...    } included by users as "lib/<name>.h"
  arena.h  arena_internal.h        <name>_internal.h exists only when lib/<name>/*.c share
  path.h   path_internal.h         something users of the module must not see
  byte/
    Makefile.in            wildcard *.c -> byte.a (no per-file list to keep in step)
    byte_copy.c  byte_copyr.c  byte_diff.c  byte_chr.c  byte_zero.c ...
  str/   str_len.c  str_chr.c  str_diff.c  str_copy.c ...
  fmt/   fmt_ulong.c  fmt_long.c  fmt_8long.c  fmt_ulong0.c ...
  scan/  scan_ulong.c  scan_int.c  scan_8long.c  scan_xlonglong.c ...
  buffer/  buffer_init.c  buffer_put.c  buffer_putc.c  buffer_flush.c  buffer_get_token.c ...
  stralloc/  stralloc_catb.c  stralloc_cats.c  stralloc_copys.c  stralloc_nul.c ...
```

- **Directory = module = prefix.** Every file in `lib/foo/` is `foo_<verb>.c` and defines
  `foo_<verb>`. The prefix is the module name, so a symbol's origin is readable from its name
  and `nm` output sorts into modules.
- **`lib/<name>.h` is the only header users include.** It declares every public function with
  a comment (the same comment a man page would carry), the structs, and the constants. It
  sits next to the directory, not inside it. It includes only what its declarations need
  (`typedefs.h`, other module headers) and carries an include guard.
- **`lib/<name>_internal.h` is for the module's own `.c` files.** It declares the helpers,
  private structs and macros that several files in `lib/<name>/` share. It is included only
  from `lib/<name>/*.c`, never from outside, and it includes the public `<name>.h` first.
  No `_internal.h` when nothing is shared - most modules have none.
- **Modules depend downwards only:** `byte` and `str` use nothing; `fmt`/`scan` use them;
  `buffer` and `stralloc` use `byte`/`str`/`fmt`; anything bigger builds on those. No cycles,
  and no module reaches into another module's `_internal.h`.
- **Adding a module:** make `lib/<name>/`, put `Makefile.in` there (copy a neighbour's - it
  globs `*.c`), add the directory to the `SUBDIRS` of `lib/Makefile.in`, write `lib/<name>.h`,
  then one `.c` per function. The build globs, so there is no list of files to keep in step.
- **Where the library comes from.** `lib/` here is a libowfat-style library (`byte`/`str`/`fmt`/`scan`/`buffer`/`stralloc`/`alloc`). A sibling collection with
  more modules sits at `../c-utils/lib/` (`array`, `case`, `dir`, `errmsg`, `hashmap`,
  `dlist`, ...): **look there before writing a primitive, and copy a module in whole -
  directory, header, internal header - rather than re-inventing it.** Keep its naming.
- Code that is bigger than a primitive and single-purpose (a regex engine, an archive reader)
  goes in its own top-level directory built *from* `lib/`, with the same one-function-per-file
  layout, and is consumed by a thin wrapper. It does not go into `lib/`, which stays generic.

## 3. Replace the libc, do not wrap it

| instead of | use | why |
|---|---|---|
| `strlen`, `strchr`, `strcmp`, `memcpy`, `memcmp`, `memset` | `str_len`, `str_chr`, `str_diff`, `byte_copy`, `byte_diff`, `byte_zero` | one object each; `*_equal` returns a truth value, `*_diff` an ordering |
| `printf("%d", n)`, `sprintf`, `snprintf` | `fmt_long(buf, n)` / `fmt_ulong` / `fmt_8long`, `buffer_putlong` | no format interpreter, no varargs, no float, no locale; each conversion is a separate tiny function |
| `atoi`, `strtol`, `sscanf` | `scan_int`, `scan_ulong`, `scan_xlonglong` | return the number of characters consumed (0 = nothing parsed), never touch `errno` |
| `fopen/fgets/fputs/fprintf/fflush` | `buffer_*` over a file descriptor | no `FILE`, no hidden locks, you choose the buffer size and where it lives |
| `malloc/realloc/free` for growing text | `stralloc` (`s`, `len`, `a`), `array` | amortized growth in one place, always length-tracked |
| `strdup`, `strncpy`, `strcat` | `str_dup`, `str_copyn`, `stralloc_cats` | no unbounded writes, no silent truncation |
| `qsort`, `bsearch` | a small purpose-built one or `hashmap` | the generic one costs an indirect call per compare |
| `getenv`, `setenv` | an explicit environment table owned by the program | no libc-internal copy |
| `errno` strings (`strerror`) | `errno` number plus a short fixed table, or `fmt_ulong` | `strerror` drags in the locale and a table |
| `<math.h>`, `double` | integers, fixed point | float printing/parsing is the largest part of a libc |

Conventions to copy exactly, so code reads like the library:

- **`fmt_*(char* dest, value)` returns the length written; `dest == NULL` only measures.**
  Callers size the buffer, then format: `buf[fmt_ulong(buf, n)] = 0;`.
- **`scan_*(const char* src, T* dest)` returns the characters consumed, 0 on failure,** so
  `if(!(n = scan_ulong(s, &v)))` is the error test and `s += n` the advance.
- **`byte_*` take `(ptr, len, ...)`; `str_*` take NUL-terminated strings; `*n` variants take a
  bound.** Argument order is destination first, then length, then source (`byte_copy(out, len, in)`).
- **Return `size_t` for an index or length (use `len` for "not found"), `int` for 0/-1/1
  statuses, and a pointer or `NULL` for allocation.** Never `-1` in an unsigned.
- **`buffer` is `{x, p, n, a, op, cookie, deinit, fd}`:** `x` storage, `p` position, `n` fill, `a` size,
  `op` the read/write function, `fd` its first argument. Writes go `buffer_put*` ... `buffer_flush`; reads
  `buffer_get*`/`buffer_feed`. Flush exactly where the output must be visible.
- **`stralloc` is `{s, len, a}`:** `stralloc_ready(sa, n)` guarantees `n` bytes, `stralloc_cat*`
  appends, `stralloc_nul` (or the `stralloc_0` macro) NUL-terminates *without* counting it in `len`.
  Never assume a stralloc is terminated.

## 4. Writing the code

- **Types.** `size_t` for sizes and indices, `unsigned` for bit patterns, fixed-width types from
  `typedefs.h`/`uint*.h` only where the width is part of the contract. A boolean member of a
  struct is a one-bit field (`unsigned flag : 1;`); an integer member takes the type of the
  value it will hold, not the narrowest that fits.
- **Pointer loops** over arrays are as good as index loops and often smaller; pick whichever
  the compiler turns into the shorter code and keep the other out of the file.
- **Early return, flat control flow.** One level of nesting beats three. Guard clauses at the
  top; the main path runs straight down.
- **No allocation in a loop** you can hoist; grow a `stralloc` once and reuse it (`len = 0`).
- **No `malloc` that can only fail "never".** If failure is real (a user-sized request) check
  it and return; if a tiny fixed request fails the program has no way forward - let the
  allocator wrapper decide, do not scatter handlers.
- **No dead flexibility.** No option, callback or parameter without a caller. A function with
  one call site that is not a primitive is a block in its caller, not a new file.
- **Errors are values.** Return a status and leave `errno` set by the failing syscall; the
  top level prints one short line. No error-stack, no exceptions via `longjmp` except where a
  language runtime truly needs unwinding.
- **Portability goes behind a macro in one header,** not `#ifdef` sprinkled through
  functions. If a platform lacks a call, add one replacement file for that call.
- **Comments say what the code cannot:** the contract at the top of a function, and the one
  reason for anything that looks wrong. Show an example (`"a==" -> "a", ""`) before describing
  one in prose. Keep them short; history belongs in the commit message.
- **Style of the library:** 2-space indent, `if(` without a space, return type on its own line
  and the function name in column 0 (so `grep '^name('` finds a definition), `{` on the line of
  the `if`/`for`, one statement per line.

## 5. Build for size

- Compile with `-Os` (and `-ffunction-sections -fdata-sections`), link with `-Wl,--gc-sections`,
  then `strip`. Add `-fno-asynchronous-unwind-tables -fno-unwind-tables -fno-stack-protector`
  where the target allows it. `-flto` last, and only if it measurably shrinks the result.
- **Link statically against a small libc** (dietlibc, musl) when you can: the one-function-
  one-file rule pays off exactly there, because unused objects never enter the executable.
  Keep a dynamic/glibc build working as the portable reference.
- Avoid what the libc makes expensive: `stdio`, `locale`, `iconv`, `regex`, `getpwnam` and
  friends (they pull in NSS and dlopen), `printf` of floats, `pthread` where a plain process
  will do. Use the system call directly through its thin wrapper (`open`, `read`, `write`,
  `mmap`, `fork`, `execve`, `waitpid`).
- Prefer reading a file with `mmap` over a copy loop when the whole file is wanted; prefer one
  `write` of an assembled buffer over many small ones.
- Avoid `static` initialised tables bigger than a page for something computable in a few
  instructions; avoid large `switch`es that become jump tables in `.rodata` when an `if` chain
  or a lookup in a short string does the job.
- Do not use `inline` for size; use it for one-liners in headers (`byte_equal`) that the
  compiler would otherwise call.

## 6. Measure

```sh
size prog                      # text/data/bss: the first number to watch
ls -l prog                     # after strip
nm -S --size-sort prog | tail  # the biggest symbols: what did we pull in?
nm prog | grep -E ' (printf|malloc|setlocale|qsort|strerror)'   # unexpected libc
strace -c prog ...             # syscall count; one write per output line is a smell
```

- Compare the numbers **before and after** every change that is meant to reduce size, and write
  them in the commit message. A change that does not move them is not a size change.
- A module is lean when `nm` on an executable that uses *one* of its functions shows *one*
  of its functions. Build a two-line program that calls a single function and check.
- Check that a function you cannot see used is really dropped: put a symbol in a rarely used
  path, link, confirm with `nm` that it is gone when that path is not referenced.
- Also check speed where it is the point: a plain loop that fits the cache beats a clever one
  that does not. Measure with `time` over a large input, not by reading assembly.

## 7. Checklist before you finish

- [ ] Each new function is the only definition in its file, named after it.
- [ ] Its prototype and one-line contract are in the module's public header; helpers shared
      inside the module are in `<name>_internal.h`, nothing else leaked.
- [ ] No `<stdio.h>`, `<string.h>`, `<stdlib.h>` call was added to code on the lean path.
- [ ] Lengths are carried, not rediscovered; no fixed-size buffer without a bound check.
- [ ] A sibling library (`../c-utils/lib/`) was checked before inventing a primitive.
- [ ] `size`/`nm` before and after are recorded; nothing unexpected is linked.
- [ ] A test or one-line demo shows the edge cases named in the function's contract.
