#!/bin/sh
# vendor-pack.sh <out.js>   the editors' libraries (vendor/) as one script that only holds them as base64 text on
# window.__VENDOR; the playground decodes and runs a library the first time its editor opens, so the page pays nothing
# for them until then. with no vendor/ folder the script is empty, and the editors say so
S=$(dirname "$0")/..
OUT=$1; : > "$OUT"
[ -d "$S/vendor" ] || exit 0
printf 'window.__VENDOR={' > "$OUT"
sep=''
sh "$S/tools/audiomass-pack.sh"
for pair in cropper:cropper-1.6.2.min.js cropperCss:cropper-1.6.2.min.css clip:clip/clip.html mp4muxer:clip/mp4-muxer-5.0.1.mjs gifenc:clip/gifenc-1.0.3.esm.js audiomass:../build/audiomass.js audiomassCss:../build/audiomass.css lameWorker:audiomass/lame.js wavWorker:audiomass/wav.js; do
  k=${pair%%:*}; f=$S/vendor/${pair#*:}
  [ -f "$f" ] || continue
  printf '%s"%s":"' "$sep" "$k" >> "$OUT"; base64 -w0 "$f" >> "$OUT"; printf '"' >> "$OUT"; sep=','
done
printf '};\n' >> "$OUT"
