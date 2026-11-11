#!/bin/bash
# Runs the scrape job now instead of at its next 15-minute slot, and publishes to data-live as a scheduled run does.
#   npm run scrape:now                        every source
#   npm run scrape:now -- honeybench,arcagi   only those sources (ids from scripts/scrape/sources); the rest carry over
#   scrape-now.sh --after-push <sha>          (the pre-push hook) once origin/main is <sha>, start the scheduled job
# It runs the scrape checkout's own script (~/priors-scrape), which first moves to origin/main, so it scrapes with
# whatever is pushed, never with local edits. A run already going is waited for, never interrupted.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
JOB=com.adam.priors-scrape
SCRAPE_DIR=${PRIORS_SCRAPE_DIR:-$HOME/priors-scrape}
LOCKDIR=${TMPDIR:-/tmp}/priors-scrape.lock
LOG=$HOME/priors/logs/scrape.log
busy() { [ -d "$LOCKDIR" ] && kill -0 "$(cat "$LOCKDIR/pid" 2>/dev/null)" 2>/dev/null; }
wait_idle() { local n=0; while busy && [ $n -lt 120 ]; do [ $n -eq 0 ] && [ -z "${QUIET:-}" ] && echo "A scrape is running (pid $(cat "$LOCKDIR/pid")); waiting for it."; sleep 5; n=$((n + 1)); done; ! busy; }

if [ "${1:-}" = "--after-push" ]; then
  QUIET=1
  launchctl print "gui/$(id -u)/$JOB" >/dev/null 2>&1 || exit 0
  for _ in $(seq 1 60); do
    if [ "$(git ls-remote origin refs/heads/main 2>/dev/null | cut -f1)" = "${2:-}" ]; then
      wait_idle && launchctl kickstart "gui/$(id -u)/$JOB"
      echo "== $(date -Iseconds) scrape started after push of ${2:0:8}" >> "$LOG"
      exit 0
    fi
    sleep 5
  done
  exit 0
fi

[ -f "$SCRAPE_DIR/.scrape-checkout" ] || { echo "No scrape checkout at $SCRAPE_DIR (see docs/operations.md)."; exit 1; }
wait_idle || { echo "The running scrape has not finished in 10 minutes; try again later."; exit 1; }
start=$(date +%s)
PRIORS_SCRAPE_ONLY="${1:-}" bash "$SCRAPE_DIR/scripts/ops/daily-scrape.sh" 2>&1 | tee -a "$LOG"
status=${PIPESTATUS[0]}
echo "scrape:now finished in $(( $(date +%s) - start ))s (exit $status). The site reads data-live within 5 minutes (its cache)."
exit "$status"
