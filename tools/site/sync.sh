#!/bin/sh
# Build one or more project sites from this repo and sync them onto the
# projects' gh-pages branches.
#
#   tools/site/sync.sh [--push] [--message TEXT] <site>...
#   tools/site/sync.sh [--push] --all
#
# Per site:
#   1. resolve the project checkout (sites.local / $SITE_SRC_<NAME>)
#   2. keep a private clone of the project's gh-pages branch in .cache/pages/<site>
#      and reset it to origin/gh-pages (it is generated output: never merge it)
#   3. replace its content with a fresh build of the site
#   4. commit on top of the remote history if anything changed
#   5. with --push, push that commit (a plain fast-forward, never --force)
#
# Without --push nothing leaves this machine: the commit stays in the cache
# clone, where `git -C .cache/pages/<site> show --stat` shows what would go out.
#
# The project checkout is read as it is on disk (working tree, current branch),
# not from origin/main; the commit message records its sha and any dirtiness.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
cache="$root/.cache/pages"
push=0
msg=
sites=

if command -v node >/dev/null 2>&1; then run="node"; else run="qjsm"; fi

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

while [ $# -gt 0 ]; do
  case $1 in
    --push) push=1 ;;
    --message|-m) shift; msg=$1 ;;
    --all) sites=$($run "$here/build.js" --list) ;;
    -h|--help) usage 0 ;;
    -*) echo "sync.sh: unknown option $1" >&2; usage 1 ;;
    *) sites="$sites $1" ;;
  esac
  shift
done
[ -n "$sites" ] || usage 1

rsenn_rev=$(git -C "$root" rev-parse --short HEAD 2>/dev/null || echo unknown)
[ -z "$(git -C "$root" status --porcelain -- sites tools 2>/dev/null)" ] || rsenn_rev="$rsenn_rev+dirty"

for site in $sites; do
  echo "== $site"
  src=$($run "$here/build.js" "$site" --print-src)
  remote=${PAGES_REMOTE:-$(git -C "$src" remote get-url origin)}
  dir="$cache/$site"

  if [ -d "$dir/.git" ]; then
    git -C "$dir" fetch -q origin gh-pages
    git -C "$dir" checkout -q -B gh-pages origin/gh-pages
    git -C "$dir" clean -fdxq
  else
    mkdir -p "$cache"
    git clone -q --single-branch --branch gh-pages "$remote" "$dir"
  fi

  # Generated output only: start from an empty tree so deleted pages disappear.
  find "$dir" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  $run "$here/build.js" "$site" --src "$src" --out "$dir"

  git -C "$dir" add -A
  if git -C "$dir" diff --cached --quiet; then
    echo "   gh-pages already up to date"
    continue
  fi

  src_rev=$(git -C "$src" rev-parse --short HEAD)
  src_branch=$(git -C "$src" rev-parse --abbrev-ref HEAD)
  [ -z "$(git -C "$src" status --porcelain -- README.md doc docs examples 2>/dev/null)" ] || src_rev="$src_rev+dirty"
  git -C "$dir" -c core.hooksPath=/dev/null commit -q \
    -m "${msg:-Sync $site site}" \
    -m "Built from $site@$src_rev ($src_branch) with rsenn/rsenn@$rsenn_rev."
  git -C "$dir" show --stat --format='   %h %s' HEAD | sed -n '1p;$p'

  if [ "$push" = 1 ]; then
    git -C "$dir" push origin gh-pages
    echo "   pushed"
  else
    echo "   not pushed (use --push); review with: git -C $dir show --stat"
  fi
done
