#!/bin/bash
# rt-sync.sh - sync uncommitted work with a git clone on a remote site via private snapshot refs.
#
#   rt-sync.sh push   <ssh-alias> [-d remote-repo]            snapshot local tree -> remote refs/wip/<me>, check it out in a remote worktree
#   rt-sync.sh run    <ssh-alias> [-d remote-repo] -- <cmd>   push, then run <cmd> in that worktree (build/test)
#   rt-sync.sh pull   <ssh-alias> [-d remote-repo]            snapshot the remote clone's dirty tree -> local refs/wip/<alias> (+ archive)
#   rt-sync.sh merge  <ssh-alias>                              merge the pulled refs/wip/<alias> delta into your working tree (per-file 3-way, backups, nothing staged/committed)
#   rt-sync.sh status <ssh-alias> [-d remote-repo]
#
# Run inside the local repo. Remote repo default: Sources/<local repo dir name> (relative to the remote home).
# Guarantees: no branch, index or working tree on either side is ever modified by push/pull/status
# (the remote *test worktree* ~/.wip/<proj> is ours and is overwritten by push; the remote clone is not).
# A snapshot is a commit object of the whole working tree (tracked + untracked, .gitignore respected)
# built with a temporary index; its parent is HEAD. See knowledge/activities/sync.md.
#
# Env: RT_SSH (default ssh), RT_SSH_OPTS (default "-o BatchMode=yes -o ConnectTimeout=10"), RT_NAME (local ref name, default hostname -s)

set -euo pipefail
die() { echo "rt-sync: $*" >&2; exit 1; }
usage() { sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2; }

cmd=${1:-}; host=${2:-}; [ -n "$host" ] || usage
shift 2
rdir=
while [ $# -gt 0 ]; do
  case $1 in -d) rdir=${2:?}; shift 2;; --) shift; break;; *) usage;; esac
done
case $cmd in push|pull|status|merge) ;; run) [ $# -gt 0 ] || die "run needs: -- <command>";; *) usage;; esac

top=$(git rev-parse --show-toplevel) || die "not in a git repo"
cd "$top"
proj=$(basename "$top")
rdir=${rdir:-Sources/$proj}
SSH=${RT_SSH:-ssh}
SSHOPTS=${RT_SSH_OPTS:--o BatchMode=yes -o ConnectTimeout=10}
export GIT_SSH_COMMAND="$SSH $SSHOPTS"
me=${RT_NAME:-$(hostname -s)}
alias_ref=$(printf %s "$host" | tr -c 'A-Za-z0-9._\n-' '-')
url="$host:$rdir"

# POSIX sh snippet, runs in the repo dir (locally and remotely). Defines rt_snap -> prints "<sha> clean|dirty".
SNAP='
rt_snap() {
  gd=$(git rev-parse --absolute-git-dir) || return 1
  idx=$gd/rt-sync-index; rm -f "$idx"
  [ -f "$gd/index" ] && cp "$gd/index" "$idx"
  GIT_INDEX_FILE=$idx git add -A || return 1
  tree=$(GIT_INDEX_FILE=$idx git write-tree) || return 1
  rm -f "$idx"
  head=$(git rev-parse -q --verify HEAD || true)
  if [ -n "$head" ] && [ "$tree" = "$(git rev-parse -q --verify "HEAD^{tree}")" ]; then echo "$head clean"; return 0; fi
  n=$(git config user.name || echo rt-sync); e=$(git config user.email || echo rt-sync@localhost)
  sha=$(git -c user.name="$n" -c user.email="$e" commit-tree "$tree" ${head:+-p "$head"} -m "rt-sync snapshot") || return 1
  echo "$sha dirty"
}
'

rrun()    { $SSH $SSHOPTS "$host" "cd '$rdir' && $1"; }       # one command line in the remote repo
rscript() { $SSH $SSHOPTS "$host" "cd '$rdir' && sh -s"; }     # script on stdin, in the remote repo

[ -z "$(git ls-files -u)" ] || die "unmerged paths in the local repo; resolve first"

do_push() {
  read -r sha state < <(sh -c "$SNAP"$'\n'rt_snap)
  [ -n "$sha" ] || die "local snapshot failed"
  git push -q "$url" "+$sha:refs/wip/$me" 2>&1 || die "push failed (does $url exist? clone it there first)"
  echo "pushed $state snapshot ${sha:0:10} -> $host:$rdir refs/wip/$me"
  rscript <<EOF
set -e
wt="\$HOME/.wip/$proj"
if [ ! -e "\$wt/.git" ]; then mkdir -p "\$HOME/.wip"; git worktree add -q --detach "\$wt" refs/wip/$me
else git -C "\$wt" checkout -q --detach -f refs/wip/$me; fi
echo "test worktree: \$wt at \$(git -C "\$wt" rev-parse --short HEAD)"
n=\$(git status --porcelain | wc -l); [ "\$n" -eq 0 ] || echo "note: the remote clone itself has \$n uncommitted change(s) (untouched; use 'pull' to bring them back)"
EOF
}

case $cmd in
  push) do_push ;;
  run)
    do_push
    echo "--- running in remote worktree: $*"
    $SSH $SSHOPTS "$host" "cd \"\$HOME/.wip/$proj\" && $*" ;;
  pull)
    out=$(printf '%s\nset -- $(rt_snap); git update-ref refs/wip/%s "$1"; echo "$1 $2 $(git rev-parse --short HEAD)"\n' "$SNAP" "$alias_ref" | rscript) \
      || die "remote snapshot failed (is $rdir a git repo on $host?)"
    read -r sha state rhead <<<"$(printf %s "$out" | tail -1)"
    git fetch -q "$url" "+refs/wip/$alias_ref:refs/wip/$alias_ref" 2>&1 \
      || die "fetch failed"
    if ! git for-each-ref --format='%(objectname)' "refs/wip/archive/$alias_ref/" | grep -qx "$sha"; then
      git update-ref "refs/wip/archive/$alias_ref/$(date +%Y%m%d-%H%M%S)" "$sha"
    fi
    echo "remote $host:$rdir is $state (HEAD $rhead); saved as refs/wip/$alias_ref (+ archive)"
    if [ "$state" = clean ]; then
      echo "nothing uncommitted there; its commits: git log HEAD..refs/wip/$alias_ref"
    else
      git diff --stat "HEAD...refs/wip/$alias_ref" | tail -15 || true
      cat <<EOF
