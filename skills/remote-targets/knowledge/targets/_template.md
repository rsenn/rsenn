# <target-id>

Definition: [../../targets.yaml](../../targets.yaml) (`<target-id>`). Tag every bullet `[seeded]` or `[verified YYYY-MM-DD]`.

## Identity
Triple(s), libc, linkage, where the compiler runs, prefixes/paths that differ from a normal Linux.

## Build
Toolchain invocation, cmake/autotools flags, `cfg-*` helper, native vs cross. Link: [activity](../activities/build.md).

## Test
How to run the test suite for this target (emulator, device, exit-code handling). Link: [activity](../activities/test.md).

## Debug
Debugger, how it attaches/serves, symbol and sysroot handling. Link: [activity](../activities/debug.md), [remote-debug](../transports/remote-debug.md).

## Trace
strace/ltrace/perf/logcat/ETW/relay logs. Link: [activity](../activities/trace.md).

## Instrument
Sanitizers, coverage, size accounting. Link: [activity](../activities/instrument.md).

## Package
Artifact format and naming, runtime dependencies to ship. Link: [activity](../activities/package.md).

## Transfer
How to get files there and back, which dirs are exec-capable. Link: [activity](../activities/transfer.md).

## Gotchas
Surprises, each with cause and fix.

## See also
Related targets and transports (links).
