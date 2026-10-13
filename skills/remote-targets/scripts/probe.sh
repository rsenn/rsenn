#!/bin/sh
# probe.sh -- <transport command...>
# Send a read-only POSIX fact-gathering script to a remote shell and print the result.
# Examples:
#   probe.sh -- ssh -o BatchMode=yes <user>@<host>
#   probe.sh -- adb -s <serial> shell
# Copy the output into sites.yaml `facts:` (dated). Nothing is written on the remote.
# For Windows cmd.exe hosts this does not apply: run `ver`, `where cl`, `systeminfo` by hand.

[ "$1" = "--" ] && shift
[ $# -gt 0 ] || { echo "usage: $0 -- <transport command ...>" >&2; exit 2; }

PAYLOAD='
echo "date: $(date +%Y-%m-%d)"
echo "uname: $(uname -a 2>/dev/null)"
echo "machine: $(uname -m 2>/dev/null)"
[ -r /etc/os-release ] && . /etc/os-release && echo "os: $PRETTY_NAME"
command -v getprop >/dev/null 2>&1 && echo "android: $(getprop ro.build.version.release) api $(getprop ro.build.version.sdk) abi $(getprop ro.product.cpu.abi)"
command -v dpkg >/dev/null 2>&1 && echo "dpkg-arch: $(dpkg --print-architecture)"
[ -n "$PREFIX" ] && echo "prefix: $PREFIX"
echo "shell: $SHELL"
echo "libc: $( (ldd --version 2>&1 | head -1) 2>/dev/null)"
for t in gcc clang cc make cmake ninja git gdb gdbserver lldb strace ltrace perf valgrind rsync python3 node wasmtime qemu-aarch64 sshd; do
  p=$(command -v $t 2>/dev/null) && echo "tool: $t $p"
done
echo "cpus: $(nproc 2>/dev/null)"
echo "mem: $(grep -m1 MemTotal /proc/meminfo 2>/dev/null)"
echo "disk:"; df -h . 2>/dev/null | tail -1
'

printf '%s\n' "$PAYLOAD" | timeout 60 "$@" sh -s
