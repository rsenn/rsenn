---
name: eagle-circuit
description: Design a simple circuit (breakouts, harnesses, PIC16/18-based boards) and emit an EAGLE .scr script that places and wires the parts. Use when asked to design a circuit/schematic/wiring for EAGLE, or to turn a circuit idea into something EAGLE can load.
---

# EAGLE circuit design

This is a global skill — it works the same from any project directory
(`an-tronics`, `pictest`, `lc-meter`, or elsewhere), not just `plot-cv`.
All paths below are absolute for that reason; the `.tmp/<name>...` scratch
paths are the one exception, and are relative to *whatever project you're
currently working in* (per that project's own `.tmp/` convention), not to
this skill's own location.

Fixed locations this skill depends on:
- Scripts: `eagle-lookup.js`, `eagle-materialize.js`, `eagle-extract.js`,
  `eagle-tool.js`, `eagle-dematerialize.js` — **installed system-wide**
  (`/usr/local/bin`, via `plot-cv`'s `CMakeLists.txt` / `cmake --install`)
  and on `PATH`, so invoke them by bare name (`eagle-tool.js ...`) from
  any directory — no need to `cd` into `plot-cv` or give an absolute
  script path. Each resolves its own library path from a fixed absolute
  constant (`LIB_DIR` in the script, currently `/mnt/data/Projects/
  pictest/eagle/lbr`), not from the script's own install location or the
  caller's cwd — this was a real bug once (a relative `../pictest/...`
  derivation broke the moment these were installed outside the source
  tree) and must stay a fixed absolute path if it's ever touched again.
  If a script fails with "no such file" for something under `bin`, the
  install is stale — rebuild/reinstall from `plot-cv`'s configured build
  dir (`cmake --install build/<preset>`) before assuming a script bug.
- Library data: `/mnt/data/Projects/pictest/eagle/lbr/*.lbr` (the scripts
  above already know this path; you don't need to pass it).
- Background/open questions: `/mnt/data/Projects/plot-cv/doc/eagle-agent.md`.
- This skill's own colocated files: `scr-rules.md`, `rlc-cpol.yaml`,
  `eagle-verify.sh` (same directory as this file) — the first two are used
  by the copy-paste path (§B below), the last by §A's verification step.

Two ways to get a `.scr` out of this skill, sharing the same first two
steps — pick §A if you're running in Claude Code (or any harness with
shell access) right now; pick §B if the target is a plain-text LLM chat
with no tool access (e.g. Google Gemini's web UI) that the user will
copy-paste into themselves.

## Step 0.0 (optional, both paths, before Step 0): importing an existing design

Skip this unless the user hands you a *reference design to reproduce* —
a datasheet circuit, a manufacturer application note, a hobbyist/forum-
published schematic, a magazine/website project — rather than describing
a circuit from scratch. There is no machine-parseable netlist behind any
of these sources (they're images, PDFs, and prose), so this is **not** a
deterministic importer/parser — it's you, the agent, reading the source
material yourself and producing the same design understanding Step 0
needs, just sourced from a document instead of the user's description.

1. **Locate the source.** If the user gives a URL or file, fetch/read it
   directly (`WebFetch` for a web page; `Read` with the `pages` parameter
   for a PDF — up to 20 pages per call, so a long datasheet/app-note needs
   several calls). If the user only names a subject (e.g. "the Thomas
   Henry VC crossfader"), find it with the `search` CLI:
   ```
   . ~/.keys; /usr/local/bin/search -n 20 'thomas henry voltage controlled +crossfader'
   ```
   `search` is a `qjsm` script at `/usr/local/bin/search` wrapping
   SerpApi's Google search; it needs `SERP_API_KEY`, which is why
   `~/.keys` (an `export FOO_API_KEY=...` shell script) must be sourced
   first — the leading `.` isn't optional. Useful flags: `-n <limit>`
   (result count), `--plain` (links only), `--json` (raw results). A
   single circuit is often scattered across several sources of different
   kinds (a forum thread with the schematic image, a PDF construction
   article, a Stack Exchange answer analyzing the topology) — check more
   than the first hit before settling on one.
2. **Save fetched source assets** under `.tmp/<name>.ref/` in the
   *current* project (e.g. `.tmp/th-crossfader.ref/schematic.pdf`) — no
   prior convention existed for this before now, so this is the pattern
   to follow going forward, parallel to this skill's existing
   `.tmp/<name>.circuit.json` naming.
3. **Read the schematic yourself.** For an image (scanned/drawn
   schematic, forum attachment), read it directly — you're multimodal,
   this doesn't need OCR tooling. For a PDF, read the real page range
   containing the schematic/parts list/pin table, not just the abstract.
   Extract: the part list (generic descriptions — "dual OTA", "quad op-
   amp", not yet a real library deviceset), and the topology (which pins
   connect to which nets). Cross-reference multiple sources if you have
   them (a schematic image plus a forum reply correcting an error in it,
   or a datasheet's own application-circuit figure) rather than trusting
   a single blurry scan.
4. **Produce Step 0's ASCII art from what you read**, explicitly labeled
   as reconstructed from the source (e.g. "from the PDF's Figure 2") —
   this is the review checkpoint that catches a misread pin or a
   transcription error before it propagates into a real netlist. Don't
   skip Step 0 just because the design "already exists" — reading a
   schematic wrong is exactly as costly here as designing one wrong.
5. **Citing the source is optional, judgment call per import** — not a
   hard requirement of this workflow. When you do want to record it (a
   design you'll likely revisit, or one with a real risk of misattribu-
   tion), put it in `circuit.json`'s `project.references` (see Step 1
   below) rather than only in chat, so it survives into the file.
   **Watch for an explicit distribution restriction on the source
   material itself** (confirmed in the wild: a fonitronik.de PDF marked
   "Private use only. Do not copy and/or distribute by any means.") —
   that restricts the source document/image, not the underlying circuit
   facts (values, topology aren't copyrightable), so extracting those
   into your own netlist for personal use is fine; just don't save,
   embed, or reproduce the source schematic image/PDF itself anywhere
   that isn't private local storage (`.tmp/` is fine, a shared/published
   artifact is not).
6. Continue into Step 0 (if not already covered by step 4 above), Step
   0.5, and Step 1 exactly as for a from-scratch design — nothing
   downstream needs to know a design was imported rather than invented.

## Step 0 (always, both paths): review the design as ASCII art first

Before touching any part names or writing anything to disk, sketch the
circuit as ASCII art and show it to the user — parts, rough layout, which
pins connect to which nets, in plain text. Get it approved (or revised)
before spending effort on exact part/pin lookups. This is cheap and catches
design mistakes early; skipping it isn't a shortcut, it's how wasted work
happens later.

## Step 0.5 (always, both paths): plan harnesses on the controller side

Before assigning pins, work out which of the design's signals leave the
controller (MCU, eval-board, or bare IC) together over one physical
multi-conductor interconnect — a ribbon cable, a pin-header breakout, a
female header pushed onto a run of the controller's own pins. This
skill calls that grouping a **harness**, and it's a specific, narrower
thing than the generic EDA notion of a "bus":

- A generic EDA bus is just a *named set* of signals, useful in a
  schematic editor purely to declutter drawing — you throw signals in
  and pull them back out in any order, at any position, since the
  editor doesn't care about order at all. This skill has no drawing-
  clutter problem to solve (`eagle-materialize.js` wires everything
  point-to-point), so that notion doesn't apply here.
- A **harness**, here, is always anchored to the **controller side** —
  never to the destination peripheral (an LCD module, a MIDI DIN
  socket, an LED board). The destination's own pinout is already fully
  described by the netlist's `parts`/`nets` — a harness doesn't repeat
  it. The reasoning: a harness models a real, physical connector you'd
  plug a multi-pin female header into, and that connector always lives
  on the controller/eval-board part, because an intermediate component
  (a pull-up diode, a level shifter) can freely reorder which signal
  reaches the *other* end — so pin order is only meaningful relative to
  one specific side, and that side is the controller's.
- The atomic unit inside a harness is a **pin-run**: an ordered,
  contiguous sequence of pin numbers on ONE connector/gate of the
  controller part. Every pin in a run gets a slot even when it carries
  no signal today — a reserved, unimplemented, or tied-off conductor is
  still a real wire in the physical cable, so mark it with a note
  instead of omitting it.
- A harness is **one or more pin-runs bundled together into a single
  physical interconnect** — not always just one contiguous range. E.g.
  a MIDI harness might tie RC6/RC7 on one header together with RB4-RB7
  on a different header, if one physical cable/breakout genuinely
  carries both. Contiguity is required *within* each run, never
  *across* separate runs of the same harness.
- This generalizes to any controller, not just a specific board: the
  harness's `connector.part` is whichever `parts` entry represents the
  controller/eval-board/IC side of the design (a picstick's two 14-pin
  headers, a bare DIP-28 broken to a header, some other eval board's
  pin block) — the rule is purely structural ("is this a contiguous pin
  range on the controller-facing connector"), never hardcoded to a
  particular part name.
- Not every group of related signals qualifies. If the signals a
  peripheral needs land on scattered, non-adjacent controller pins
  (e.g. because a couple of them need specific PWM-capable pins), that
  group isn't physically routed together over one cable — it's just
  several independent GPIO wires, and shouldn't be declared as a
  harness even if they're conceptually related (e.g. "all the RGB LED
  pins"). Forcing it would just misdescribe the hardware; leave it out.

Once the harnesses are worked out, record them in `circuit.json` (see
Step 1's `"buses"` field below) before or alongside picking exact pins,
the same way Step 0's ASCII art gets agreed before exact part/pin
lookups.

## Step 1 (always, both paths): look up real parts before referencing them

**Never invent a deviceset or pin name.** This library set has real gaps
(some device families are huge, some parts have no useful description),
so look things up live instead of relying on memorized/approximate names:

`eagle-lookup.js '<pattern>'` — searches deviceset names (regex, case-
insensitive) across all libraries and prints each match's library file,
gates, real pin names + directions, and device list. Narrow with
`-l <library>.lbr` if you already know which file. Run this for every
part you're considering — copy pin names *exactly* as printed (e.g.
`RA0/AN0`, not `RA0`; `RB7/KBI3/PGD`, not `RB7`).

**Analog designs (op-amps, OTAs, CMOS logic, RF) must use the an-tronics
library set, not the default one.** `eagle-lookup.js`/`eagle-materialize.js`/
`eagle-extract.js` all default to `/mnt/data/Projects/pictest/eagle/lbr`
(PIC/digital-board-oriented — connectors, MCUs, the picstick headers).
For anything analog, pass `--lib-dir /mnt/data/Projects/an-tronics/eagle/lbr`
to every one of those commands instead — that's where the op-amps
(`TL07x`, etc.), OTAs (`LM13700`), CMOS logic, and RF parts actually live;
the default library set doesn't have them at all. The curated R/L/C/CPOL
default devices (below) exist identically in both library sets, so no
extra care is needed there. This applies to the whole session once a
design is analog — don't mix libraries mid-circuit without a reason.

For resistors/capacitors/inductors/electrolytics, use deviceset `R`,
`R-H`, `L`, `C`, or `CPOL` — device/package selection is handled for you
(§A: `eagle-materialize.js`'s `CURATED_DEVICE` table; §B: already baked
into `rlc-cpol.yaml`); don't try to pick a specific package. For every
other deviceset, also don't specify a device/package — only the deviceset
name is needed.

**Power/ground nets: terminate each pin locally with a `VCC`/`GND` flag
symbol instead of one long multi-member net.** `pad.lbr` has two
distinct kinds of power part, easy to confuse — pick by whether a real
physical connector belongs on the finished board/harness:
- **`VCC` / `GND`** (also `+12V`/`-12V` etc for other rails) — bare
  schematic power-flag symbols, single gate, `""`-named device with **no
  package/footprint at all**. This is the default, everyday mechanism:
  place one next to every pin that needs that rail (a part's `VDD`/`VCC`
  pin, an LED's cathode to ground, a pull-up's top end, ...) and net just
  that one pin to its own local flag symbol (`"NET_NAME": ["U1.VCC",
  "VCC_U1.VCC"]`, 2 members, a short local wire) — never one big net
  spanning the whole sheet to every consumer. EAGLE merges every
  identically-named supply pin (`VCC` with `VCC`, `GND` with `GND`)
  into one real electrical net globally, with no drawn wire between
  separate instances — this is what actually saves the long
  criss-crossing wires `eagle-materialize.js`'s point-to-point wiring
  would otherwise draw for a many-member power net, and it's what makes
  the result comfortable to rearrange by hand afterward (each power flag
  moves independently with its own part instead of dragging a wire that
  spans the whole sheet). Applies whether the design is a cable harness
  or a real PCB — this is a schematic-clarity mechanism, not a PCB-only
  one. **Don't use the `+5V` deviceset** — confirmed live (2026-09-02):
  its own pin is actually named `+12V` internally (a copy-paste bug in
  the library, not a `+5V`-named supply pin at all), so it would silently
  join a `+12V` net instead. Use `VCC` for a design's positive rail
  regardless of its actual voltage (5V, 3.3V, whatever) — supply-net
  identity is purely by pin name, not by the symbol's cosmetic label or
  the rail's real voltage.
- **`VCC_GND`** (2 gates VCC+GND, one real 2-pin 2.54mm-header package)
  and its bipolar sibling **`VCC_GND_VEE`** (an-tronics library set only,
  3 gates VCC+GND+VEE, prefix `PWR`) — a REAL physical part with a real
  footprint, for the specific case where the design genuinely needs a
  physical power-input connector on the finished board/harness (e.g. an
  external power injection point) — not the general power-distribution
  mechanism. Using it for routine internal VCC/GND taps would add a
  spurious 2-pin header to the BOM at every single tap point.

  **`eagle-verify.sh` will report FAIL on a correctly-built power-symbol
  design — this is a known verify-script gap, not a sign the `.scr` is
  wrong.** Once 2+ separate JSON nets each touch a same-named supply pin
  (e.g. two different `GND` flags), EAGLE raises exactly the "Merge net
  segment 'GND' into given net '...'?" Warning §A step 3 already
  documents — except here it's *intentional*: accepting it (Yes) is
  what actually joins the flags into one real net, the entire point of
  this convention. `eagle-verify.sh` can't tell this apart from a real
  accidental-touch coincidence (it can't read dialog body text, only a
  screenshot a human/LLM must view — see its own header comment) and
  always dismisses every Merge prompt with Escape, by deliberate design
  for the general (non-supply) case — so it'll surface this expected
  dialog as a FAIL and, per that same Escape behavior, the merge won't
  actually have happened in the throwaway `.sch` it was checking. Don't
  read that FAIL as "the netlist is broken"; a segment name that's a bare
  supply-net name (`GND`, `VCC`, `VEE`, `+12V`, ...) merging into another
  net is exactly what's supposed to happen. Confirm by hand instead: open
  the `.scr` interactively in real EAGLE and click **Yes** on each such
  prompt (never automate this — the script's Escape-by-default is still
  the right call for every other, non-supply Merge prompt, which really
  does mean a coincidental wire-crossing bug to fix, not accept).

**Never let a flag-symbol wire land its junction directly on a pin, and
never route one across a part's own symbol body** (2026-09-02 rule,
confirmed via a real design mistake — see below):
- A junction dot pinned directly to a component pin can't be dragged
  independently in the schematic editor afterward — the same reason §A
  step 1 already stubs out 3+-member net interior points by 0.1" (2.54mm).
  The same discipline applies when *you* place a `VCC`/`GND` flag by hand:
  compute the target pin's real absolute position (host part's placement
  + the library symbol's local pin offset, transformed through the part's
  own rotation/mirror), then place the flag so its own symbol's pin lands
  a further 2.54mm **outward** from that point — never exactly on top of
  it.
- **When a part has multiple VCC (or multiple GND) pins that aren't all
  on the same physical side of its symbol, give each side its own
  separate flag** — never route one shared wire across/through the
  symbol's body to reach a flag placed near the opposite side. Determine
  "which side" from the symbol's own local pin coordinates (e.g. a pin at
  local `x<0` is the left side, `x>0` the right), not from guessing.
- Concretely, this was caught on `HCPL2730`'s gate A (`o.lbr`, symbol
  `2730`): `VCC`/`GND` both sit on the pin-local `x=+15.24` (right) side,
  opposite `A1`/`C1` at `x=-15.24` (left). A first-pass flag placement put
  `GND`'s flag at the symbol's *left* edge (`A1`/`C1`'s side) and `VCC`'s
  flag essentially exactly on top of its own real pin — the GND wire would
  have crossed straight through the IC's own drawn body to reach it, and
  the VCC junction would have been pinned to the pin itself. Both are the
  exact defects this rule exists to prevent; fixed by moving each flag to
  its pin's own side, offset 2.54mm further outward, in `src/
  miditest2.circuit.json` (see that file's `GND_U1`/`VCC_U1` parts and
  `pictest`'s own project notes for the corrected coordinates).
- This matters most for IC/module symbols with real drawn body outlines
  (opto-isolators, op-amps, MCUs) — a simple 2-pin passive (`R`, `C`,
  `D`) has no body to cross, so the outward-stub rule alone (no per-side
  split) is enough there.

For a PIC16/18-based design, also check for a board-level doc like
`/mnt/data/Projects/pictest/picstick.md` if the target names a specific
existing board (e.g. don't reuse a pin that board doc says is already
committed to an onboard LED or reset circuit) — other boards may have
their own such doc as they're designed; look for one before assuming a
bare MCU's pinout is unconstrained.

---

## §A. In Claude Code (or any harness with shell access): generate directly

1. **Write the netlist** as JSON to `.tmp/<name>.circuit.json` (in the
   *current* project, not this skill's directory):

   ```json
   {
     "parts": {
       "U1": { "library": "mcu", "deviceset": "PIC18F2550-I/SP" },
       "R1": { "library": "r", "deviceset": "R" },
       "J1": { "library": "pinconn", "deviceset": "CONN-2P" }
     },
     "nets": {
       "VCC": ["U1.VDD", "R1.1", "J1.1"],
       "GND": ["U1.VSS", "J1.2"]
     }
   }
   ```

   - `library` is the `.lbr` basename without extension.
   - Net members are `"<part-ref>.<pin-name>"`; a net needs 2+ members.
   - `eagle-materialize.js` wires nets as direct point-to-point lines
     (`SET WIRE_BEND 2`), not routed horizontal/vertical paths — so only
     part *placement* matters, not the space wires will take. Don't try
     to plan wire routing or add routing waypoints. The one thing worth
     doing deliberately: give two parts the same `x` (or `y`) when they
     should read as a clean vertical (or horizontal) connection in the
     schematic — e.g. a resistor stacked directly above the LED it
     drives — since two aligned pins draw a straight line either way.
   - A part can be rotated/mirrored with `"rot": "R90"/"R180"/"R270"/
     "MR0"/"MR90"/"MR180"/"MR270"` (default `"R0"`); a multi-gate part
     uses `"gates": {"<gate-name>": {"x", "y", "rot"?}}` instead of a
     flat `x`/`y`, and its net members are gate-qualified:
     `"<part-ref>.<gate-name>.<pin-name>"`.
   - For a net with 3+ members, `eagle-materialize.js` automatically stubs
     out every interior member (all but the first and last) with a short
     0.1" wire before joining the other two wires there, instead of at the
     pin itself — a junction dot pinned directly to a component pin can't
     be dragged in the schematic editor afterward. Nothing to do here; it's
     handled for you regardless of net member order.
   - `eagle-materialize.js` also auto-nudges each part's given `x`/`y` (in
     0.01mm steps) so every one of its pins' ABSOLUTE positions lands
     exactly on the 2.54mm sheet grid — some real library symbols (e.g. the
     NOKIA-5510 LCD module) have pins offset on the finer 1.27mm half-grid
     relative to the part's own origin, so hitting the full grid on every
     pin sometimes means the part's own origin has to sit off the full
     grid. This is expected, not a bug — what matters is pins/wires, not
     the origin dot. Give `x`/`y` as multiples of 2.54 regardless; the tool
     corrects the rest and prints a `NOTE:` line whenever it nudges a part.
   - Record the harnesses worked out in Step 0.5 in a top-level `"buses"`
     object (the field is named `buses` for brevity, but each entry is a
     harness in the Step 0.5 sense — one or more controller-side pin-runs
     bundled into one physical interconnect). This is **metadata only**:
     it never produces an EAGLE `BUS` object or changes wiring/placement —
     it's purely for validation and for generating harness/pinout docs
     later. Shape:
     ```json
     "buses": {
       "LCD": {
         "description": "SPI + control lines to the LCD module, broken out on a female header",
         "runs": [
           {
             "connector": { "part": "JP", "gate": "G$2" },
             "pins": [
               { "pin": 5, "net": "RESET_PIC" },
               { "pin": 6, "net": "DATA_PIC" },
               { "pin": 7, "note": "SCE - tied to GND, not routed to a GPIO" },
               { "pin": 8, "net": "CLK_PIC" },
               { "pin": 9, "net": "DC_PIC" }
             ]
           }
         ]
       },
       "MIDI": {
         "description": "MIDI RX (hardware EUSART) plus a 2nd, software MIDI input over the opto's 2nd channel",
         "runs": [
           {
             "connector": { "part": "JP", "gate": "G$1" },
             "pins": [
               { "pin": 10, "net": "MIDI_RX", "note": "RC7/RX - hardware EUSART RX" },
               { "pin": 11, "note": "RC6/TX - reserved, MIDI TX unimplemented" }
             ]
           },
           {
             "connector": { "part": "JP", "gate": "G$2" },
             "pins": [
               { "pin": 2, "note": "RB7 - reserved for future soft-serial MIDI input" }
             ]
           }
         ]
       }
     }
     ```
     Each run's `pins` is ordered to match the real physical pin order at
     its own `connector` (omit `gate` for a single-gate part) — contiguity
     is required *within* a run, never *across* a harness's separate runs.
     A pin with no `net` (reserved, unimplemented, or tied off rather than
     routed to a GPIO) still gets a slot, with a `note` instead — the run
     stays a true picture of the physical cable even where a conductor
     carries no signal yet. Not every related signal group is a harness —
     see Step 0.5 for when to leave one out rather than force it.
   - An optional top-level `"project"` object carries everything that
     isn't the netlist itself: what the circuit is for, where it came
     from, and how its parts group into real-world modules. Nothing reads
     this programmatically today (`eagle-materialize.js` ignores unknown
     top-level keys) — it exists for a human or a future agent picking
     this design back up, per-part `"description"` fields (a one-line
     note on a part's *role in this circuit*, not what it generically is),
     and Step 0.0's optional source citations. Shape:
     ```json
     "project": {
       "name": "miditest",
       "description": "one paragraph: what this circuit is and what it's for",
       "references": [
         { "doc": "src/miditest.md", "role": "full design doc" },
         { "doc": "https://example.com/original-schematic", "role": "imported from, see Step 0.0" }
       ],
       "power_budget": {
         "5V": { "source": "USB VBUS", "budget_mA": null, "notes": "..." }
       },
       "connectors": [
         { "ref": "JP", "role": "controller header - this design's MCU-side connector" }
       ],
       "module_boundaries": [
         { "name": "LCD module", "parts": ["LCD1", "D_RESET", "..."], "harness": "LCD" }
       ]
     }
     ```
     None of these sub-fields are required or validated — include only
     what's actually known; `null`/omitted is fine for an open question
     (e.g. an unmeasured `budget_mA`) rather than guessing a number.

2. **Materialize it**:
   `qjsm /mnt/data/Projects/plot-cv/eagle-materialize.js
   .tmp/<name>.circuit.json -o .tmp/<name>.scr`
   (add `--lib-dir /mnt/data/Projects/an-tronics/eagle/lbr` for an analog
   design — same flag as Step 1's `eagle-lookup.js`, must match whichever
   library set the parts were looked up in)

   On failure it names exactly what's wrong (unknown deviceset — with real
   suggestions from that library; unknown pin — with the real pin list) —
   fix the netlist using `eagle-lookup.js` again and retry. This is a loop,
   not one-shot generation.

3. **Verify it against a real EAGLE install before handing it to the
   user**: `bash /home/roman/.claude/skills/eagle-circuit/eagle-verify.sh
   .tmp/<name>.scr` — runs the script headlessly (Xvfb + the real EAGLE
   7.2.0 binary at `/opt/eagle-7.2.0/bin/eagle`), auto-dismisses any
   dialog it raises, and prints `PASS` or `FAIL` with a screenshot path
   for every dialog encountered. **View each screenshot** (the harness
   can't read the dialog text itself) before deciding what it means:
   - An *Error* dialog (e.g. "Device not found") is a real script bug —
     fix `eagle-materialize.js`'s SCR-emission code (or the netlist) and
     retry. Don't hand a script that raised an Error dialog to the user.
   - A "Merge net segment ... into given net ...?" *Warning* means two
     different nets' wires geometrically touch somewhere other than a
     shared pin — with direct point-to-point wiring (`SET WIRE_BEND 2`)
     this is uncommon, so it's usually either a genuine placement
     coincidence (two parts landed so their pins are exactly collinear —
     nudge one part's `x`/`y`) or, as with `ZD1_GND`/`GND` in the
     picstick harness session, a real modeling redundancy: two
     differently-named nets that both legitimately terminate on the same
     pin should just be one net. Either way, dismiss with **Escape/No**,
     never Yes (Yes silently shorts the two nets together — confirmed
     against a live install) — Escape/No doesn't "fix" it either, it just
     drops the new wire segment, so the underlying netlist still needs
     the actual fix before handing the script off.
   This step needs a real EAGLE license/install at that fixed path and a
   working X stack (`Xvfb`, `xdotool`, `import` from ImageMagick) — if any
   of those are missing, say so and fall back to the old behavior: report
   the `.scr` path with the caveat that it's untested, and ask the user to
   open/run it in EAGLE themselves and report back any errors.
4. **Report the `.scr` path to the user** once it passes verification (or,
   per the fallback above, along with the "untested" caveat).

### A.1 Carrying hand-tuned layout forward when the netlist changes

If the user has since opened a previously-generated `.scr` in real EAGLE
and hand-fine-tuned part positions there (common — `eagle-materialize.js`'s
own placement is a starting point, not a final layout), regenerating the
`.scr` from an updated `circuit.json` starts back from that naive
placement and loses the hand-tuning. Two ways to carry it forward instead
of redoing the layout from scratch, both from `eagle-tool.js`:

**Preferred — bake the old positions directly into the regenerated `.scr`**
(fewer commands, sidesteps the by-name-MOVE-on-a-multi-gate-part quirk
entirely since it never needs a MOVE at all):

`qjsm /mnt/data/Projects/plot-cv/eagle-tool.js positions
<old-hand-tuned.sch> | qjsm /mnt/data/Projects/plot-cv/eagle-materialize.js
.tmp/<name>.circuit.json --positions - -o .tmp/<name>.scr`

`positions` dumps every part's x/y/rot (or a gate-name-keyed map, for a
multi-gate part) as JSON, in exactly `circuit.json`'s own part-spec shape;
`eagle-materialize.js --positions -` reads that from stdin and overrides
each matching part's placement before emitting ADD/INVOKE — so the
regenerated `.scr` places parts at the old positions on the very first
pass. Reports (to stderr-equivalent console output, not into the `.scr`)
any part only on one side — removed, or genuinely new with nothing to
restore.

**Alternative — a follow-up MOVE+ROTATE script**, useful when you want to
apply an old layout to a `.sch` that's already been materialized/opened
rather than regenerating it fresh:

`qjsm /mnt/data/Projects/plot-cv/eagle-tool.js sch-from-sch
<old-hand-tuned.sch> <already-generated.sch> -o .tmp/<name>.restore.scr`

— run this one against the target `.sch` the same way as
`eagle-verify.sh` step 3.

**Either way, carrying old positions forward does not re-solve routing**:
if the netlist change also moved which pins a net connects to (not just
which parts exist), the restored layout can still have new wire/body
crossings — or even a live "Merge net segment" dialog — that didn't exist
before (confirmed live: restoring a real old layout this way surfaced
exactly this). Re-run `check-body-crossings.js` (§A step 3's crossing
checker) after applying either kind of restore, same as after any other
layout change.

`eagle-tool.js` also has `board-from-schematic`, `board-from-board`, and
`snap-grid` (default 1.27mm half-grid) subcommands for the equivalent
board-side and grid-cleanup cases, plus three standalone checks useful
after generating or hand-editing a `.sch`:

- `diff-parts <a> <b>` — part/element names only in `a`, only in `b`, and
  common to both (either file can be a `.sch` or `.brd`). Good sanity
  check after a netlist change, before spending time on layout: confirms
  exactly which parts actually changed.
- `bom <file.sch>` — a table of every real part's name/deviceset/device/
  value, straight from the `.sch` — catches a wrong device pick or a
  value that didn't make it in, without eyeballing raw XML.
- `render <file.sch|.brd> --pdf <output.pdf> [-o out.scr]` — emits an
  EAGLE `PRINT` script that renders the file to a real PDF. **Run it by
  opening the target file directly** (`eagle -N- -S<script>
  <file>.sch`/`.brd`) — never through `eagle-verify.sh`, which deletes
  its target first (correct for verifying a *fresh* `.scr`'s output,
  wrong for rendering something already populated you don't want
  touched). Useful for actually showing the user what a generated
  schematic looks like, rather than just handing over the `.scr` text.
- `buses <circuit.json> [<harness-name>] [--validate]` — print the
  `"buses"` metadata (see Step 0.5/Step 1 above) as per-run pin/net/note
  tables, one harness or all of them. `--validate` checks each run is a
  contiguous pin range (no gaps, no duplicates within that run) and
  cross-checks every pin's claimed `net` really has that pin as a member
  in the netlist's own `nets` section — catches harness documentation
  drifting out of sync with the actual netlist (e.g. after a pin got
  renumbered) rather than silently trusting stale documentation.

Run `qjsm eagle-tool.js` with no arguments for the full command reference.

## §B. For a plain-text LLM with no tool access (e.g. Gemini web): assemble a copy-paste prompt

Use this when the user wants to hand the design off to a different LLM
that can't run these scripts itself — the goal is one self-contained text
block they can paste there directly.

1. **Extract YAML for every non-R/L/C/CPOL part** the design needs:
   `qjsm /mnt/data/Projects/plot-cv/eagle-extract.js <library>:<deviceset>
   ...` (space-separated pairs, e.g. `mcu:PIC18F2550-I/SP pinconn:CONN-2P`)
   — prints YAML in exactly the shape `scr-rules.md` expects. Add
   `--lib-dir /mnt/data/Projects/an-tronics/eagle/lbr` for an analog design
   (see Step 1's note).

2. **Assemble the final prompt**: read `scr-rules.md` (this skill's
   directory) and `rlc-cpol.yaml` (same directory, the constant R/L/C/CPOL
   set), substitute them into `scr-rules.md`'s three `<!-- ... -->` markers
   (`LIB_DIR` ← the absolute library directory,
   `/mnt/data/Projects/pictest/eagle/lbr`; `CURATED_RLC_CPOL_YAML` ←
   `rlc-cpol.yaml`'s contents; `CIRCUIT_SPECIFIC_YAML` ← step 1's output),
   and write the result to `.tmp/<name>.prompt.md` in the *current*
   project. The approved ASCII art and wiring from Step 0 don't need
   separate substitution — `scr-rules.md` already tells the receiving LLM
   it already knows the design from conversation context, so paste the
   design context alongside this prompt too (or restate it briefly at the
   top) when handing it off.

3. **Give the user the assembled file** to copy into Gemini (or wherever).
   **There's no retry loop on that end** — unlike §A, nothing here checks
   the receiving LLM's output against real data, so state that plainly:
   the human loading the result into EAGLE is the only checkpoint, unless
   they paste the `.scr` Gemini produced back into this conversation — if
   they do, save it to `.tmp/<name>.scr` and run it through
   `eagle-verify.sh` exactly as in §A step 3 before telling them it's good.
