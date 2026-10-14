# LESSONS - append-only learning log of the remote-targets skill

Format: `YYYY-MM-DD [target/transport/activity] what was non-obvious -> cause -> fix/command that worked`
At most 3 lines per entry. Verified facts only. No hosts, users, ports, serials, keys, secrets
(those go to `sites.yaml`). When an entry is generic and settled, promote it into the matching
`knowledge/` file and mark it `(promoted -> path)`. When a `[seeded]` knowledge bullet is proven
or disproven, record that here too. See SKILL.md "Learning loop".

2026-10-14 [skill] created; knowledge/ bullets are all `[seeded]` (written from general knowledge, not yet run on a real site). Upgrade to `[verified DATE]` as each is exercised.
2026-10-14 [termux/debug] gdb/lldb give `?? ()` and no backtrace: exec goes via linker64 (termux-exec LD_PRELOAD), so debuggers never learn the exe's load base -> fixed by `add-symbol-file ./prog -o 0x<base from /proc/pid/maps>` while attached. (promoted -> targets/termux.md#debug)
2026-10-14 [termux/instrument] clang -pg: undefined _mcount (no gprof); tcc -g: 'Unknown relocation type for got'; ASan builtin symbolizer fails ('fd 3') -> use symbolize=0 + llvm-symbolizer offline. (promoted -> targets/termux.md#debug)
2026-10-14 [probe.sh] worked over ssh and printed arch/OS/tools; the `libc:` line shows `file-5.48` on Termux (ldd is a wrapper script), ignore it there.
2026-10-14 [termux/sshfs] user's setup mounts `<alias>:..` (home/ + usr/ side by side) with `reconnect,transform_symlinks`; documented in targets/termux.md#transfer (generic) and sites.yaml (site data).
2026-10-14 [termux/profiling] no valgrind/perf/heaptrack/gperftools in Termux+TUR repos; simpleperf exists but needs `setprop security.perf_harden 0` via adb (not done, device change). Fallback: callgrind on a host build. (promoted -> targets/termux.md#trace)
2026-10-14 [termux/simpleperf] after perf_harden=0: must attach with -p (no child spawn as app uid); then blocked on unset property debug.perf_event_max_sample_rate (app uid cannot set; adb can). Result pending. (see targets/termux.md#trace)
2026-10-14 [sync] rt-sync.sh built+verified on a Termux site: snapshot refs avoid committing untested code and avoid clobbering remote edits; `git merge`/`git apply --3way` refuse on a dirty tree so `merge` uses per-file git merge-file. (promoted -> knowledge/activities/sync.md)
2026-10-14 [sh] under `set -e`, `cmd; x=$?` aborts the script on failure; use `if cmd; then ...` (bit rt-sync merge: new remote files silently skipped).
2026-10-14 [cosmo] researched from tool/cosmocc/README.md (4.x tree): release 4.0.2 = 442 MB zip / 1362 MB extracted (range-read of the zip directory); GitHub release asset has no digest, cosmo.zip TLS is fine (WebFetch's 'certificate expired' was the tool). APE runs on this x86_64 host without binfmt; on Termux (Android 15) the APE loader aborts 'Could not find a PHDR' in every launch variant tried. (promoted -> targets/cosmo.md)
2026-10-14 [termux/test] Termux has no `/tmp`: a test that does `mkdtemp('/tmp/...')` dies with a SyscallError; use `$TMPDIR`. A qjsm built there needs `LD_LIBRARY_PATH` pointing at the dir of its `libquickjs.so.<ver>` (BUILD_QUICKJS output) or it fails with 'CANNOT LINK EXECUTABLE'. Verified by qjs-modules Bun tests passing on-device after both fixes.
2026-10-14 [termux/sites] a project may live behind a symlink in `$HOME` (clone elsewhere); check `ls -ld ~/<proj>` before assuming `dirs.repos` (`Sources/`) holds it.
2026-10-14 [termux/debug] first mapping at file offset 0 is the linker's temporary ELF-header page, not the load base: a breakpoint at that 'base' is silently never hit. Use the executable segment's mapping minus its page-aligned p_vaddr. (promoted -> targets/termux.md#debug)
