# testbox.sh (sourced by the test tools)   every run of the test browser is a one-shot container, so when nothing is testing
# no container exists at all:
# - box_image builds the image vaultwheel-test from tools/test-image when it is missing or its Dockerfile changed
# - box_take waits its turn. a browser takes up to 800 MB and a machine out of memory starts killing things that have
#   nothing to do with the tests, so runs start one at a time, a few seconds apart so the last one's memory shows, only with
#   BOX_ROOM_MB available, and at most BOX_SLOTS run at once on this machine, whichever copy of the repo they come from
# - the slot's lock is held for as long as the container's client lives, so a container in a slot nobody holds was left by
#   a kill, and the next start removes it
# - box_run is docker run --rm with the memory and cpu limits, in the background so a signal gets through at once, and the
#   container is removed on the way out, however the script ends
BOX_IMAGE=vaultwheel-test
BOX_SLOTS=${BOX_SLOTS:-2}
BOX_ROOM_MB=${BOX_ROOM_MB:-1500}
BOX_ROOM_WAIT=${BOX_ROOM_WAIT:-20}
BOX_LOCK=${TMPDIR:-/tmp}/vaultwheel-test-slot
BOX_TOOLS=$(cd "$(dirname "$0")" && pwd)
BOX=

box_image() {
  command -v docker >/dev/null 2>&1 || { echo "the test browser runs in docker, and docker is not here" >&2; exit 1; }
  sum=$(cksum < "$BOX_TOOLS/test-image/Dockerfile" | cut -d' ' -f1)
  [ "$(docker image inspect -f '{{index .Config.Labels "vaultwheel.sum"}}' "$BOX_IMAGE" 2>/dev/null)" = "$sum" ] && return 0
  (
    flock 8
    [ "$(docker image inspect -f '{{index .Config.Labels "vaultwheel.sum"}}' "$BOX_IMAGE" 2>/dev/null)" = "$sum" ] && exit 0
    echo "building the $BOX_IMAGE image, once" >&2
    docker build -q --label "vaultwheel.sum=$sum" -t "$BOX_IMAGE" "$BOX_TOOLS/test-image" >/dev/null
  ) 8>"$BOX_LOCK-build.lock" || { echo "could not build the $BOX_IMAGE image" >&2; exit 1; }
}

box_sweep() {
  for c in $(docker ps -a --filter "name=$BOX_IMAGE-" --format '{{.Names}}'); do
    n=${c#"$BOX_IMAGE"-}; n=${n%%-*}
    case "$n" in ''|*[!0-9]*) continue;; esac
    ( flock -n 8 && docker rm -f "$c" >/dev/null 2>&1 ) 8>"$BOX_LOCK-$n.lock"
  done
}

# waits for BOX_ROOM_MB available. with nothing of ours running there is nothing to wait for: it gives the machine BOX_ROOM_WAIT
# seconds and then goes alone, since a floor this machine can never reach must not hang a run
box_room() {
  [ -r /proc/meminfo ] || return 0
  w=0
  while :; do
    a=$(awk '/^MemAvailable:/{print int($2 / 1024)}' /proc/meminfo)
    [ "${a:-$BOX_ROOM_MB}" -ge "$BOX_ROOM_MB" ] && return 0
    if [ -z "$(docker ps -q --filter "name=$BOX_IMAGE-")" ]; then
      w=$((w + 2))
      if [ "$w" -ge "$BOX_ROOM_WAIT" ]; then echo "only $a MB available, running alone anyway" >&2; return 0; fi
    fi
    sleep 2
  done
}

box_take() {
  box_sweep
  exec 7>"$BOX_LOCK-start.lock"; flock 7
  box_room
  while :; do
    n=1
    while [ "$n" -le "$BOX_SLOTS" ]; do
      exec 9>"$BOX_LOCK-$n.lock"
      if flock -n 9; then
        BOX=$BOX_IMAGE-$n-$$
        # (the next start waits a little longer, on this sleep holding the lock)
        sleep 8 >/dev/null 2>&1 9>&- &
        exec 7>&-
        return 0
      fi
      n=$((n + 1))
    done
    sleep 1
  done
}

box_end() { [ -n "$BOX" ] && docker rm -f "$BOX" >/dev/null 2>&1; BOX=; }

# box_run <file for its stdin> <docker run options> <image> <command...>   gives the container's exit code
box_run() {
  in=$1; shift
  docker run --rm -i --name "$BOX" --memory=1g --cpus=2 -e EGL_PLATFORM=surfaceless "$@" < "$in" &
  wait $!; rc=$?
  BOX=
  return $rc
}
