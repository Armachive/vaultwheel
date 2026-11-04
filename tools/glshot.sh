#!/bin/sh
# glshot.sh <final.html> <out.png> "<js after load>" [w h] [budget]   a screenshot of the page at w x h from a one-shot
# container, with the 3D scene captured from its canvas (headless chromium does not put WebGL in its own screenshots)
# - the browser window is made 143 px taller than asked, since headless chromium takes that off the page's height, so the
#   page really is w x h
# - headless chromium will not go narrower than 500 px, so for a phone width the page's app is pinned to w instead
# - the captured scene is laid exactly over the live canvas (same box), and the live canvas is hidden under it, so nothing
#   is stretched and nothing shows through where the capture is see-through
# - the png is cut to w x h at the end
. "$(dirname "$0")/testbox.sh"
O=$2; mkdir -p "$(dirname "$O")"
W=${4:-1400}; H=${5:-800}; B=${6:-15000}
# the js waits for the first cards, however long a slow machine takes, and the capture comes CAP - 3500 ms after it
D=$((${CAP:-5200} - 3500)); [ "$D" -lt 200 ] && D=200
WW=$W; [ "$WW" -lt 500 ] && WW=500
WH=$((H + 143))
PIN=''
[ "$W" -lt 500 ] && PIN="var pin=document.createElement('style');pin.textContent='#app{position:absolute;left:0;top:0;width:${W}px!important;height:${H}px!important;overflow:hidden}';document.head.appendChild(pin);dispatchEvent(new Event('resize'));"
P=$(mktemp)
trap 'box_end; rm -f "$P"' EXIT
trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM
{ printf '<script>window.__VW_TEST__=true;window.__VW_SHOT__=true;window.requestAnimationFrame=function(f){return setTimeout(function(){f(performance.now())},60)};window.cancelAnimationFrame=function(i){clearTimeout(i)};window.addEventListener("error",function(e){console.log("PAGEERR "+e.message)});</script>\n'; cat "$1"
  printf "<script>addEventListener('load',function(){%s});setTimeout(function go(){var ok=false;try{ok=VW.items(0).length>0}catch(e){}if(!ok){setTimeout(go,200);return}try{%s}catch(e){console.log(\"TESTERR \"+e.message)}" "$PIN" "$3"
  printf "setTimeout(function(){var c=document.getElementById('gl'),st=document.getElementById('stage');var u=c.toDataURL('image/png');window.__VW_HALT__=true;console.log('CAPLEN '+u.length);var r=c.getBoundingClientRect(),s=st.getBoundingClientRect();var i=new Image();i.id='glcap';i.src=u;i.style.cssText='position:absolute;left:'+(r.left-s.left)+'px;top:'+(r.top-s.top)+'px;width:'+r.width+'px;height:'+r.height+'px;z-index:3;pointer-events:none';st.appendChild(i);c.style.visibility='hidden';},%s);},3500);</script>\n" "$D"; } > "$P"
# the cut, in plain node (no image library in the container): w x h from the top left, at the device scale
CUT=$(cat <<'JS'
const fs = require('fs'), zlib = require('zlib');
const src = fs.readFileSync('/tmp/o.png'); let i = 8, ihdr = null; const idat = [];
while (i < src.length) { const n = src.readUInt32BE(i), t = src.toString('latin1', i + 4, i + 8), d = src.subarray(i + 8, i + 8 + n); if (t === 'IHDR') ihdr = d; else if (t === 'IDAT') idat.push(d); i += 12 + n; }
const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4), depth = ihdr[8], ctype = ihdr[9];
if (depth === 8 && (ctype === 2 || ctype === 6) && ihdr[12] === 0) {
  const bpp = ctype === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), k = +process.env.K, cw = Math.min(w, Math.trunc(+process.env.W * k)), ch = Math.min(h, Math.trunc(+process.env.H * k));
  const stride = w * bpp, rows = []; let prev = Buffer.alloc(stride), p = 0;
  for (let y = 0; y < ch; y++) {
    const f = raw[p], line = Buffer.from(raw.subarray(p + 1, p + 1 + stride)); p += 1 + stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
    }
    rows.push(Buffer.concat([Buffer.from([0]), line.subarray(0, cw * bpp)])); prev = line;
  }
  const chunk = (t, d) => { const c = Buffer.concat([Buffer.from(t, 'latin1'), d]), a = Buffer.alloc(4), b = Buffer.alloc(4); a.writeUInt32BE(d.length); b.writeUInt32BE(zlib.crc32(c)); return Buffer.concat([a, c, b]); };
  const head = Buffer.alloc(13); head.writeUInt32BE(cw, 0); head.writeUInt32BE(ch, 4); head[8] = 8; head[9] = ctype;
  fs.writeFileSync('/tmp/o.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
}
JS
)
box_image; box_take
box_run "$P" -e W="$W" -e H="$H" -e WW="$WW" -e WH="$WH" -e B="$B" -e K="${DPR:-1}" -e CUT="$CUT" "$BOX_IMAGE" sh -c '
  cat > /tmp/p.html; cd /tmp
  timeout 300 chromium --headless=new --no-sandbox --use-angle=gl-egl --use-gl=angle --ignore-gpu-blocklist --disable-dev-shm-usage --hide-scrollbars --window-size=$WW,$WH --force-device-scale-factor=$K --virtual-time-budget=$B --enable-logging=stderr --v=0 --screenshot=/tmp/o.png file:///tmp/p.html >/tmp/chrome.log 2>&1
  grep -E "PAGEERR|TESTERR|Uncaught|CONSOLE" /tmp/chrome.log | sed "s/.*CONSOLE[^]]*\]//" | grep -v "GPU stall" | head -30 >&2
  if [ -f /tmp/o.png ]; then echo shot-ok >&2; node -e "$CUT" >&2; cat /tmp/o.png; else tail -4 /tmp/chrome.log >&2; echo shot-failed >&2; fi
' > "$O"
[ -s "$O" ] || rm -f "$O"
