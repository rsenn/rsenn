# Release lessons

Append-only. Newest last. Format: `- YYYY-MM-DD [project] fact. -> what to do.`
Record only what was verified. Promote repeated lessons into SKILL.md.

- 2026-10-07 [shish] No release or tag existed before 0.10; version 0.9 lived in `CMakeLists.txt` and
  `configure.ac` (grep `0\.9`). -> bump both together; `ChangeLog` was dead since 2005, start a fresh entry.
- 2026-10-07 [shish] The project had no CPack setup. -> added a block at the end of `CMakeLists.txt`;
  `cd build/<host> && cpack` writes `shish-<ver>-linux-x86_64.tar.gz` and `.deb`. A `MinSizeRel` build is
  already stripped.
- 2026-10-07 [shish] A static build with every builtin needs `-DLIBARCHIVE_BUNDLED=ON` (the system libarchive is
  shared), and failed to compile until `builtin_xargs.c` included `<string.h>`. -> build all-builtin static with
  the bundled libarchive.
- 2026-10-07 [shish] The emscripten build with every builtin failed in libarchive's configure ("pid_t doesn't
  exist"); a default-builtin build failed or timed out. -> do not promise wasm artifacts until it builds; the
  playground then still serves an older wasm.
- 2026-10-07 [shish] Sizes on the landing page were stale (139 KB claimed, 197 KB real). -> measure with
  `strip` on a fresh `MinSizeRel` build before every release; docs repeat the numbers (grep the old figure).
- 2026-10-07 [shish] `tests/fixed.sh` has 5 failing assertions with no known cause, and `ctest -j8` can time out
  `grouping-p` and `param-p` under load (they pass alone). -> state the failing set in the notes; rerun
  timeouts alone before calling them failures.
- 2026-10-07 [shish] `tar tzvf f` failed ("must specify one of -Acdtrux") in this environment; `tar -tzvf f`
  works. -> use dashed tar options.
- 2026-10-07 [rsenn] `sync.sh` builds from the project's working tree, so a dirty tree is published (commit
  message says `+dirty`). -> commit the project first, then sync.

## shish 0.10 build matrix
- Probe optional libc features with plain POSIX flags: GNU-only `GLOB_BRACE` in a probe silently disabled globbing on musl.
- musl `sbrk()` cannot grow the break: tests that exercise a brk arena must skip.
- Static glibc + `getpwnam` dlopens NSS and segfaults: do not ship it.
- `ENABLE_ALL_BUILTINS` must not pull in optional bundled libs that the user turned off (libarchive).
- Cross builds of bundled libarchive fail `check_type_size` ("pid_t doesn't exist"); ship a nocompress flavor.
- A missing `#include <unistd.h>` shows up only on stricter libcs (musl): build musl before tagging.
- Check the emcc/python host toolchain before blaming the project; mingw/NDK were absent here.
- CPack installs only the emscripten target's .html; ship .html + .js + .wasm by hand until install() covers them (TODO).
