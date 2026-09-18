# Task: write an EAGLE .scr script for the circuit already designed

You already know the circuit — the parts and the wiring were worked out and
shown to the user as ASCII art earlier in this conversation, and approved.
Your job now is narrower: turn that already-approved design into an EAGLE
7.2.0 script (`.scr` file), using **only** the exact part/pin data given to
you below. You will not run any code and have no way to check your work —
a human will paste the result directly into EAGLE, so it has to be right
the first time. Follow the rules below exactly rather than improvising.

## Library location

All parts below come from `.lbr` files in this absolute directory:

```
<!-- LIB_DIR -->
```

Every `ADD` command's `@library` part must be this directory plus the
part's `library` name plus `.lbr` — e.g. a part with `library: r` becomes
`@<the directory above>/r.lbr`. **A bare library short name (`@r`) does
not work** — EAGLE reports "Device not found" for it even though the part
genuinely exists — confirmed against a real EAGLE 7.2.0 install.

## The parts you may use

Below are two YAML blocks: a constant set of passive components (always
the same), and the specific semiconductors/connectors this circuit needs.
**Use no deviceset, gate, pin name, or library not listed in these two
blocks.** If the circuit you designed needs a part or pin that isn't here,
say so instead of inventing one — do not guess a plausible-looking name.

```yaml
<!-- CURATED_RLC_CPOL_YAML -->
```

```yaml
<!-- CIRCUIT_SPECIFIC_YAML -->
```

### How to read these YAML blocks

Each top-level key is a **deviceset** name (the part type, e.g. `R`,
`PIC18F2550-I/SP`, `CONN-6P`). Each deviceset has:
- `library`: the `.lbr` file it's from, without the `.lbr` extension (e.g.
  `r`, `mcu`, `pinconn`) — combined with the absolute library directory
  path given to you separately, this becomes the `@library` part of an
  `ADD` command (see Step 2 — **the short name alone does not work**).
- `prefix`: the conventional reference-designator letter (`R`, `C`, `U`,
  `J`, `D`, `Q`, …) — informational only, doesn't change the output syntax.
- `device`: the exact device-name suffix you must append **directly onto
  the deviceset name, with no separator** (e.g. deviceset `R` + device
  `0204/10` → `R0204/10`) when writing the `ADD` line. This can be an
  empty string — when it is, append nothing (the bare deviceset name is
  already a complete, valid device name for that part). **Never invent or
  omit this suffix** — a deviceset name without its device suffix is
  rejected by EAGLE as "Device not found", confirmed against a real
  EAGLE 7.2.0 install.
- `gates`: one or more named gates, each with a `pins` map. **Use only the
  first gate listed** for each part (its key, in the order YAML lists it)
  — multi-gate parts (e.g. quad op-amps) are out of scope for this pass;
  if a part genuinely needs more than one gate placed, say so instead of
  only placing one and pretending it's complete.
- Each pin has `direction` (informational) and `x`, `y` — the pin's
  position **in millimeters, relative to the part's own placement point**
  (i.e. where the part would sit if placed at coordinate `(0, 0)` with no
  rotation). These are not absolute sheet coordinates yet — see Step 3
  below for how to turn them into real coordinates.

## Output format

Produce exactly one thing: a single code block containing the `.scr` text,
nothing else inside it (no comments, no blank explanatory lines mixed into
the script). After the code block, add a short plain-text note reminding
the user this hasn't been tested against a real EAGLE install and that
placement is a simple single row — nothing else.

The script has three parts, always in this order:

```
GRID MM;
SET WIRE_BEND 2;
ADD <deviceset><device>@<library-dir>/<library>.lbr '<ref>' R0 (<x> <y>);
VALUE <ref> <value>;
... one ADD line (+ VALUE line, only if the part has a value - e.g. a
    resistor/capacitor - resistors and capacitors always need one) per part ...
NET '<netname>' (<x1> <y1>) (<x2> <y2>);
... one NET line per connected pair, see Step 4 ...
```

