#!/bin/bash
# cmake-sync.sh - keep the shared cmake files of the qjs-* projects in step.
#
#   cmake-sync.sh status                         one row per file, one column per project
#   cmake-sync.sh diff  <project> <file>         canonical -> project, token level
#   cmake-sync.sh apply <project|all> <file>... [--force]
#                                                copy the canonical file into the project(s)
#   cmake-sync.sh adopt <project> <file>         make the project's copy the canonical one
#
# Canonical copies: ../cmake/ in this skill, scope per file: ../cmake/MANIFEST.
# Projects: $QJS_ROOT/qjs-* (default ~/Sources/quickjs).
#
# status marks:  =  identical    ~  same except whitespace    !  differs    -  missing
#                .  not in scope  ?  no canonical copy yet (copies are grouped instead)
#
# apply never commits, never touches a copy with uncommitted changes and never replaces
# a copy marked ! without --force (read `diff` first).

set -u
here=$(cd "$(dirname "$0")/.." && pwd)
canon=$here/cmake
root=${QJS_ROOT:-$HOME/Sources/quickjs}

die() { echo "cmake-sync: $*" >&2; exit 1; }
norm() { tr -d ' \t\n\r' <"$1" | md5sum | cut -c1-8; }

projects() { for d in "$root"/qjs-*/; do [ -d "$d/cmake" ] && basename "$d"; done; }

manifest() { grep -vE '^\s*(#|$)' "$canon/MANIFEST"; }

in_scope() { # file project
  local scope; scope=$(manifest | awk -v f="$1" '$1==f { $1=""; print }')
  [ -n "$scope" ] || return 1
  case " $scope " in *" * "*) return 0;; esac
  case " $scope " in *" $2 "*) return 0;; esac
  return 1
}

where() { # project file -> existing path of the copy
  local d
  for d in cmake cmake/deps; do [ -f "$root/$1/$d/$2" ] && { echo "$root/$1/$d/$2"; return 0; }; done
  return 1
}

target() { # project file -> where the copy lives or should live
  where "$1" "$2" && return
  if [ -d "$root/$1/cmake/deps" ]; then
    case "$2" in Find*|Build*) echo "$root/$1/cmake/deps/$2"; return;; esac
  fi
  echo "$root/$1/cmake/$2"
}

mark() { # project file
  local f=$canon/$2 p; in_scope "$2" "$1" || { echo -n "."; return; }
  p=$(where "$1" "$2") || { echo -n "-"; return; }
  [ -f "$f" ] || { echo -n "?"; return; }
  if cmp -s "$f" "$p"; then echo -n "="; elif [ "$(norm "$f")" = "$(norm "$p")" ]; then echo -n "~"; else echo -n "!"; fi
}

cmd_status() {
  local ps=() f p
  while IFS= read -r p; do ps+=("$p"); done < <(projects)
  printf '%-22s %-9s' file canonical
  for p in "${ps[@]}"; do printf ' %s' "${p#qjs-}"; done; echo
  while read -r f _; do
    local c="-"; [ -f "$canon/$f" ] && c=$(norm "$canon/$f")
    printf '%-22s %-9s' "$f" "$c"
    for p in "${ps[@]}"; do printf ' %-*s' "${#p}" "$(mark "$p" "$f")" | sed "s/^ \(.\)/ \1/" | tr -d '\n'; done; echo
  done < <(manifest)

  echo; echo "unreconciled files (no canonical copy): copies grouped by content, whitespace ignored"
  while read -r f _; do
    [ -f "$canon/$f" ] && continue
    echo "  $f"
    for p in "${ps[@]}"; do in_scope "$f" "$p" && w=$(where "$p" "$f") && echo "$(norm "$w") ${p#qjs-}($(wc -c <"$w"))"; done \
      | sort | awk '{ g[$1]=g[$1]" "$2; n[$1]++ } END { for (k in g) printf "    %s x%d:%s\n", k, n[k], g[k] }' | sort -t'x' -k2 -nr
  done < <(manifest)
}

cmd_diff() {
  [ $# -eq 2 ] || die "usage: diff <project> <file>"
  local p; p=$(where "$1" "$2") || die "$1 has no $2"
  [ -f "$canon/$2" ] || die "no canonical $2 (try: diff against another project with git diff --no-index)"
  git diff --no-index --word-diff=plain --word-diff-regex='[^[:space:]]+' --no-color "$canon/$2" "$p" | sed '1,4d'
}

apply_one() { # project file force
  local p=$1 f=$2 force=$3 t m
  [ -f "$canon/$f" ] || { echo "skip   $p/$f (no canonical copy)"; return; }
  in_scope "$f" "$p" || { echo "skip   $p/$f (not in scope)"; return; }
  t=$(target "$p" "$f"); m=$(mark "$p" "$f")
  if [ -f "$t" ] && [ -n "$(git -C "$root/$p" status --porcelain -- "$t" 2>/dev/null)" ] && [ "$force" != 1 ]; then
    echo "SKIP   $p/$f has uncommitted changes (--force to overwrite)"; return
  fi
  case $m in
    =) echo "same   $p/${t#$root/$p/}";;
    '!') if [ "$force" = 1 ]; then cp "$canon/$f" "$t"; echo "FORCED $p/${t#$root/$p/} (was different)"
         else echo "SKIP   $p/$f differs (cmake-sync.sh diff $p $f; --force to overwrite)"; fi;;
    *) mkdir -p "$(dirname "$t")"; cp "$canon/$f" "$t"; echo "wrote  $p/${t#$root/$p/}";;
  esac
}

cmd_apply() {
  local force=0 target=$1; shift || die "usage: apply <project|all> <file>... [--force]"
  local files=() a
  for a in "$@"; do if [ "$a" = --force ]; then force=1; else files+=("$a"); fi; done
  [ ${#files[@]} -gt 0 ] || die "name the files to apply"
  local ps; if [ "$target" = all ]; then ps=$(projects); else ps=$target; fi
  local p f
  for p in $ps; do for f in "${files[@]}"; do apply_one "$p" "$f" $force; done; done
}

cmd_adopt() {
  [ $# -eq 2 ] || die "usage: adopt <project> <file>"
  local p; p=$(where "$1" "$2") || die "$1 has no $2"
  if [ -f "$canon/$2" ]; then git diff --no-index --stat --no-color "$canon/$2" "$p" | tail -2; fi
  cp "$p" "$canon/$2"
  grep -q "^$2[[:space:]]" "$canon/MANIFEST" || echo "$2 *" >> "$canon/MANIFEST"
  echo "canonical $2 is now the copy from $1; run: $0 status"
}

case ${1:-} in
  status) shift; cmd_status "$@";;
  diff)   shift; cmd_diff "$@";;
  apply)  shift; cmd_apply "$@";;
  adopt)  shift; cmd_adopt "$@";;
  *) sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 2;;
esac
