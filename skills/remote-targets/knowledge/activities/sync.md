# Activity: sync (uncommitted work between workstation and a remote git clone)

Tool: [`scripts/rt-sync.sh`](../../scripts/rt-sync.sh). Site key: `dirs.repos` (home-relative dir holding the remote clones) in [../../sites.yaml](../../sites.yaml). Related: [transfer](transfer.md), [ssh](../transports/ssh.md), [sshfs](../transports/sshfs.md). Back to [INDEX](../INDEX.md).

## Problem
Test on the remote without committing untested code, and without rsync clobbering edits made remotely (ssh + tmux + vim).

## Mechanism (no branch, index or working tree is touched by push/pull)
- A **snapshot** is a commit object of the whole working tree (tracked + untracked, `.gitignore` respected) built with a temporary index, parent = HEAD. It lives only under `refs/wip/*`.
- `push`: local snapshot -> remote `refs/wip/<local-name>`, checked out (detached, forced) in a **separate worktree** `~/.wip/<proj>` on the remote. The remote's real clone is never modified; the remote's incremental build dirs survive in the worktree.
- `run -- <cmd>`: push, then run `<cmd>` in that worktree (build/test).
- `pull`: snapshot the remote clone's dirty tree -> remote `refs/wip/<alias>`, fetch to local `refs/wip/<alias>`, keep an archive ref `refs/wip/archive/<alias>/<timestamp>` (remote edits are never lost). Local tree untouched.
- `merge`: per-file 3-way merge of the remote delta (merge-base..`refs/wip/<alias>`) into your working tree, backups under `.git/rt-sync-backup/<ts>/`, conflicts as markers, nothing staged. (`git merge`, `git apply --3way` both refuse on a dirty tree, which is why this exists.)
- Only after the tests pass do you make a real commit and push it to origin.

## Usage
```
scripts/rt-sync.sh run termux -- 'make test'      # from inside the local repo; remote repo defaults to Sources/<dirname>
scripts/rt-sync.sh pull termux && scripts/rt-sync.sh merge termux
scripts/rt-sync.sh status termux
```
Override: `-d <remote-repo>` (home-relative or absolute), env `RT_SSH`, `RT_SSH_OPTS`, `RT_NAME` (local ref name, default `hostname -s`).

## Verified / caveats
- `[verified 2026-10-14]` push, run (clang build + run of the snapshot), pull, merge, status on a Termux site and with a local fake-ssh harness: ignored files excluded, untracked included, trees untouched, repeated pull adds no duplicate archive, new/deleted/modified remote files and conflicts handled.
- `[seeded]` Submodules are not snapshotted (the temp-index `add -A` records the gitlink only). Large untracked files are included: add them to `.gitignore`.
- `[seeded]` Remote repo must already exist (clone it first); a repo with no HEAD (no commits) is not supported.
- `[seeded]` Remote worktrees add entries in the remote clone's `.git/worktrees`; remove with `git worktree remove ~/.wip/<proj>` when done.
- `[seeded]` Alternative for single-owner sessions: edit over [sshfs](../transports/sshfs.md), run git on the remote via ssh (not over the mount), keep commits on a `wip/<task>` branch and squash here.
