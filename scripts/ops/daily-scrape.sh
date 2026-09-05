#!/bin/bash
# Daily: scrape all sources -> data/snapshots/<date>.json.gz, commit locally. Deploy is manual (git push).
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
DATE=$(date +%F)
echo "== $(date -Iseconds) scrape $DATE"
npx tsx scripts/scrape/build.ts --date "$DATE"
git add data/snapshots
git diff --cached --quiet || git commit -q -m "data: snapshot $DATE"
echo "== done $(date -Iseconds)"
