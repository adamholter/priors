#!/bin/bash
# Every 2h: scrape all sources -> data/snapshots/<date>.json.gz + mix library, commit and push (main deploys on push).
# Runs in its own checkout (~/priors-scrape, marked by .scrape-checkout) that holds nothing but origin/main,
# so app work in other checkouts can never block the push. See docs/operations.md.
set -uo pipefail
cd "$(dirname "$0")/../.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
DATE=$(date +%F)
notify() { osascript -e "display notification \"$1\" with title \"Priors\"" 2>/dev/null || true; }
if [ "${1:-}" != "--synced" ]; then
  echo "== $(date -Iseconds) scrape $DATE"
  # The reset below throws away local changes, so it only ever runs in the marked checkout.
  if [ ! -f .scrape-checkout ]; then
    echo "Not the scrape checkout (no .scrape-checkout here). Refusing to run."
    notify "Priors scrape did not run: wrong checkout — see logs/scrape.log"
    exit 1
  fi
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
npx tsx scripts/ops/snapshot-changed.ts
CHANGE_STATUS=$?
case "$CHANGE_STATUS" in
  0) echo "== done $(date -Iseconds)"; exit 0 ;;
  10) ;; # Meaningful data (or default ranking membership) changed.
  *) notify "Priors snapshot change check failed — see logs/scrape.log"; exit 1 ;;
esac
# Only a changed snapshot needs the mix library (its lineup fits reuse every fit whose data is unchanged) and intro cards.
if ! npm run library -- --date "$DATE" 2>&1 | tee -a "$LOG"; then
  notify "Priors library build failed for $DATE — see logs/scrape.log"
fi
if grep -q "DEFAULT_FIT_MISSING" "$LOG"; then
  notify "Priors: the default lineup has no exact fit on today's data — see logs/scrape.log"
fi
if ! npx tsx scripts/scrape/intro-cards.ts 2>&1 | tee -a "$LOG"; then
  notify "Priors intro cards failed for $DATE — see logs/scrape.log"
fi
git add data/snapshots public/intro || exit 1
if ! git diff --cached --quiet -- data/snapshots public/intro; then
  git commit -q -m "data: snapshot $DATE" -- data/snapshots public/intro || exit 1
  # main may have moved during the scrape (an app deploy): replay the snapshot on top and try again.
  PUSHED=
  for _ in 1 2 3; do
    if git push -q origin HEAD:main; then PUSHED=1; break; fi
    git fetch -q origin main && git rebase -q origin/main || { git rebase --abort 2>/dev/null; break; }
  done
  if [ -z "$PUSHED" ]; then
    notify "Priors snapshot $DATE was not pushed — see logs/scrape.log"
    exit 1
  fi
fi
echo "== done $(date -Iseconds)"