Nothing in your working tree was changed. To take the remote edits:
  git diff HEAD...refs/wip/$alias_ref                    # review
  $0 merge $host                                         # per-file 3-way merge into your tree (backups kept, nothing staged)
  git checkout refs/wip/$alias_ref -- <path>             # or take single files wholesale
EOF
    fi ;;
  merge)
    wip=refs/wip/$alias_ref
    git rev-parse -q --verify "$wip" >/dev/null || die "no $wip; run pull first"
    base=$(git merge-base HEAD "$wip") || die "no common history between HEAD and $wip (fetch the remote's commits first)"
    bk=$(git rev-parse --absolute-git-dir)/rt-sync-backup/$(date +%Y%m%d-%H%M%S)
    tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
    git diff --name-status --no-renames "$base" "$wip" | while IFS=$'\t' read -r st path; do
      if git show "$base:$path" >"$tmp/base" 2>/dev/null; then hasbase=0; else hasbase=1; fi
      if git show "$wip:$path" >"$tmp/theirs" 2>/dev/null; then hastheirs=0; else hastheirs=1; fi
      [ -e "$path" ] && hasours=0 || hasours=1
      save() { if [ -e "$path" ]; then mkdir -p "$bk/$(dirname "$path")"; cp -p "$path" "$bk/$path"; fi; }
      if [ $hastheirs -ne 0 ]; then                                  # deleted remotely
        if [ $hasours -ne 0 ]; then :
        elif cmp -s "$path" "$tmp/base"; then save; rm -f "$path"; echo "deleted   $path"
        else echo "KEPT      $path (deleted on remote, modified here)"; fi
      elif [ $hasours -ne 0 ]; then                                  # missing here
        if [ $hasbase -eq 0 ]; then echo "KEPT      $path (deleted here, modified on remote: git checkout $wip -- '$path')"
        else mkdir -p "$(dirname "$path")"; cp "$tmp/theirs" "$path"; echo "added     $path"; fi
      elif [ $hasbase -eq 0 ] && cmp -s "$path" "$tmp/base"; then    # untouched here: take theirs
        save; cp "$tmp/theirs" "$path"; echo "updated   $path"
      elif cmp -s "$path" "$tmp/theirs"; then echo "same      $path"
      else
        [ $hasbase -eq 0 ] || : >"$tmp/base"
        save
        if git merge-file -q "$path" "$tmp/base" "$tmp/theirs" -L "here" -L "base" -L "$host"; then echo "merged    $path"
        else echo "CONFLICT  $path (markers in file)"; fi
      fi
    done
    if [ -d "$bk" ]; then echo "backups of overwritten/merged files: $bk"; fi
    echo "review with git diff; nothing was staged or committed." ;;
  status)
    read -r sha state < <(sh -c "$SNAP"$'\n'rt_snap)
    echo "local : $state (${sha:0:10}) in $top"
    rrun 'echo "remote: HEAD $(git rev-parse --short HEAD) $(git rev-parse --abbrev-ref HEAD), $(git status --porcelain | wc -l) uncommitted change(s)"; git for-each-ref --format="remote ref: %(refname) %(objectname:short)" refs/wip/; [ -d "$HOME/.wip/'"$proj"'" ] && echo "test worktree at $(git -C "$HOME/.wip/'"$proj"'" rev-parse --short HEAD)"; true'
    git for-each-ref --format='local ref : %(refname) %(objectname:short)' refs/wip/ | grep -v '/archive/' || true ;;
esac
