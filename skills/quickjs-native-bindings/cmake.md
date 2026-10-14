# The shared cmake layer of the qjs-* projects

Reference for SKILL.md sections 21 and 24. Canonical copies live in `cmake/` of this skill,
scope per file in `cmake/MANIFEST`, drift tool `scripts/cmake-sync.sh`.

## Files and ownership

| File | Scope | Holds |
|---|---|---|
| `FindQuickJS.cmake` | all, synced | `find_quickjs()`: installation or built source tree; `configure_quickjs()` |
| `BuildQuickJS.cmake` | all, synced | `build_quickjs()`: clone/reuse + configure + build quickjs (`BUILD_QUICKJS`) |
| `QuickJSModule.cmake` | all, synced | `quickjs_module_options()`, `config_module()`, `make_module()`, `compile_code()` |
| `qjsm.cmake` | qjs-modules only | what gets baked into `qjsm` (builtins) |
| `Functions`, `Checks`, `Compat`, `UseMultiArch` | all, **not yet reconciled** | generic helpers; copies differ per project |
| `Find<Lib>`, `Build<Lib>` of third-party libs | per project | never synced |

Location: `cmake/<file>`; when the project has `cmake/deps/`, `Find*`/`Build*` files go there
(`qjs-modules`). `cmake-sync.sh` knows both.

Include order in a top-level `CMakeLists.txt`: `UseMultiArch`, `Functions`, `Checks`, `Compat`,
`FindQuickJS` (pulls `BuildQuickJS` and, if missing, Functions/Compat), `QuickJSModule`, `qjsm`.

## QuickJS variable contract (set by `find_quickjs()` / `build_quickjs()`)

`QUICKJS_INCLUDE_DIR(S)`, `QUICKJS_LIBRARY` (+ `QUICKJS_SHARED_LIBRARY`/`QUICKJS_STATIC_LIBRARY`),
`QUICKJS_LIBRARY_DIR`, `QUICKJS_C_MODULE_DIR`, `QUICKJS_JS_MODULE_DIR`, `QUICKJS_PREFIX`, `QUICKJS_INSTALL_LIBRARY_DIR` (absolute, for `INSTALL_RPATH`),
`QUICKJS_BUILD_ROOT` / `QUICKJS_SOURCES_ROOT` (when a tree is used), `QJSC`, `QJS`, `QJSM` (exact names: grep `FindQuickJS.cmake`)
(lookup off with `set(QUICKJS_FIND_QJSM OFF)` before the include: qjs-modules builds its own).

`QUICKJS_MODULE_PATH` (written to `config.h`) = the path in the found `quickjs-config.h` first, then the
configured dirs, de-duplicated. A C file including both headers must include `<quickjs-config.h>`,
`#undef QUICKJS_MODULE_PATH`, then `"config.h"` (see `qjs-modules/src/qjsm.c`), else the macro is redefined.

Rule: compile and link refer to the **build** tree (headers, libs), run time (rpath, module dirs)
refers to the **project's install dirs**. Never use `QUICKJS_LIBRARY_DIR` for `INSTALL_RPATH`.

## BUILD_QUICKJS

`ON` always build, `AUTO` (default) build only when no installation is found, `OFF` never.
Source dir, first hit wins: `QUICKJS_SOURCES_ROOT`; the project's parent dir if it is a quickjs tree
(no clone); `git clone` of `QUICKJS_GIT_URL` (default `git@github.com:rsenn/quickjs.git`, https
fallback) into `third_party/quickjs` if `third_party/` exists, else `<build>/quickjs-src`. The
`qjs-modules` submodule is fetched (quickjs includes its cmake files). Build happens at configure
time in `<build>/quickjs-build` (qjsc/qjs are needed while configuring); reconfigured only when
the stamp hash changes; logs `quickjs-configure.log`, `quickjs-build.log`. Installed with the
project (`BUILD_QUICKJS_INSTALL`). Every sibling `qjs-*` is passed `-DMODULE_<X>=OFF` so quickjs
does not build the projects that are building it.

**No double build.** Variables are plain, so `add_subdirectory()` children inherit
`QUICKJS_BUILD_ROOT` and `find_quickjs()` builds nothing (also if `TARGET quickjs` exists).
A separate configure (ExternalProject, script) must be given
`-DQUICKJS_BUILD_ROOT=.. -DQUICKJS_SOURCES_ROOT=.. -DQUICKJS_PREFIX=..`.
Limits: cross-compiling needs a host `qjsc` supplied; a fresh clone needs network + submodule access.

## QuickJSModule.cmake

- `quickjs_module_options([SHARED_DEFAULT ON|OFF] [STATIC_DEFAULT ON|OFF])` declares `BUILD_SHARED`
  (default ON) and `BUILD_STATIC` (default OFF; forced the other way on WASI/Emscripten).
