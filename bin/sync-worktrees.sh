#!/usr/bin/env bash
set -euo pipefail

MAIN_DIR="/Users/gannonhall/dev/kata/kata-cloud"
WT_DIR="/Users/gannonhall/dev/kata/kata-cloud.worktrees"
WORKTREES=("wt-a" "wt-b" "wt-c")

# Pull latest main
echo "==> Updating main"
git -C "$MAIN_DIR" pull origin main

main_sha=$(git -C "$MAIN_DIR" rev-parse --short HEAD)
echo "    main is now at $main_sha"

# Reset each worktree's standby branch to main
for wt in "${WORKTREES[@]}"; do
  wt_path="$WT_DIR/$wt"
  branch="${wt}-standby"

  if [ ! -d "$wt_path" ]; then
    echo "==> SKIP $wt (directory not found)"
    continue
  fi

  # Check for uncommitted changes
  if ! git -C "$wt_path" diff --quiet || ! git -C "$wt_path" diff --cached --quiet; then
    echo "==> SKIP $wt (uncommitted changes)"
    continue
  fi

  # Check the worktree is on its standby branch
  current=$(git -C "$wt_path" branch --show-current)
  if [ "$current" != "$branch" ]; then
    echo "==> SKIP $wt (on branch '$current', expected '$branch')"
    continue
  fi

  echo "==> Resetting $wt"
  git -C "$wt_path" reset --hard main
  echo "    $wt now at $(git -C "$wt_path" rev-parse --short HEAD)"
done

echo "==> Done"
