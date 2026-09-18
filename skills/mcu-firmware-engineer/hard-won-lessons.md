# Hard-won lessons from a production-grade reference firmware

**Confidentiality note**: this file distills generalized engineering
*principles* and *techniques* observed in a private, professionally
engineered PIC18F252 appliance-control firmware that the user has
access to under a former employer's copyright. **Never name the
product, company, or file names from that codebase, and never quote or
paraphrase its actual source code, comments, or identifiers.** Every
technique below is described in this skill's own words, generalized
enough to apply to any low/mid-range PIC project, and is meant to be
re-implemented from scratch, not copied. That firmware has a 10-year
warranty and real units still get repaired after 30 years — the
patterns below are why: small, debuggable, testable, rugged.

## Compiler portability

- **Alias bare SFR-bit names, don't rely on each compiler's own
  bitfield-struct spelling.** A shared header defines plain macros like
  `ADON`, `GO`, `T0CS`, `WREN` → `ADCON0bits.ADON` etc., once, guarded
  per compiler — application code then never spells out a compiler-
  specific struct path at all. This is the same idiom already used in
  `pictest`'s own `lib/device.h`; seeing it independently converged on
  in a real production codebase is a strong signal it's the right shape
  for this kind of portability, not just a local habit.
- **No-op fallback macros for keywords a compiler lacks**: `#define rom`
  and `#define inline` to nothing under compilers with no such keyword,
  so the same source reads correctly everywhere without `#ifdef`
  clutter at every use site — only the *declaration* of the macro needs
  a compiler check, not every call site.
- **A absolute-address SFR fallback exists as an escape hatch**: for a
  compiler/target combination with no usable chip header at all, declare
  the handful of SFRs actually needed as fixed memory addresses by hand
  (byte-address + individual bit offsets), rather than blocking on
  vendor header support. Only reach for this when a real header
  genuinely isn't available — it's a last resort, not a default style.
- **One central `typedef`/`enum` shim** (`int8`/`uint8`/... and a
  `boolean_t` enum with explicit `FALSE=0`/`TRUE=1`) insulates the rest
  of the codebase from which compiler's own integer-width/bool
  conventions are in play.

## Time base

- **Pick a power-of-two ticks-per-second free-running counter** (this
  reference uses 256Hz) so `MSEC_TO_TICKS`/`HZ_TO_TICKS`-style
  conversions and period math stay cheap on hardware with no divide
  instruction, and derive every other timing constant from that one
  base rather than hand-picking each one.
- **Blink/toggle state can be stateless**: `(tick_counter / ticks_per_half_period) & 1`
  reproduces a clean on/off blink with zero extra timer or state
  variable — only the free-running counter is needed. Already used this
  way in `pictest`'s own code; worth defaulting to it over a dedicated
  blink-timer whenever the counter is already free-running.
- **Tap vs. hold needs no separate state machine** — compare elapsed
  ticks since press against a short-push threshold at release time.
  Auto-repeat while held can escalate through tiers purely from elapsed
  time: a slow repeat rate, then (after a longer hold) a fast rate, then
  progressively halving the repeat interval the longer the hold
  continues — and the increment granularity itself can coarsen at a
  natural boundary (e.g. stepping by a minute normally, jumping to whole
  hours once a countdown crosses an hour boundary while held).

## Interrupts

- **Fixed, tiny trampoline at the hardware vector address** that does
  nothing but `goto` the real handler placed wherever the linker puts
  it — keeps the two fixed vector slots minimal and lets the actual
  handler body live as ordinary compiled code. Matches the pattern
  already used in `libpicp`'s own interrupt handling.
- **High/low interrupt priority split**, with the truly time-critical
  work (e.g. a timer-driven tick/multiplex ISR) at high priority and
  everything else at low priority.
- SDCC's fast-context-switch attribute (`__shadowregs __interrupt N`)
  is worth using for a high-priority PIC18 ISR that must be fast and
  doesn't need to preserve every register through the vendor's normal
  (slower) save/restore path — check whether it's applicable per-project
  rather than always defaulting to the generic path.
- **Critical sections should bracket only the actual shared-state
  read-modify-write**, not be held open indefinitely — a paired
  `INTERRUPT_DISABLE()`/`INTERRUPT_ENABLE()` macro around exactly the
  few lines touching a variable the ISR also writes (e.g. updating a
  multi-byte display buffer, or clearing one bit of a shared flags byte
  in the presence of a concurrent ISR write to a different bit in the
  same byte) is the shape to copy — already the convention in
  `pictest`'s own `lib/ser_ioc.c`.

## Sensor / ADC robustness

- **Oversample via a small circular buffer, averaged on read.** An ISR
  keeps writing the latest raw ADC sample into the next slot of a small
  fixed-size buffer (wrapping around); the read side sums whatever
  slots are non-zero and divides by how many of them are non-zero — so
  a reading taken before the buffer's first full cycle (still holding
  startup zeros) still averages correctly over just the real samples
  collected so far, instead of a plain average being dragged down by
  not-yet-written zero placeholders.
- **Two-point linear calibration stored in NVM**, not a single offset —
  a low-point and high-point (raw-ADC, real-value) pair per channel,
  loaded once at startup and used to linearly interpolate every reading.
- **Validate calibration data against sentinel/erased patterns before
  trusting it**, and self-heal: if a stored calibration value is exactly
  zero, or all-ones in its low bits (both are recognizable
  "never-programmed" or "erased-flash" patterns for typical NVM), fall
  back to a compiled-in factory default *and rewrite it back to NVM* so
  the corruption doesn't recur every boot. This is what actually makes
  a device survive an EEPROM going bad or a first-ever power-up with
  blank NVM without needing a factory-calibration step to succeed
  first.
