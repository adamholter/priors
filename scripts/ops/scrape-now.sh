#!/bin/bash
# Runs the scrape job now instead of at its next 15-minute slot, and publishes to data-live as a scheduled run does.
#   npm run scrape:now                        every source
#   npm run scrape:now -- honeybench,arcagi   only those sources (ids from scripts/scrape/sources); the rest carry over
#   scrape-now.sh --after-push <sha> [<old>]  (the pre-push hook) once origin/main is <sha>, start the scheduled job; when
#                                             <old>..<sha> only changed scrapers, scrape just those (changed_sources)
# It runs the scrape checkout's own script (~/priors-scrape), which first moves to origin/main, so it scrapes with
# whatever is pushed, never with local edits. A run already going is waited for, never interrupted.
set -uo pipefail
# Started from the pre-push hook, this inherits the pushing git's environment (GIT_EXEC_PATH of Apple's git 2.39), which
# made the scrape's newer git load old helpers and fail its fetch (2026-11-13). Start clean, with the job's PATH.
for v in $(env | grep -o '^GIT_[A-Z_]*'); do unset "$v"; done
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/../.." || exit 1
JOB=com.adam.priors-scrape
SCRAPE_DIR=${PRIORS_SCRAPE_DIR:-$HOME/priors-scrape}
LOCKDIR=${TMPDIR:-/tmp}/priors-scrape.lock
LOG=$HOME/priors/logs/scrape.log
busy() { [ -d "$LOCKDIR" ] && kill -0 "$(cat "$LOCKDIR/pid" 2>/dev/null)" 2>/dev/null; }
wait_idle() { local n=0; while busy && [ $n -lt 120 ]; do [ $n -eq 0 ] && [ -z "${QUIET:-}" ] && echo "A scrape is running (pid $(cat "$LOCKDIR/pid")); waiting for it."; sleep 5; n=$((n + 1)); done; ! busy; }

# Source ids whose files are all a push changed, besides tests, fixtures, docs and descriptions. Empty when anything else
# changed (a shared helper, the build, the app), which needs every source.
changed_sources() {
  local old=$1 new=$2 files f ids=""
  git cat-file -e "$old^{commit}" 2>/dev/null || return 0
  files=$(git diff --name-only "$old" "$new") || return 0
  for f in $files; do
    case "$f" in
      scripts/scrape/sources/_*) return 0 ;;
      scripts/scrape/sources/*.test.ts|scripts/scrape/*.test.ts|scripts/scrape/fixtures/*|docs/*|*.md|src/data/catalog/*) ;;
      scripts/scrape/sources/*.ts) ids="$ids,$(basename "$f" .ts)" ;;
      scripts/scrape/boards/*.test.ts) ;;
      # Config-only boards (scripts/scrape/boards/): `--only boards` runs every config, a few seconds in all.
      scripts/scrape/boards/*) ids="$ids,boards" ;;
      *) return 0 ;;
    esac
  done
  echo "${ids#,}"
}

if [ "${1:-}" = "--after-push" ]; then
  QUIET=1
  launchctl print "gui/$(id -u)/$JOB" >/dev/null 2>&1 || exit 0
  only=$(changed_sources "${3:-}" "${2:-}")
  for _ in $(seq 1 120); do
    if [ "$(git ls-remote origin refs/heads/main 2>/dev/null | cut -f1)" = "${2:-}" ]; then
      wait_idle || exit 0
      if [ -n "$only" ] && [ -f "$SCRAPE_DIR/.scrape-checkout" ]; then
        echo "== $(date -Iseconds) scrape of $only after push of ${2:0:8}" >> "$LOG"
        if ! PRIORS_SCRAPE_ONLY="$only" bash "$SCRAPE_DIR/scripts/ops/daily-scrape.sh" >> "$LOG" 2>&1; then
          # Never leave the push unpublished until the next slot: the scheduled job runs everything.
          echo "== $(date -Iseconds) scrape of $only failed; starting the full job" >> "$LOG"
          launchctl kickstart "gui/$(id -u)/$JOB"
        fi
      else
        launchctl kickstart "gui/$(id -u)/$JOB"
        echo "== $(date -Iseconds) scrape started after push of ${2:0:8}" >> "$LOG"
      fi
      exit 0
    fi
    sleep 2
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
