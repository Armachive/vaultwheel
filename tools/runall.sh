#!/bin/sh
# tools/runall.sh [suite ...]   runs every test (or only those named) from one command, two at a time (RUNALL_JOBS), each
# in a one-shot container (see testbox.sh), and ends with one summary. it builds test pages from the made-up vault in
# tests/fixture, so it needs no personal files and no network. results land in build/runall.out (RUNALL_OUT=<file> for your
# own, so two runs at once never mix). every line must be PASS before a deploy; the exit code says so too.
# - a suite that throws on a slow start, or whose tab is killed (CRASHED, most likely out of memory), is run once more
# - a suite that prints no results at all reads as a failure
# - tests/<name>.budget names a suite's time budget, for one that waits on real work off the main thread
# - the bridge and live suites run on a build of that mode, on the real clock (RTEST_REAL); plugintest runs in node
BRIDGE=" keyfwdtest loadtest ctxbridgetest thumbtest oldplugintest plusbridgetest packtest "
LIVE=" ctxlivetest livetest thumblivetest packlivetest "
NODE=" plugintest "
S=$(cd "$(dirname "$0")/.." && pwd)

one_try() {
  case "$BRIDGE" in *" $1 "*) P=$W/bridge.html; R=1;; *) case "$LIVE" in *" $1 "*) P=$W/live.html; R=1;; *) P=$W/snapshot.html; R=;; esac;; esac
  case "$NODE" in *" $1 "*) RTEST_NODE=1; export RTEST_NODE; P=$S/plugin/main.js; R=;; esac
  B=60000; [ -f "$S/tests/$1.budget" ] && B=$(cat "$S/tests/$1.budget")
  RTEST_REAL=$R sh "$S/tools/rtest.sh" "$P" "$S/tests/$1.js" "$B" 2>&1 | grep -v "DEPRECATED\|ERROR:gpu\|AudioContext"
}

# one suite, run by a worker below
if [ "$1" = "--one" ]; then
  t=$2
  {
    echo "=== $t"
    if [ ! -f "$S/tests/$t.js" ]; then echo "FAIL $t is not a suite in tests/"; else
      R=$(one_try "$t")
      # (a suite that threw on a slow start, the page not ready when its first step came, gets a second try)
      if printf "%s\n" "$R" | grep -q "^FAIL threw"; then echo "($t threw, running it once more)"; R=$(one_try "$t"); fi
      if printf "%s\n" "$R" | grep -q '^CRASHED'; then echo "(the tab was killed, running $t once more)"; R=$(one_try "$t"); fi
      printf "%s\n" "$R"
      # a suite that printed no results at all (a page error ends it early) must not read as a clean run
      printf "%s\n" "$R" | grep -qE "^(PASS|FAIL) " || echo "FAIL $t printed no results"
    fi
  } > "$W/$t.out"
  echo "$t: $(grep -c '^PASS' "$W/$t.out") passed, $(grep -c '^FAIL' "$W/$t.out") failed"
  exit 0
fi

SUITES=$*
[ -n "$SUITES" ] || SUITES=$(cd "$S/tests" && ls *.js | sed 's/\.js$//')
W=$S/build/runall-$$; OUT=${RUNALL_OUT:-$S/build/runall.out}; export W
mkdir -p "$W"; G=
trap 'rm -rf "$W"' EXIT
# a kill stops the workers too; each rtest.sh takes its own container with it
trap '[ -n "$G" ] && kill -TERM -"$G" 2>/dev/null; exit 130' HUP INT TERM
needs() { for t in $SUITES; do case "$1" in *" $t "*) return 0;; esac; done; return 1; }
OTHER=
for t in $SUITES; do case "$BRIDGE$LIVE$NODE" in *" $t "*) ;; *) OTHER=1;; esac; done
export VW_TEST_BUILD=1
if [ -n "$OTHER" ]; then sh "$S/tools/build.sh" snapshot "$W/snapshot.html" light || exit 1; fi
if needs "$BRIDGE"; then sh "$S/tools/build.sh" bridge "$W/bridge.html" light || exit 1; fi
if needs "$LIVE"; then sh "$S/tools/build.sh" live "$W/live.html" light || exit 1; fi

printf '%s\n' $SUITES > "$W/list"
setsid xargs -P "${RUNALL_JOBS:-2}" -n 1 sh "$0" --one < "$W/list" &
G=$!; wait "$G"; G=
for t in $SUITES; do cat "$W/$t.out"; done > "$OUT"
awk '/^=== /{s=$2} /^(FAIL|CRASHED|STALLED|TIMEOUT)/{print s": "$0}' "$OUT" | cut -c1-240
NF=$(grep -c '^FAIL' "$OUT"); NC=$(grep -c '^CRASHED' "$OUT"); NT=$(grep -cE "^(TIMEOUT|STALLED)" "$OUT")
echo "=== $(grep -c '^PASS' "$OUT") passed, $NF failed, $NC crashed, $NT timed out"
[ "$NF$NC$NT" = "000" ]
