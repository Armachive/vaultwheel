#!/bin/sh
# tools/deploy.sh "<what changed>"   one command puts the current source everywhere VaultWheel runs. run it from anywhere:
#   1. builds the three versions from src/ (snapshot for the claude.ai preview, live for the site, bridge for the plugin)
#      into build/ (not in git)
#   2. backs up what is live now into the site's _before_vaultwheel/<time>/ folder
#   3. copies the site page into the vault-tree app (and site/server.py, restarting the container, only when it changed)
#   4. copies the plugin into the vault's .obsidian/plugins/vaultwheel/ (Syncthing carries it to every device; an open
#      VaultWheel view swaps a new page in by itself, and the plugin loads a new main.js by itself)
#   5. commits and pushes this repo
# this machine's paths and accounts are in tools/deploy.env (not in git): copy tools/deploy.env.example to it and fill it in
# the snapshot preview is the one step left: it gets published by hand, to $PREVIEW_URL (the same link every time)
# run the tests first: tools/runall.sh (every suite must pass)
set -e
S=$(cd "$(dirname "$0")/.." && pwd)
# the folder may belong to another user; this lets git work in it when the script runs as root, without touching any git config
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0="$S"
[ -f "$S/tools/deploy.env" ] || { echo "no tools/deploy.env: copy tools/deploy.env.example to it and fill it in" >&2; exit 1; }
. "$S/tools/deploy.env"
for v in APP APP_OWNER SITE_CONTAINER PLUG PLUG_OWNER GIT_NAME GIT_EMAIL GIT_REPO GIT_TOKEN_FILE; do
  eval "[ -n \"\${$v:-}\" ]" || { echo "tools/deploy.env does not set $v" >&2; exit 1; }
done
MSG=${1:?say what changed, it becomes the commit message}
TS=$(date +%Y%m%d-%H%M%S)

mkdir -p $S/build/live $S/build/plugin
sh $S/tools/build.sh snapshot $S/build/vaultwheel-final.html
sh $S/tools/build.sh live $S/build/live/index.html
sh $S/tools/build.sh bridge $S/build/plugin/vaultwheel.html

B=$APP/_before_vaultwheel/$TS; mkdir -p "$B/plugin"
cp -p "$APP/index.html" "$APP/server.py" "$B/"
cp -p "$PLUG/main.js" "$PLUG/manifest.json" "$PLUG/styles.css" "$PLUG/vaultwheel.html" "$B/plugin/"
echo "backed up to $B"

cp "$S/build/live/index.html" "$APP/index.html" && chown "$APP_OWNER" "$APP/index.html" && chmod 644 "$APP/index.html"
if ! cmp -s "$S/site/server.py" "$APP/server.py"; then
  cp "$S/site/server.py" "$APP/server.py" && chown "$APP_OWNER" "$APP/server.py" && chmod 644 "$APP/server.py"
  docker restart "$SITE_CONTAINER" >/dev/null; echo "server.py changed, $SITE_CONTAINER restarted"; sleep 4
fi
docker exec "$SITE_CONTAINER" python -c "import urllib.request; print('site health', urllib.request.urlopen('http://127.0.0.1:8110/healthz',timeout=30).status)"

for f in main.js manifest.json styles.css; do cp "$S/plugin/$f" "$PLUG/$f" && chown "$PLUG_OWNER" "$PLUG/$f" && chmod 770 "$PLUG/$f"; done
cp "$S/build/plugin/vaultwheel.html" "$PLUG/vaultwheel.html" && chown "$PLUG_OWNER" "$PLUG/vaultwheel.html" && chmod 770 "$PLUG/vaultwheel.html"
echo "plugin updated"

cd $S
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git -c user.name="$GIT_NAME" -c user.email="$GIT_EMAIL" commit -q -m "$MSG

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  TOK=$(grep -oE '(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})' "$GIT_TOKEN_FILE" | head -1)
  set +e; OUT=$(git push -q "https://${GIT_REPO%%/*}:$TOK@github.com/$GIT_REPO.git" main 2>&1); RC=$?; set -e
  [ -n "$OUT" ] && echo "$OUT" | grep -v "$TOK" || true
  if [ $RC -eq 0 ]; then echo "pushed $(git log --oneline | head -1)"; else echo "push FAILED (committed locally)"; fi
else echo "repo already up to date"; fi
echo "last step: publish $S/build/vaultwheel-final.html to the preview${PREVIEW_URL:+ at $PREVIEW_URL}"
