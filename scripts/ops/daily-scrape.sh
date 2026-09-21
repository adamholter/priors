#!/bin/bash
# Daily: scrape all sources -> data/snapshots/<date>.json.gz, commit and push (main deploys on push).
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
if grep -qE '^[[:space:]]*failed[[:space:]]' "$LOG"; then
  notify "Priors scrape $DATE finished with source failures — see logs/scrape.log"
fi
git add data/snapshots
if ! git diff --cached --quiet; then
  git commit -q -m "data: snapshot $DATE"
  if ! { git pull --rebase origin main && git push -q origin main; }; then
    notify "Priors snapshot $DATE committed locally but push failed"
  fi
fi
echo "== done $(date -Iseconds)"
