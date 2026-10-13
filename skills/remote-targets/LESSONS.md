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
