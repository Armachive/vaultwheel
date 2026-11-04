#!/bin/sh
# urlshot.sh <url> <out.png> [w h] [delay ms]   screenshot of a url from a one-shot container, with the console log
. "$(dirname "$0")/testbox.sh"
W=${3:-1400}; H=${4:-800}; B=${5:-9000}
O=$2; mkdir -p "$(dirname "$O")"
trap 'box_end' EXIT
trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM
box_image; box_take
box_run /dev/null -e URL="$1" -e W="$W" -e H="$H" -e B="$B" "$BOX_IMAGE" sh -c '
  cd /tmp; timeout 300 chromium --headless=new --no-sandbox --use-angle=gl-egl --use-gl=angle --ignore-gpu-blocklist --disable-dev-shm-usage --hide-scrollbars --window-size=$W,$H --virtual-time-budget=$B --enable-logging=stderr --v=0 --screenshot=/tmp/u.png "$URL" >/tmp/chrome-u.log 2>&1
  grep -E CONSOLE /tmp/chrome-u.log | grep -v "GPU stall\|DEPRECATED" | sed "s/.*CONSOLE[^]]*\]//; s/, source:.*//" | head -8 >&2
  if [ -f /tmp/u.png ]; then echo shot-ok >&2; cat /tmp/u.png; else echo shot-failed >&2; fi
' > "$O"
[ -s "$O" ] || rm -f "$O"