- `make_module(<name> [sources..])`: target `qjs-<name>`; sources default to `quickjs-<name>.c` plus
  `<name>_SOURCES`; libraries, link dirs/flags, deps come from the variables `<name>_LIBRARIES`,
  `<name>_LINK_DIRECTORIES`, `<name>_LINK_FLAGS`, `<name>_DEPS` (dashes -> underscores). Builds
  `<name>.so` (BUILD_SHARED) and/or `quickjs-<name>.a` (BUILD_STATIC); installs both.
- static builds also write `quickjs-<name>.module.cmake` in the build dir; `include()` it from another
  configure to get `<name>_MODULE_LIBRARY`, `<name>_MODULE_LIBRARIES`, `<name>_MODULE_LINK_FLAGS`,
  `<name>_MODULE` (library + deps, link line ready).
- JS modules: `compile_code()` / `compile_module()` (qjsm.cmake) turn a `.js` into C bytecode.

## qjsm.cmake (qjs-modules)

Functions: `get_native_modules, get_compiled_modules, module_depends, module_path, compile_module,
generate_module_header, make_module_header, list_definitions, include_definitions,
extract_definition, remake_module, make_script`.
Macros (set variables the top level reads, so keep them macros), called in this order:
`qjsm_init_builtins`, `qjsm_resolve_builtins`, `qjsm_declare_imports`, `qjsm_compile_builtins`,
`qjsm_process_builtins`, `qjsm_add_executable`.

Baking in: `BUILTIN_MODULES` entries are a bare name (`lib/<name>.js` -> bytecode, `quickjs-<name>.c`
-> native, native wins), a `.js` file, or a directory/library of an out-of-tree `qjs-<name>` built
with `-DBUILD_STATIC=ON` (goes to `EXTERNAL_MODULES`, `<name>_MODULE` from its `.module.cmake`).
Natives are linked as `quickjs-<name>.a` and their init function runs at first import.
Overrides: `BUILTINS_NATIVE`, `BUILTINS_COMPILED`.

**Closed builtins.** A compiled JS builtin never loads a `.js` from disk: `qjsm_resolve_builtins`
scans each builtin's literal `import`/`export from` specifiers (`qjsm_scan_imports`; computed
specifiers are invisible) and bakes what they name in too (`BUILTINS_NEEDED[_JS|_NATIVE]`, not
cached: drop the dependants and the dependencies go). Compiled in = `BUILTIN_MODULES` +
`BUILTINS_NEEDED`; needed natives join the link closure. Builtins must not import `node:x`
(use `node/x`). Names with `-` are emitted with `BUILTIN_COMPILED_AS(symbol, "name")`.
The qjsm.c side (static imports of a builtin see only the builtin table) is in
`qjs-modules/doc/qjsm-layout.md` 4.1.

## Syncing

```sh
scripts/cmake-sync.sh status                 # = same  ~ whitespace only  ! differs  - missing  . n/a  ? no canonical
scripts/cmake-sync.sh diff qjs-ffi FindQuickJS.cmake
scripts/cmake-sync.sh apply qjs-ffi FindQuickJS.cmake BuildQuickJS.cmake   # never overwrites ! without --force
scripts/cmake-sync.sh adopt qjs-modules Functions.cmake                    # promote a project's copy
```
Project names are the directory names (`qjs-modules`). Nothing is committed by the tool; commit per
project afterwards (qjs-modules: no `Co-Authored-By`).

**Reconciling a file** (Functions/Checks/Compat/UseMultiArch/QuickJSModule variants): run `status`,
`diff` the minority variants against the newest, merge the functionality into one version, `adopt`
it, apply to one project, verify (below), then the rest. `QuickJSModule.cmake` in qjs-glfw (21 KB)
and the older variants carry bytecode helpers that only qjs-modules uses (now in `qjsm.cmake`).

## Verifying a change

1. Snapshot configure artifacts before/after in scratch build dirs (builtins.h, link flags,
   `cmake_install.cmake`, config.h, target list, `ctest -N`) and compare: refactors must be identical.
2. Fresh configures currently find 0 `HAVE_*` (bug `check-source-definitions-no-dash-d` in qjs-modules
   `BUGS`): preload them from an existing cache with `-C`.
3. Test installed/system quickjs, `-DBUILD_QUICKJS=ON` in-tree (parent is a quickjs tree), out-of-tree
   (clone; for local tests use `QUICKJS_GIT_URL=file://..` plus
   `GIT_CONFIG_COUNT/KEY/VALUE` for `protocol.file.allow=always` and the submodule url), and nested
   (child must not rebuild).
4. Run qjsm/tests under limits (`timeout 60 systemd-run --user --scope -q -p MemoryMax=4G -p MemorySwapMax=0`).
5. Install to a scratch prefix; check `readelf -d qjsm` RUNPATH is absolute and the module loads.

## Gotchas

- `option()` under old policy CMP0077 discards a pre-set variable: use `if(NOT DEFINED)`.
- Macros see `CMAKE_CURRENT_LIST_DIR` of the caller: capture dirs at include time (`_QUICKJS_CMAKE_DIR`).
- `Functions.cmake` / `Compat.cmake` are included on demand by FindQuickJS from its own dir or one up.
- Do not install into `QUICKJS_BUILD_ROOT`; the build tree is only for compile/link.
