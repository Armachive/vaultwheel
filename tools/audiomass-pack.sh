#!/bin/sh
# audiomass-pack.sh   the AudioMass editor (vendor/audiomass/, MIT, unmodified) as one script and one stylesheet in
# build/: the scripts in the order its own index.html loads them (welcome.js left out: no intro screen in a panel), and
# main.css with its icon font inlined, so the editor runs inside the page with no files to fetch
S=$(cd "$(dirname "$0")/.." && pwd); A=$S/vendor/audiomass; mkdir -p "$S/build"
# (made under a name of its own and moved into place, so builds at once never read each other half written)
T="$S/build/audiomass-$$"
: > "$T.js"
for f in dist/wavesurfer.js dist/plugin/wavesurfer.regions.js oneup.js app.js keys.js markers.js contextmenu.js lufs.js ui-fx.js ui.js modal.js state.js engine.js actions.js drag.js recorder.js fx-pg-eq.js fx-auto.js local.js id3.js lzma.js amss-format.js multitrack.js; do
  cat "$A/$f" >> "$T.js"; printf '\n;\n' >> "$T.js"
done
FONT=$(base64 -w0 "$A/fonts/icomoon.woff")
sed "s|url('fonts/icomoon.woff')|url(data:font/woff;base64,$FONT)|; s|url('fonts/icomoon[^)]*)|url(data:font/woff;base64,$FONT)|g" "$A/main.css" > "$T.css"
mv -f "$T.js" "$S/build/audiomass.js"; mv -f "$T.css" "$S/build/audiomass.css"