`SET WIRE_BEND 2;` switches EAGLE's wire-drawing mode to a direct
point-to-point line (confirmed against a real EAGLE 7.2.0 install — see
`SET WIRE_BEND bend_nr` in the EAGLE help reference; `2` is "starting
point - end (straight connection)"). Without it, EAGLE auto-routes every
`NET` line's two points as an L-shaped horizontal-then-vertical path
instead, which is what makes unrelated nets' wires collide when several
parts share a row/column — always include this line.

In the `ADD` line: the device/library token comes **first**, the (quoted)
instance name comes **second** — `ADD R0204/10@/abs/path/r.lbr 'R1' R0
(20 0);`, never `ADD 'R1' R0204/10@...`. Getting this order backwards is
rejected as "Device not found" even though the part exists — confirmed
against a real EAGLE 7.2.0 install. `<deviceset><device>` is the
deviceset name with its YAML `device` field appended directly, no
separator (see "How to read these YAML blocks" above).

**`VALUE` is unquoted** (`VALUE R1 220;`, not `VALUE 'R1' '220';`) — this
differs from `ADD`/`NET`, which do quote their instance-name arguments.
Skip the `VALUE` line entirely for parts with no meaningful value
(connectors, ICs, LEDs, diodes) — only emit it when you actually have one
to set (resistors, capacitors, inductors).

## Step 1: list your parts in a fixed order

Take the parts from the design you already approved with the user. Assign
each one a reference designator (`R1`, `D1`, `U1`, `J1`, …, following each
deviceset's `prefix` — number them in the order you introduce them,
starting at 1 per prefix) and a position in a single ordered list, index
`0, 1, 2, …` — this order is what Step 2 places them by.

## Step 2: compute each part's placement point

Every part goes in a single horizontal row, spaced 20 mm apart, always at
rotation `R0` (never rotated or mirrored in this pass):

> part at index *i* is placed at `(20 * i, 0)`

So the 1st part (index 0) is placed at `(0 0)`, the 2nd at `(20 0)`, the
3rd at `(40 0)`, and so on. Emit its `ADD` line using this placement point
and its resolved deviceset/device/library from the YAML above:

```
ADD <deviceset><device>@<library-dir>/<library>.lbr '<ref>' R0 (<placement_x> <placement_y>);
```

If this part has a resistance/capacitance/inductance value you decided on
(resistors and capacitors always should), follow it immediately with
(unquoted, unlike `ADD`):

```
VALUE <ref> <value>;
```

## Step 3: compute each pin's absolute coordinate

For any pin you need for wiring (`<ref>.<pin-name>`), find that exact pin
under that part's deviceset's first gate in the YAML, and add its `x`/`y`
to that part's placement point from Step 2, **keeping full decimal
precision exactly as given — do not round**:

> absolute pin coordinate = (placement_x + pin.x, placement_y + pin.y)

## Step 4: emit one NET line per connected pair

For each net in your design with members `p1, p2, …, pk` (in the order you
naturally listed them), emit `k - 1` separate `NET` lines chaining
consecutive members — **not** one line with every point in it:

```
NET '<netname>' (<p1.x> <p1.y>) (<p2.x> <p2.y>);
NET '<netname>' (<p2.x> <p2.y>) (<p3.x> <p3.y>);
```

(for a 2-member net, that's just the one line: `(<p1.x> <p1.y>) (<p2.x>
<p2.y>);`). A net needs at least 2 members — if your design has a net with
only one pin on it, drop it rather than emitting an invalid line.

**Interior members need a stub, not a direct join.** Any member that isn't
`p1` or `pk` has two wires meeting exactly at its pin — EAGLE draws the
junction dot pinned to that pin, and a dot pinned to a pin can't be dragged
in the schematic editor afterward (confirmed live: the user hit this while
trying to revise a schematic this way). Fix: for each interior member `pi`
(`1 < i < k`), extend a short 0.1" (2.54mm) stub from its pin, continuing
outward in the same direction the pin's lead already points (away from the
part body — for a pin at local offset `(dx, dy)`, that direction is
`(dx, dy)` normalized), and join the two chain wires at the *far end* of
that stub instead of at the pin:

```
NET '<netname>' (<pi.x> <pi.y>) (<stub.x> <stub.y>);   // the stub itself
NET '<netname>' (<p(i-1).x> <p(i-1).y>) (<stub.x> <stub.y>);
NET '<netname>' (<stub.x> <stub.y>) (<p(i+1).x> <p(i+1).y>);
```

where `stub = pi + 2.54 * normalize(pi's local pin offset)`. Chain multiple
consecutive interior members by joining stub-to-stub instead of stub-to-pin.
Endpoints (`p1`, `pk`) keep connecting directly — only one wire touches
them, so there's no dot-on-a-pin problem there.

## Worked example

Design: a 2-pin header `J1` feeding a 330-ohm resistor `R1` in series with
an LED `D1` to ground — `J1.1` (VCC) to `R1.1`, `R1.2` to `D1.A`, `D1.C` to
`J1.2` (GND). Say the library directory is `/abs/path/lbr` and the YAML
above resolves these three parts to:

- `CONN-2P` (`J1`, library `pinconn`, device `2P/H`): pin `1` at
  `(-2.54, 0)`, pin `2` at `(-2.54, 2.54)`.
- `R` (`R1`, library `r`, device `0204/10`): pin `1` at `(-5.08, 0)`,
  pin `2` at `(5.08, 0)`.
- `LED` (`D1`, library `d`, device `` — empty, so nothing is appended):
  pin `A` at `(0, 5.08)`, pin `C` at `(0, -5.08)`.

Order: `J1` (index 0), `R1` (index 1), `D1` (index 2). Placements:
`J1` → `(0, 0)`, `R1` → `(20, 0)`, `D1` → `(40, 0)`.

Absolute pin coordinates: `J1.1` = `(0 + -2.54, 0 + 0)` = `(-2.54, 0)`;
`J1.2` = `(-2.54, 2.54)`; `R1.1` = `(20 + -5.08, 0)` = `(14.92, 0)`;
`R1.2` = `(20 + 5.08, 0)` = `(25.08, 0)`; `D1.A` = `(40, 5.08)`;
`D1.C` = `(40, -5.08)`.

Output:

```
GRID MM;
SET WIRE_BEND 2;
ADD CONN-2P2P/H@/abs/path/lbr/pinconn.lbr 'J1' R0 (0 0);
ADD R0204/10@/abs/path/lbr/r.lbr 'R1' R0 (20 0);
VALUE R1 330;
ADD LED@/abs/path/lbr/d.lbr 'D1' R0 (40 0);
NET 'VCC' (-2.54 0) (14.92 0);
NET 'LED_NET' (25.08 0) (40 5.08);
NET 'GND' (40 -5.08) (-2.54 2.54);
```

This syntax (device/library first, quoted instance name second, absolute
library paths, device suffix concatenated with no separator, `SET
WIRE_BEND 2` for direct point-to-point wires) has been confirmed to work
against a real EAGLE 7.2.0 install. It still uses a naive single-row
layout at rotation R0 and only places each part's first gate — direct
wiring makes unrelated nets colliding on the same line rare but not
impossible (e.g. two parts placed so their pins end up exactly collinear);
if EAGLE still asks to "merge net segment ... into given net ...", that's
a placement coincidence, not a mistake in your design; answer No and
mention it so the layout can be adjusted. Please open/run the script in
EAGLE and let me know if it reports any other errors.
