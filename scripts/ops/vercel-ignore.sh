#!/bin/bash
# Vercel's ignoreCommand (vercel.json): exit 0 skips the build, anything else builds. A commit is skipped when it cannot change
# the site: data the site reads from data-live anyway, scrapers and the ops scripts that run on the Mac, model label rules, hooks, docs, and
# benchmark descriptions that only add entries (a new benchmark's description already rides in the snapshot; changing an
# existing one needs the app, which re-applies descriptions on load). Unknown history (no previous sha) always builds.
prev=${VERCEL_GIT_PREVIOUS_SHA:-}
[ -n "$prev" ] && git cat-file -e "$prev^{commit}" 2>/dev/null || exit 1
files=$(git diff --name-only "$prev" HEAD) || exit 1
[ -n "$files" ] || exit 0
while read -r f; do
  case "$f" in
    scripts/ops/parallel.mjs|scripts/ops/cloudflare-*) exit 1 ;;
    data/snapshots/*|public/intro/*|scripts/scrape/*|scripts/radar/*|scripts/ops/*|scripts/benchmarks/*|.githooks/*|docs/*|*.md) ;;
    # Model label rules reach the site through the next scrape's data, so they ride along with the next real deploy.
    src/data/normalize.ts|src/data/normalize.test.ts|src/data/model-labels.ts|src/data/model-labels.test.ts|src/engine/fixtures/expected.json) ;;
    src/data/catalog/*.test.ts) ;;
    src/data/catalog/*) git diff -U0 "$prev" HEAD -- "$f" | grep -qE '^-[^-]' && exit 1 ;;
    *) exit 1 ;;
  esac
done <<< "$files"
echo "Skipping the build: only scrapers, data, ops, docs or new benchmark descriptions changed."
exit 0
