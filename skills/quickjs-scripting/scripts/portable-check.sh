#!/bin/sh
# Run one script under every available runtime and compare stdout, stderr and
# the exit status. A script is "portable" when the runtimes agree.
#
#   scripts/portable-check.sh script.mjs [args...]
#   RUNTIMES="qjsm node" scripts/portable-check.sh script.mjs      # a subset
#
# Reference runtime is the first of RUNTIMES (default: qjsm node bun deno).
# Deno gets ../deno-import-map.json so bare names ('fs', 'process', ...) resolve.

here=$(cd "$(dirname "$0")/.." && pwd)
[ $# -ge 1 ] || { echo "usage: $0 script.mjs [args...]" >&2; exit 2; }
script=$1; shift
out=$(mktemp -d) || exit 1
trap 'rm -rf "$out"' EXIT

run() {
  rt=$1; shift
  case $rt in
    deno) deno run -A --import-map="$here/deno-import-map.json" "$script" "$@" ;;
    *)    "$rt" "$script" "$@" ;;
  esac
}

ref=; status=0
for rt in ${RUNTIMES:-qjsm node bun deno}; do
  command -v "$rt" >/dev/null 2>&1 || { echo "skip  $rt (not installed)"; continue; }
  # run() gets the runtime as $1, then the script args
  ( run "$rt" "$@" ) >"$out/$rt.out" 2>"$out/$rt.err"
  echo $? >"$out/$rt.code"
  if [ -z "$ref" ]; then
    ref=$rt; echo "ref   $rt (exit $(cat "$out/$rt.code"))"; continue
  fi
  if cmp -s "$out/$ref.out" "$out/$rt.out" && cmp -s "$out/$ref.code" "$out/$rt.code"; then
    echo "same  $rt (exit $(cat "$out/$rt.code"))"
  else
    status=1
    echo "DIFF  $rt (exit $(cat "$out/$rt.code"), reference $(cat "$out/$ref.code"))"
    diff "$out/$ref.out" "$out/$rt.out" | sed 's/^/        /' | head -20
    [ -s "$out/$rt.err" ] && sed 's/^/  err  /' "$out/$rt.err" | head -5
  fi
done
exit $status
