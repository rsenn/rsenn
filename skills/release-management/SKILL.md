---
name: release-management
description: Prepare, build, package, tag and publish releases of rsenn's projects (https://github.com/rsenn), including GitHub releases with attached artifacts. Use when asked to bump a version, write a changelog or release notes, build binaries or packages for several targets (cpack, cross toolchains), tag a release, create or update a GitHub release, or decide whether a project is ready to release. The skill keeps its own LESSONS.md and extends itself after every release.
---

# Releasing rsenn projects

First release of any rsenn project: shish 0.10.0 (2026). This skill is the playbook and it
**learns**: read `LESSONS.md` before you start, and append to it when you finish (see
"Learning loop"). Project specifics live in the lessons, not here.

## Rules that never change

- **Publishing is outward-facing.** Pushing a branch or tag, creating a GitHub release, uploading
  an asset: show what will go out (`git log origin/main..`, `git tag -l`, the asset list with sizes
  and checksums) and ask first, every time. An earlier yes does not cover the next push.
- **Never move or delete a tag that is already on the remote** unless the user says so for that
  tag. Fix problems before the tag is pushed; if it must move, say what breaks for people who
  fetched it.
- **Release only what was verified.** A target is "builds" when it compiled and linked from the
  tagged commit, "tested" when the test suite ran on it, "smoke-tested" when the binary ran once.
  Write which one in the notes. Never claim a target that was not built.
- **Release notes state the known gaps.** Failing tests, missing features, stale numbers.
- Do not touch the user's unrelated uncommitted work: commit with explicit paths
  (`git commit -- file ...`), never `git add -A`, `stash`, `reset` or `checkout -- file`.

## Tools

Tools: see `tool-registry/skill-uses.yaml` key `release-management`; run them via `tool-registry/scripts/qtool`.
Facts per tool live in `tool-registry/tools.yaml`. Useful here:

- readiness (step 2): `qtool extract-comments -i -p 'todo|fixme|xxx' src lib` for leftovers; `qtool jsonpp -c f.json >/dev/null`
  fails on a manifest that does not parse
- notes (step 6), public C API changes since the last tag: run `qtool extract-c -l include` (or `lib`) in a
  `git worktree` at the old tag and in the tree to release, strip `:line:col` (`sed 's/:[0-9]*:[0-9]*:/:/'`), sort, `diff`;
  `<` lines were removed, `>` added (1.7 s on shish v0.10.0 against HEAD)
- a release script (qjsm) that fails only in the release environment: `qjsm-debugger --json --timeout 120 -x cmds.txt script.js`
  and read the records instead of adding prints
- JS-facing modules: `qtool qjs-ffi-describe.sh --flat <mod>` on each build, then `diff`, before claiming compatibility

## Procedure

1. **Decide the version.** Read the existing scheme (`CMakeLists.txt`, `configure.ac`, tags,
   `ChangeLog`). Prefer `0.x` while known gaps exist; 1.0 promises stability, so only with
   evidence (a corpus run, all targets built, gaps documented). Propose a number, let the user pick.
2. **Readiness check.** Clean `git status` apart from declared unrelated files; tests run and the
   failures are known; docs, site and landing-page numbers match the code (measure sizes, do not
   copy them); `BUGS`/`TODO` agree with the code.
3. **Bump** every place the version lives (grep the old number), add a `ChangeLog` entry or notes
   file, commit with explicit paths, then tag annotated: `git tag -a vX.Y.Z -m "<project> X.Y.Z"`.
   Keep the tag local until step 7.
4. **Build every target** from the tagged commit, each in its own build directory (or a
   `git worktree` at the tag, so uncommitted work cannot leak in). Record per target: toolchain,
   result, binary size, how it was run (native, qemu, node), test result. Fix compile errors
   with a patch and a test where one is possible, then rebuild everything, because the tag may
   have to move (it may, because it is still local).
5. **Package** with the project's packaging (cpack: `tar.gz`, `deb`; a zip for Windows; the wasm
   files for the web build). Name artifacts `<name>-<version>-<os>-<arch>.<ext>`. Extract one and run
   it. Write `SHA256SUMS` (`sha256sum <files> > SHA256SUMS`).
6. **Notes.** Short: what is new (from the changelog, `fixes/`, commit log), a table of
   targets with their verification level, known gaps, how to build from source.
7. **Publish, with confirmation.** Push `main` and the tag. Then
   `gh release create vX.Y.Z <artifacts> SHA256SUMS --title "<name> X.Y.Z" --notes-file <file>
   [--prerelease]`. `--prerelease` while the version is 0.x or has known serious gaps.
   Check `gh auth status` first; if it fails, tell the user to run `! gh auth login`.
8. **After.** Check the release page lists every asset and the tag points at the right commit
   (`git ls-remote --tags origin`). Update README/site download links and the version shown on the
   site; rebuild the site only after the release exists.
9. **Learn.** Append to `LESSONS.md` (below).

## Per-target notes (rsenn C projects)

The helpers are in the project's `cfg-cmake.sh` (`cfg-musl`, `cfg-diet`, `cfg-mingw32/64`,
`cfg-aarch64`, `cfg-emscripten`, `cfg-wasi`, `cfg-termux`, `cfg-tcc` ...). They pin a toolchain
file and write into `build/<host>/`. Check `command -v` for each toolchain first and list what is
missing instead of guessing. Tools that cannot run here (aarch64, mingw) are smoke-tested under
`qemu-user` or `wine` if present, otherwise reported as "builds" only.

## Learning loop

This skill modifies itself in two files and nowhere else:

- **`LESSONS.md`** (append-only log). After every release, or after a release attempt that hit
  trouble, add dated entries: what went wrong or was non-obvious, the cause, the fix or the
  command that worked. One entry per fact, at most 3 lines, with the project name.
  Only record what you **verified** this session (a command that you ran, an output you saw).
  Never record guesses, secrets, tokens or personal data.
- **`SKILL.md`** (this file). When a lesson shows up in **two different releases** or is a
  rule that would have prevented a mistake, promote it: move it into the procedure or the rules,
  mark the lesson `(promoted)`, and tell the user what you changed in the skill. Do not rewrite
  the rules section on a hunch, and never weaken the "outward-facing" rules; only the user can.

Before editing either file, read it again (it may have changed). Keep both short: if
`LESSONS.md` passes ~150 lines, summarise the old entries into the procedure and archive the
rest in `LESSONS-archive.md`.
