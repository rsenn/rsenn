#!/bin/bash
# lint.sh - consistency checks for the remote-targets skill.
#  1. every relative markdown link resolves (file and #anchor)
#  2. every knowledge/**/*.md is linked from knowledge/INDEX.md
#  3. every targets.yaml `knowledge:` file exists; every sites.yaml target id exists in targets.yaml
#  4. no site data (IPs, user@host, key paths) in generic files; no secrets anywhere
cd "$(dirname "$0")/.." || exit 2
fail=0
err() { echo "LINT: $*"; fail=1; }

slug() { tr 'A-Z' 'a-z' | sed -e 's/[^a-z0-9 _-]//g' -e 's/ /-/g'; }

# 1. links
linkout=$(while IFS= read -r f; do
  d=$(dirname "$f")
  grep -o '\]([^)]*)' "$f" | sed 's/^](//; s/)$//' | while IFS= read -r l; do
    case "$l" in http*|mailto:*|'') continue;; esac
    p=${l%%#*}; a=
    [ "$p" != "$l" ] && a=${l#*#}
    t="$d/$p"; [ -z "$p" ] && t="$f"
    [ -e "$t" ] || { echo "LINT: $f: dead link $l"; continue; }
    if [ -n "$a" ] && [ -f "$t" ]; then
      grep -E '^#+ ' "$t" | sed 's/^#* *//' | while IFS= read -r h; do printf '%s\n' "$h" | slug; done | grep -qx -- "$a" \
        || echo "LINT: $f: missing anchor $l"
    fi
  done
done < <(find . -name '*.md' | sort))
[ -n "$linkout" ] && { echo "$linkout"; fail=1; }

# 2. unindexed knowledge files
for f in $(find knowledge -name '*.md' ! -name INDEX.md | sed 's|^knowledge/||'); do
  grep -q "($f)" knowledge/INDEX.md || err "not in knowledge/INDEX.md: $f"
done

# 3. yaml cross refs
for k in $(grep -E '^\s+knowledge:\s*' targets.yaml | sed 's/.*knowledge:\s*//'); do
  [ -f "$k" ] || err "targets.yaml: missing $k"
done
ids=$(grep -E '^  [a-z0-9-]+:\s*$' targets.yaml | tr -d ' :')
for t in $(grep -E '^\s+targets:\s*\[' sites.yaml | sed 's/.*\[//; s/\].*//; s/,/ /g'); do
  echo "$ids" | grep -qx "$t" || err "sites.yaml: unknown target '$t'"
done

# 4. leaks (sites.yaml excluded for addresses)
generic="SKILL.md targets.yaml LESSONS.md $(find knowledge -name '*.md')"
grep -nE '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' $generic | grep -vE '\b(127\.0\.0\.1|0\.0\.0\.0|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)' \
  | sed 's/^/LINT: IP in generic file: /' | grep . && fail=1
grep -nE '[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.[a-z]{2,}' $generic | grep -vE 'example\.(com|org|net)|git@github\.com' \
  | sed 's/^/LINT: user@host in generic file: /' | grep . && fail=1
grep -nEi '(password|passwd|token|secret|api[_-]?key)["]?\s*[:=]\s*["]?[^ "$<{(r]' $(find . -name '*.yaml' -o -name '*.md' -o -name '*.sh' | grep -v lint.sh) \
  | grep -viE '(_ref|ask|pass:|env:)' | sed 's/^/LINT: possible secret: /' | grep . && fail=1
grep -rn 'BEGIN [A-Z ]*PRIVATE KEY' . | sed 's/^/LINT: private key: /' | grep . && fail=1

[ $fail = 0 ] && echo "lint ok"
exit $fail
