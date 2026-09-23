#!/bin/bash
# Every 2h: scrape all sources -> data/snapshots/<date>.json.gz + mix library, commit and push (main deploys on push).
set -uo pipefail
cd "$(dirname "$0")/../.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
DATE=$(date +%F)
echo "== $(date -Iseconds) scrape $DATE"
LOG=$(mktemp -t priors-scrape)
notify() { osascript -e "display notification \"$1\" with title \"Priors\"" 2>/dev/null || true; }
if ! npx tsx scripts/scrape/build.ts --date "$DATE" 2>&1 | tee "$LOG"; then
  notify "Priors scrape failed for $DATE — see logs/scrape.log"
  exit 1
fi
# build.ts already regenerates the mix library inline; re-run explicitly so the
# library is refreshed even if the inline step is ever skipped.
if ! npm run library -- --date "$DATE" >>"$LOG" 2>&1; then
  notify "Priors library build failed for $DATE — see logs/scrape.log"
fi
if grep -q "DEFAULT_FIT_MISSING" "$LOG"; then
  notify "Priors: the default lineup has no exact fit on today's data — see logs/scrape.log"
fi
if ! npx tsx scripts/scrape/intro-cards.ts >>"$LOG" 2>&1; then
  notify "Priors intro cards failed for $DATE — see logs/scrape.log"
fi
if grep -qE '^[[:space:]]*failed[[:space:]]' "$LOG"; then
  notify "Priors scrape $DATE finished with source failures — see logs/scrape.log"
fi
git add data/snapshots public/intro
if ! git diff --cached --quiet; then
  git commit -q -m "data: snapshot $DATE"
  # A dirty working tree is normal while Adam or another agent edits the app.
  # Push the snapshot commit directly; rebase here would fail or disturb those edits.
  if ! git push -q origin main; then
    notify "Priors snapshot $DATE committed locally but push failed"
  fi
fi
echo "== done $(date -Iseconds)"
