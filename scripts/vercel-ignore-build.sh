#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 skips the build, exit 1 builds.
# Build main, preview/* branches (on-demand preview deploys) and CLI deploys
# (empty ref); skip every other branch.
case "${VERCEL_GIT_COMMIT_REF:-}" in
  ""|main|preview/*) ;;
  *) echo "Skip: branch $VERCEL_GIT_COMMIT_REF is not main or preview/*"; exit 0 ;;
esac
BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
if ! git cat-file -e "$BASE^{commit}" 2>/dev/null; then
  echo "Build: base $BASE not in clone"; exit 1
fi
if [ "$BASE" = "$(git rev-parse HEAD)" ]; then
  echo "Build: redeploy of same commit (deploy hook / manual)"; exit 1
fi
if git diff --quiet "$BASE" HEAD -- . ':(exclude)*.md' ':(exclude)docs/**'; then
  echo "Skip: only docs changed"; exit 0
fi
echo "Build"; exit 1
