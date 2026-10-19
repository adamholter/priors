#!/bin/bash
# Every 15 min: scrape all sources -> data/snapshots/<date>.json.gz + mix library. A changed snapshot goes to the single-commit
# live branch (the site reads it; no deploy, no history growth). Finished days are archived to main once, by the first run of the next day.
# Runs in its own checkout (~/priors-scrape, marked by .scrape-checkout) that holds nothing but origin/main,
# so app work in other checkouts can never block the push. See docs/operations.md.
set -uo pipefail
cd "$(dirname "$0")/../.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
DATE=${PRIORS_DATE:-$(date +%F)}
notify() { osascript -e "display notification \"$1\" with title \"Priors\"" 2>/dev/null || true; }
if [ "${1:-}" != "--synced" ]; then
  echo "== $(date -Iseconds) scrape $DATE"
  # The reset below throws away local changes, so it only ever runs in the marked checkout.
  if [ ! -f .scrape-checkout ]; then
    echo "Not the scrape checkout (no .scrape-checkout here). Refusing to run."
    notify "Priors scrape did not run: wrong checkout — see logs/scrape.log"
    exit 1
  fi
  # One run at a time: a slow run (a library search can take minutes) must not overlap the next scheduled one.
  LOCKDIR=${TMPDIR:-/tmp}/priors-scrape.lock
  if ! mkdir "$LOCKDIR" 2>/dev/null; then
    if kill -0 "$(cat "$LOCKDIR/pid" 2>/dev/null)" 2>/dev/null; then echo "Previous run (pid $(cat "$LOCKDIR/pid")) still going; skipping."; exit 0; fi
    rm -rf "$LOCKDIR"; mkdir "$LOCKDIR" || exit 1
  fi
  echo $$ > "$LOCKDIR/pid"
  if ! git fetch -q origin main || ! git checkout -q -f --detach origin/main; then
    notify "Priors scrape could not update to origin/main — see logs/scrape.log"
    exit 1
  fi
  LOCK=$(shasum package-lock.json | cut -d' ' -f1)
  if [ "$LOCK" != "$(cat node_modules/.scrape-lock 2>/dev/null)" ]; then
    if ! npm ci --no-audit --no-fund >/dev/null 2>&1; then notify "Priors scrape: npm ci failed — see logs/scrape.log"; exit 1; fi
    echo "$LOCK" > node_modules/.scrape-lock
  fi
  # This file may just have changed underneath the running shell: start over on the new copy.
  exec /bin/bash "$0" --synced
fi
LIVE=${PRIORS_LIVE_BRANCH:-data-live}
HAVE_LIVE=
git fetch -q origin "$LIVE" 2>/dev/null && git rev-parse -q --verify "origin/$LIVE" >/dev/null && HAVE_LIVE=1