- **Plausibility-range-check every *computed* physical value**,
  independent of whether the calibration itself is sane — e.g. a
  computed temperature outside a physically reasonable range (even a
  slightly generous one) means the probe is disconnected or shorted,
  not that the reading should be trusted and acted on. Surface this as
  its own distinct UI/fault state, separate from the calibration-missing
  case above — they're different failure modes.

## Control-loop safety (defense in depth)

- A software PID (or similar) loop should have **its own internal
  guards**: clamp the integral term to a min/max to prevent windup, and
  short-circuit to a bang-bang response (full on/off) when the error is
  large enough that the linear terms aren't meaningful yet.
- **A hard, unconditional safety ceiling that bypasses the control
  algorithm entirely**: regardless of what the PID computes, force the
  actuator off outright once a measured value crosses an absolute
  limit. This check should be trivial and live right next to where the
  actuator command is finally issued, not buried inside the control
  math.
- **A second, independent check with a different threshold, in a
  different layer of the code** (e.g. the UI/mode-state layer, checking
  a higher threshold than the control loop's own limit) is genuine
  defense in depth — if a bug ever breaks the first check, the second
  one (written independently, checking a different number, in a
  different function) is very unlikely to share the same bug. Worth
  deliberately doing this for any actuator that can cause real harm if
  left on (heaters, motors), not just relying on one well-tested
  check.
- **Match actuator switching rate to the actuator's real physical
  response time.** A slow thermal or mechanical actuator doesn't need
  (and can be harder to reason about with) a fast PWM. The reference
  firmware drives its heater from an 8-bit `heater_power` (0-255) using
  a 10-second duty-cycle period: `phase = elapsed_ticks % period;
  actuator_on = (phase * 255 / period) <= heater_power` — a single
  modulo and multiply against a free-running tick counter, no dedicated
  PWM peripheral or separate duty-cycle state needed, and slow enough to
  match a heating element's own thermal lag.

## EEPROM / NVM endurance and integrity

- **Skip the write if the value hasn't changed.** Every NVM write
  function should read the current value first and return early if it
  already matches — this alone can eliminate the overwhelming majority
  of writes to a value that's rarely actually changed by the user
  (calibration, presets), which is what makes a limited-endurance
  EEPROM cell last for a 10+ year product lifetime.
- **Check the hardware's own write-success flag** after a write
  (PIC18's `EECON1`/`WRERR`-style bit) and propagate a real error
  instead of assuming the write succeeded.
- **Bracket only the unlock sequence + trigger bit in a critical
  section**, not the whole write function, mirroring the general
  critical-section-should-be-minimal principle above — the unlock
  sequence's specific timing is the part that's actually
  interrupt-sensitive.
- **Ship known-good factory-default NVM contents baked into the
  compiled image** (via whichever compiler mechanism preloads on-chip
  data EEPROM at program time), with a hand-maintained, commented byte-
  offset map, so a freshly programmed unit boots into a sane
  configuration without needing a first-run calibration wizard to
  succeed before it's usable at all.

## Peripheral driver shape

- **A driver's init routine should self-test the chip it's driving**
  before returning success — e.g. write a scratch value to a spare
  register/address and read it back, failing `init()` outright if the
  peripheral doesn't respond as expected, rather than silently
  proceeding as if it were present. Cheap to add, and turns a dead/
  miswired peripheral into an immediate, attributable init failure
  instead of a mysterious later symptom.
- **Keep the same command/write/read-mode framing separation** already
  used in this project's own layered drivers (e.g. `pictest`'s
  `lib/spi.c` → `lib/pcd8544.c` split): a low-level bit-shifting
  primitive, then thin mode-framing functions built on it, then the
  content/protocol layer on top. The reference firmware's own simple
  RAM-mapped LCD driver follows exactly this shape.

## Project & build structure

- **One shared codebase, multiple product/hardware variants, selected
  by a single central compile-time define** threaded through every
  file that needs to differ (`#ifdef VARIANT_X` at each divergence
  point) — not per-variant forks of the source tree. Keeps bug fixes
  and shared logic improvements automatically applying to every
  variant.
- **Wire the Makefile directly into the real factory workflow**: a
  `program` target that actually erases/flashes/verifies via the real
  production programmer's CLI, and a way to **read EEPROM contents back
  off a device** (e.g. a returned/serviced unit) for field diagnosis —
  not just a `build` target that stops at producing a `.hex`.
- **A small host-side (PC-native, not cross-compiled) companion CLI
  tool** that decodes a raw memory/EEPROM dump into human-readable,
  unit-labeled output (e.g. "247 (0x00F7) → 24.7°C") is worth building
  alongside the firmware itself — it turns a bare hex dump pulled off a
  device in the field into an actual diagnosis, and (if it also emits
  the firmware's own NVM-preset initializer syntax from a captured
  dump) doubles as a way to promote real field-calibrated values back
  into a new build's factory defaults.
- **Compile the firmware's own version number in** (major/minor/patch
  as `-D` defines from the build system, surfaced somewhere
  inspectable — a debug screen, a readable NVM location) rather than
  only tracking it externally in a filename or changelog.
- **Bias compiler optimization toward code size over speed** by default
  for this class of project (flash-constrained 8-bit target, most code
  not on a hot path) — only special-case a genuinely hot routine.
- **A disciplined, versioned release/dist step** (a fixed file list,
  packaged into a `name-version.tar.gz`) makes it possible to say
  exactly what shipped in a given unit years later — worth having even
  for a small hobby project, not just something a "real product" needs.
