#!/bin/sh
# Priors CLI installer: curl -fsSL https://mypriors.com/install.sh | sh
# Puts one file, `priors`, on your PATH. Needs Node 18 or newer. Set PREFIX to choose the folder (default ~/.local/bin).
set -eu
BASE="${PRIORS_URL:-https://mypriors.com}"
DEST="${PREFIX:-$HOME/.local/bin}"
if ! command -v node >/dev/null 2>&1; then echo "Priors needs Node 18 or newer: https://nodejs.org" >&2; exit 1; fi
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then echo "Priors needs Node 18 or newer (found $(node -v))." >&2; exit 1; fi
mkdir -p "$DEST"
curl -fsSL "$BASE/cli/priors.mjs" -o "$DEST/priors"
chmod +x "$DEST/priors"
echo "Installed $DEST/priors ($("$DEST/priors" --version))"
case ":$PATH:" in *":$DEST:"*) ;; *) echo "Add it to your PATH: export PATH=\"$DEST:\$PATH\"" ;; esac
echo "Try: priors rank --top 10"
