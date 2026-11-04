#!/bin/sh
# rtest.sh <final.html> <test.js> [budget ms]   runs a behavior test in headless chromium in a one-shot container (see
# testbox.sh) and prints RESULTS. RTEST_NODE=1 runs the test in node instead, with the first file on its stdin.
# chromium sometimes lingers after the page is done, so the log is polled for RESULTS and the container then ends
# a tab killed for memory never prints anything, so a crash ends the wait at once and says CRASHED (runall retries it once)
# the wait also ends when chromium has dumped the page (its time budget is used up: TIMEOUT if no RESULTS came) or when
# the log has not grown for 4 minutes (STALLED), so a run can never hold its slot for the full 25 minutes
. "$(dirname "$0")/testbox.sh"
B=${3:-20000}
# RTEST_REAL=1 runs on the real clock (no time budget): a test of browser storage needs it, storage does not wait for the
# test clock, which runs on past it
CLOCK="--virtual-time-budget=$B --dump-dom"; [ -n "$RTEST_REAL" ] && CLOCK=
# a test needs nothing from the network, and with none a font's stylesheet would take 10 s to fail, so names fail at once.
# only a page that loads three from the CDN (not built light) gets the network
NET="--network none"; NONET=1
P=$(mktemp); L=$(mktemp)
trap 'box_end; rm -f "$P" "$L"' EXIT
trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM
box_image; box_take
if [ -n "$RTEST_NODE" ]; then
  box_run "$1" $NET "$BOX_IMAGE" node -e "$(cat "$2")" > "$L" 2>&1; RC=$?
else
  if grep -q 'npm/three@' "$1"; then NET=; NONET=; fi
  { printf '<script>window.__VW_TEST__=true;window.requestAnimationFrame=function(f){return setTimeout(function(){f(performance.now())},40)};window.cancelAnimationFrame=function(i){clearTimeout(i)};window.addEventListener("error",function(e){console.log("PAGEERR "+e.message)});</script>\n'; cat "$1"; printf '<script>\n'; cat "$2"; printf '\n</script>\n'; } > "$P"
  # (a suite that throws on purpose says so, and a page error then does not end it early)
  THROWS=; grep -q 'RTEST: page errors expected' "$2" && THROWS=1
  box_run "$P" $NET -e CLOCK="$CLOCK" -e NONET="$NONET" -e THROWS="$THROWS" "$BOX_IMAGE" sh -c '
    cat > /tmp/t.html; cd /tmp
    (timeout 1500 chromium --headless=new --no-sandbox --use-angle=gl-egl --use-gl=angle --ignore-gpu-blocklist --disable-dev-shm-usage --window-size=1400,800 ${NONET:+"--host-resolver-rules=MAP * ~NOTFOUND"} $CLOCK --enable-logging=stderr --v=0 file:///tmp/t.html >/tmp/dom.out 2>/tmp/chrome.log &)
    i=0; last=-1; still=0
    while [ $i -lt 700 ]; do
      sleep 2; i=$((i+1))
      if grep -q RESULTS /tmp/chrome.log 2>/dev/null; then sleep 3; break; fi
      if [ -z "$THROWS" ] && grep -qE "PAGEERR|Uncaught" /tmp/chrome.log 2>/dev/null; then sleep 6; break; fi
      if grep -qE "Tab Killed|Renderer process crashed" /tmp/chrome.log 2>/dev/null; then echo CRASHED the test tab was killed, most likely out of memory; break; fi
      if [ -s /tmp/dom.out ]; then sleep 2; grep -q RESULTS /tmp/chrome.log 2>/dev/null || echo TIMEOUT the page used up its time budget before printing RESULTS; break; fi
      sz=$(wc -c < /tmp/chrome.log 2>/dev/null || echo 0)
      if [ "$sz" = "$last" ]; then still=$((still+1)); else still=0; last=$sz; fi
      if [ $still -ge 120 ]; then echo STALLED no browser output for 4 minutes; break; fi
      pgrep chromium >/dev/null || break
    done
    grep -E "PAGEERR|TESTERR|Uncaught" /tmp/chrome.log | head -5
    grep -A2000 RESULTS /tmp/chrome.log | sed "s/^.*CONSOLE[^]]*\] *//; s/\", source:.*//"
  ' > "$L" 2>&1; RC=$?
fi
cat "$L"
# the whole container killed for memory reads the same as a killed tab
[ $RC -eq 137 ] && echo CRASHED the test container was killed, most likely out of memory
exit 0