# Days that are over move from the live branch to main (their final copy, plus the latest files so a fresh build
# starts close to today), so main grows by one commit a day instead of one per scrape.
archive_finished_days() {
  [ -n "$HAVE_LIVE" ] || return 0
  local f d files=()
  for f in $(git ls-tree --name-only "origin/$LIVE" data/snapshots/ | grep -E '/[0-9]{4}-[0-9]{2}-[0-9]{2}(\.library)?\.json\.gz$'); do
    d=$(basename "$f" | cut -c1-10)
    [ "$d" \< "$DATE" ] || continue
    git diff --quiet HEAD "origin/$LIVE" -- "$f" || files+=("$f")
  done
  [ ${#files[@]} -gt 0 ] || return 0
  files+=(data/snapshots/latest.json.gz data/snapshots/latest.library.json.gz public/intro)
  git checkout -q "origin/$LIVE" -- "${files[@]}" || return 1
  git diff --cached --quiet && return 0
  git commit -q -m "data: archive finished days" -- "${files[@]}" || return 1
  local pushed=
  for _ in 1 2 3; do
    if git push -q origin HEAD:main; then pushed=1; break; fi
    git fetch -q origin main && git rebase -q origin/main || { git rebase --abort 2>/dev/null; break; }
  done
  [ -n "$pushed" ]
}
if ! archive_finished_days; then
  notify "Priors: archiving finished days to main failed — see logs/scrape.log"
fi
# Scrape from what is live now: the build merges a source outage with the previous latest, and the library reuses its fits.
[ -n "$HAVE_LIVE" ] && git checkout -q "origin/$LIVE" -- data/snapshots public/intro

# The live branch is one commit with only what the site reads: latest files, today's file, intro cards.
publish_live() {
  local tmp cutoff f d
  tmp=$(mktemp -d "${TMPDIR:-/tmp}/priors-live.XXXXXX") || return 1
  [ -n "$HAVE_LIVE" ] && git archive "origin/$LIVE" | tar -x -C "$tmp"
  mkdir -p "$tmp/data/snapshots" "$tmp/public"
  cp data/snapshots/latest.json.gz "$tmp/data/snapshots/" || return 1
  for f in latest.library.json.gz "$DATE.json.gz" "$DATE.library.json.gz"; do
    [ -e "data/snapshots/$f" ] && cp "data/snapshots/$f" "$tmp/data/snapshots/"
  done
  rm -rf "$tmp/public/intro" && cp -R public/intro "$tmp/public/intro" || return 1
  [ -n "${LIB_BUILT:-}" ] && echo "$LIB_BUILT" > "$tmp/library-built-at"
  cutoff=$(date -v-3d +%F 2>/dev/null || date -d '3 days ago' +%F)
  for f in "$tmp"/data/snapshots/20??-??-??*.json.gz; do
    [ -e "$f" ] || continue
    d=$(basename "$f" | cut -c1-10)
    [ "$d" \< "$cutoff" ] && rm -f "$f"
  done
  # This branch is not the app: tell Vercel never to build it.
  printf '{ "ignoreCommand": "exit 0", "git": { "deploymentEnabled": false } }\n' > "$tmp/vercel.json"
  (
    cd "$tmp" && git init -q -b "$LIVE" && git add -A \
      && git -c user.name="$(git -C "$OLDPWD" config user.name || echo priors-scrape)" -c user.email="$(git -C "$OLDPWD" config user.email || echo scrape@mypriors.com)" commit -q -m "live data $DATE $(date -u +%H:%MZ)" \
      && git push -q --force "$(git -C "$OLDPWD" remote get-url origin)" "HEAD:refs/heads/$LIVE"
  )
  local status=$?
  rm -rf "$tmp"
  return $status
}

# exec kept the pid but dropped nothing else: release the lock when this run ends, however it ends.
LOCKDIR=${TMPDIR:-/tmp}/priors-scrape.lock
trap '[ "$(cat "$LOCKDIR/pid" 2>/dev/null)" = "$$" ] && rm -rf "$LOCKDIR"' EXIT
LOG=$(mktemp "${TMPDIR:-/tmp}/priors-scrape.XXXXXX") || exit 1
# --no-library: the library (the slow part) is built below, once, and only if the data changed.
if ! npx tsx scripts/scrape/build.ts --date "$DATE" --no-library 2>&1 | tee "$LOG"; then
  notify "Priors scrape failed for $DATE — see logs/scrape.log"
  exit 1
fi
# Sources announce benchmarks the publisher added that Priors does not read yet. Notify once per item.
ANNOUNCED="${PRIORS_ANNOUNCED_FILE:-$HOME/priors/logs/announced-benchmarks.txt}"
grep -E '^NEW_BENCHMARK ' "$LOG" | sort -u | while IFS= read -r line; do
  if ! grep -qxF "$line" "$ANNOUNCED" 2>/dev/null; then
    echo "$line" >> "$ANNOUNCED" 2>/dev/null
    item=${line#NEW_BENCHMARK }
    notify "New benchmark to add: ${item//\"/}"
  fi
done
if grep -qE '^[[:space:]]*failed[[:space:]]' "$LOG"; then
  notify "Priors scrape $DATE finished with source failures — see logs/scrape.log"
fi
SNAPSHOT_BASELINE_REF=${HAVE_LIVE:+origin/$LIVE} npx tsx scripts/ops/snapshot-changed.ts
CHANGE_STATUS=$?
case "$CHANGE_STATUS" in
  0) echo "== done $(date -Iseconds)"; exit 0 ;;
  10) ;; # Meaningful data (or default ranking membership) changed.
  *) notify "Priors snapshot change check failed — see logs/scrape.log"; exit 1 ;;
esac
# Only a changed snapshot needs the mix library (its lineup fits reuse every fit whose data is unchanged) and intro cards.
# The library is the slow part and drifts slowly, so with a 15-minute schedule it is rebuilt at most every two hours;
# the snapshot itself is published every time.
NOW=$(date +%s)
LIB_AT=$(git show "origin/$LIVE:library-built-at" 2>/dev/null || echo 0)
if [ -n "$HAVE_LIVE" ] && [ -e data/snapshots/latest.library.json.gz ] && [ $((NOW - ${LIB_AT:-0})) -lt "${PRIORS_LIBRARY_EVERY:-7200}" ]; then
  echo "Mix library built $(( (NOW - LIB_AT) / 60 )) min ago; reusing it."
  [ -e "data/snapshots/$DATE.library.json.gz" ] || cp data/snapshots/latest.library.json.gz "data/snapshots/$DATE.library.json.gz"
else
  if ! npm run library -- --date "$DATE" 2>&1 | tee -a "$LOG"; then
    notify "Priors library build failed for $DATE — see logs/scrape.log"
  else
    LIB_BUILT=$NOW
  fi
fi
if grep -q "DEFAULT_FIT_MISSING" "$LOG"; then
  notify "Priors: the default lineup has no exact fit on today's data — see logs/scrape.log"
fi
if ! npx tsx scripts/scrape/intro-cards.ts 2>&1 | tee -a "$LOG"; then
  notify "Priors intro cards failed for $DATE — see logs/scrape.log"
fi
if ! publish_live; then
  notify "Priors live data $DATE was not published — see logs/scrape.log"
  exit 1
fi
echo "== done $(date -Iseconds)"
