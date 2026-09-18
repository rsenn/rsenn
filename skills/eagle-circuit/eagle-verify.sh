#!/usr/bin/env bash
# eagle-agent: headless verification of a generated .scr against a real
# EAGLE 7.2.0 install (doc/eagle-agent.md §2c "headless verification").
#
# Runs the script against a fresh (non-existent) target .sch under a
# throwaway Xvfb display, then polls for and auto-dismisses any dialog
# EAGLE pops up (errors, warnings, confirmations), collecting each one's
# text. A clean run - one that ended in no dialogs and produced a saved
# .sch - is the pass signal; any dialog text collected is the fail/warn
# signal. Everything runs in a single shell invocation on purpose: a
# background Xvfb/eagle process does NOT survive past the end of one
# Claude Code Bash tool call, so this can't be split into several
# separate "start" / "poll" / "check" calls.
#
# Usage: eagle-verify.sh <script.scr> [output.sch]
# If output.sch is omitted, a throwaway path under .tmp/ is used and
# discarded. Exits 0 with "PASS" if no dialogs appeared and the .sch was
# written; exits 1 with the collected dialog text otherwise.

set -u
SCR="$1"
SCH="${2:-$(mktemp -u --suffix=.sch)}"
DISPLAY_NUM=":$((90 + RANDOM % 10))"
WORKDIR=$(mktemp -d)
EAGLE_BIN=/opt/eagle-7.2.0/bin/eagle

if [ ! -f "$SCR" ]; then
  echo "FAIL: no such script '$SCR'"
  exit 1
fi

# WRITE + QUIT so a clean run actually saves and exits on its own,
# rather than sitting open waiting for interactive input.
RUN_SCR="$WORKDIR/run.scr"
cp "$SCR" "$RUN_SCR"
echo 'WRITE;' >> "$RUN_SCR"
echo 'QUIT;' >> "$RUN_SCR"

rm -f "$SCH"

Xvfb "$DISPLAY_NUM" -screen 0 1280x900x24 >"$WORKDIR/xvfb.log" 2>&1 &
XVFB_PID=$!
sleep 2

DISPLAY="$DISPLAY_NUM" "$EAGLE_BIN" -N- -S"$RUN_SCR" "$SCH" >"$WORKDIR/eagle.log" 2>&1 &
EAGLE_PID=$!

DIALOGS=""
for i in $(seq 1 90); do
  sleep 1
  if ! kill -0 $EAGLE_PID 2>/dev/null; then
    break
  fi
  # Any window that isn't the Control Panel or a Schematic/Board editor
  # is a dialog (Error/Warning/confirmation) - grab its text via `find`
  # (claude-in-chrome-style: window class heuristics aren't reliable
  # here, so this greps every non-editor window's name/text via xdotool).
  WIN_IDS=$(DISPLAY="$DISPLAY_NUM" xdotool search --name "." 2>/dev/null)
  for id in $WIN_IDS; do
    NAME=$(DISPLAY="$DISPLAY_NUM" xdotool getwindowname "$id" 2>/dev/null)
    case "$NAME" in
      *"Control Panel"*|*"Schematic"*|*"Board"*|*"Library"*) continue ;;
      "") continue ;;
    esac
    # Known-benign environment artifact, not a netlist/script problem:
    # this exact "Overwrite project file 'eagle.epf' from different
    # version of EAGLE?" Warning fires on every single invocation of this
    # EAGLE install regardless of script content (confirmed: reproduces
    # even on a bare "QUIT;" script) - it's this install wanting to
    # rewrite the CWD's project settings file, unrelated to whichever
    # .scr is being verified. Dialog titles carry no message text (both
    # this and a real "Merge net segment" Warning are just titled
    # "Warning"), so this fixed-text dialog is told apart by its window
    # geometry instead, which is constant for fixed dialog text: 492x88,
    # confirmed via `xprop` against a live install. Only this exact
    # (name, geometry) pair is allow-listed - any other Warning
    # (including a real Merge-segment prompt, which has different text
    # and therefore a different size) still falls through to the normal
    # screenshot+FAIL path below untouched.
    if [ "$NAME" = "Warning" ]; then
      GEOM=$(DISPLAY="$DISPLAY_NUM" xdotool getwindowgeometry --shell "$id" 2>/dev/null | grep -E '^(WIDTH|HEIGHT)=' | cut -d= -f2 | tr '\n' 'x')
      if [ "$GEOM" = "492x88x" ]; then
        DISPLAY="$DISPLAY_NUM" xdotool windowfocus --sync "$id" 2>/dev/null
        DISPLAY="$DISPLAY_NUM" xdotool key --window "$id" Escape 2>/dev/null
        continue
      fi
    fi
    # Found a dialog - screenshot it so a human/LLM can read the exact
    # message, then dismiss it with Escape, NOT Return. Confirmed against
    # a live install: Return activates the LEFTMOST button, which for a
    # "Merge net segment ... into given net ...?" prompt is "Yes" -
    # silently shorting two different nets together (real netlist
    # corruption, not a safe default). Escape reliably closes a plain
    # OK/Cancel error dialog too (alt+n does not - it has no effect on a
    # dialog with no "No" button, leaving it stuck looping this script
    # until timeout). IMPORTANT: even Escape is NOT a "safe answer" to a
    # Merge-segment prompt - for that specific dialog it appears to make
    # EAGLE just not draw the new wire segment (same effect as an
    # explicit "No" click), which means a real connection silently goes
    # missing rather than being drawn. A genuine "Merge net segment" FAIL
    # from this script always means the .scr's coordinates need to change
    # (reroute via a waypoint, per eagle-materialize.js's resolveMember())
    # so the wires never touch in the first place - never re-run assuming
    # Escape "handled" it.
    SHOT="$WORKDIR/dialog-$i.png"
    DISPLAY="$DISPLAY_NUM" import -window "$id" "$SHOT" 2>/dev/null
    DIALOGS="$DIALOGS\n[$NAME] screenshot: $SHOT"
    DISPLAY="$DISPLAY_NUM" xdotool windowfocus --sync "$id" 2>/dev/null
    DISPLAY="$DISPLAY_NUM" xdotool key --window "$id" Escape 2>/dev/null
  done
done

kill -9 $EAGLE_PID $XVFB_PID 2>/dev/null

if [ -n "$DIALOGS" ]; then
  echo "FAIL: EAGLE raised dialog(s) while running '$SCR':"
  echo -e "$DIALOGS"
  echo "(each screenshot must be viewed to read the actual message - this script cannot OCR them)"
  exit 1
fi

if [ -f "$SCH" ]; then
  echo "PASS: '$SCR' ran to completion with no dialogs, wrote '$SCH'"
  exit 0
else
  echo "FAIL: '$SCR' produced no dialogs but also never wrote '$SCH' (timed out or crashed - check $WORKDIR/eagle.log)"
  exit 1
fi
