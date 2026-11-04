/* VaultWheel card renderer, version 2. Draws one card face into a 2D canvas.
   The undercard, focus glow and selection highlight are separate 3D layers now,
   so this only draws: the pill border, fill, inset bevel, and the content. */
(function (global) {
  'use strict';

  // every overcard is built like the VaultWheel pill: card color, outline, light inset top left, dark inset bottom right.
  // edge is the outline width in card units, bloom is the soft glow on the highlight
  const SERIF = '"Libre Baskerville", Georgia, serif';
  let FACE = SERIF;   // the type on the card being drawn: an Obsidian theme brings its own
  const THEMES = {
    // dark: card #021109, outline #676991, light green highlight #53876e top left, #000d06 shade bottom right
    dark: {
      mode: 'dark', fill: '#021109', inset: '#010a05', line: '#676991', edge: 3.75,
      bevelLight: '#53876e', bloom: 'rgba(83,135,110,0.55)', bevelDark: '#000d06',
      text: '#e2e4f0', textMute: '#a3a6c2',
      select: 'oklch(0.88 0.13 172)', ctl: '#0a1d15'
    },
    // light, from Retroma light: card #e4fff2, bottom right #7575b8, the brightest white with a hint of bloom top left,
    // outline #809288 a touch thicker
    light: {
      mode: 'light', fill: '#e4fff2', inset: '#d6efe2', line: '#809288', edge: 4.5,
      bevelLight: '#ffffff', bloom: 'rgba(255,255,255,0.95)', bevelDark: '#7575b8',
      text: 'oklch(0.34 0.045 282.86)', textMute: 'oklch(0.48 0.045 282.86)',
      select: 'oklch(0.80 0.14 225)', ctl: '#d6efe2'
    }
  };

  // undercard colors. folder grey, base counts as obsidian, junk near black, code cherry
  const TYPES = {
    folder:   { color: 'oklch(0.80 0.006 282)', icon: 'folder' },
    blender:  { color: 'oklch(0.76 0.15 62)',  icon: 'cube' },
    obsidian: { color: 'oklch(0.66 0.16 305)', icon: 'canvas' },
    base:     { color: 'oklch(0.66 0.16 305)', icon: 'base' },
    text:     { color: 'oklch(0.86 0.14 98)',  icon: 'text' },
    gif:      { color: 'oklch(0.86 0.14 98)',  icon: 'image', media: 'image' },
    audio:    { color: 'oklch(0.74 0.15 145)', icon: 'audio', media: 'audio' },
    flp:      { color: 'oklch(0.74 0.15 145)', icon: 'audio', pattern: 'flp' },
    video:    { color: 'oklch(0.70 0.13 245)', icon: 'video', media: 'video' },
    image:    { color: 'oklch(0.78 0.11 30)',  icon: 'image', media: 'image' },
    code:     { color: 'oklch(0.62 0.20 355)', icon: 'code' },
    junk:     { color: 'oklch(0.24 0.008 282)', icon: 'file' },
    other:    { color: 'oklch(0.66 0.012 282)', icon: 'file' },
    // a file with no extension has no type to show: a question mark until it has one
    mystery:  { color: 'oklch(0.66 0.012 282)', icon: 'mystery' }
  };
  const EXT = {
    blend: 'blender', blend1: 'blender', obj: 'blender', fbx: 'blender', glb: 'blender', gltf: 'blender', abc: 'blender', usd: 'blender', mtl: 'blender',
    canvas: 'obsidian', excalidraw: 'obsidian', base: 'base',
    md: 'text', txt: 'text', rtf: 'text',
    mp3: 'audio', wav: 'audio', opus: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio', aac: 'audio', flp: 'flp',
    mp4: 'video', mov: 'video', mkv: 'video', webm: 'video', avi: 'video', m4v: 'video',
    png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', bmp: 'image', svg: 'image', avif: 'image', gif: 'gif',
    py: 'code', js: 'code', ts: 'code', json: 'code', css: 'code', html: 'code', sh: 'code', lua: 'code',
    db: 'junk', pyc: 'junk', ico: 'junk', lnk: 'junk', tmp: 'junk', pdf: 'junk', ini: 'junk', log: 'junk'
  };
  function typeOf(name, isDir) {
    if (isDir) return 'folder';
    const n = name.toLowerCase();
    if (n.endsWith('.excalidraw.md') || n.endsWith('.excalidraw')) return 'obsidian';
    const dot = n.lastIndexOf('.');
    return dot > 0 ? (EXT[n.slice(dot + 1)] || 'other') : 'mystery';
  }
  function displayName(name, isDir) {
    if (isDir) return name;
    const n = name.toLowerCase();
    if (n.endsWith('.excalidraw.md')) return name.slice(0, -14);
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
  }
  // frame aspect for pictures and videos: their own shape, held between these so a very wide or very tall one neither
  // dominates a row nor vanishes (the card crops what is past them)
  const FRAME_MIN = 0.5, FRAME_MAX = 2.2;
  function frameAspect(w, h) {
    if (!w || !h) return 4 / 3;
    return Math.min(FRAME_MAX, Math.max(FRAME_MIN, w / h));
  }

  const _cc = {}; let _cx = null;
  function rgbOf(css) {
    if (_cc[css]) return _cc[css];
    if (!_cx) { const c = document.createElement('canvas'); c.width = c.height = 1; _cx = c.getContext('2d', { willReadFrequently: true }); }
    _cx.clearRect(0, 0, 1, 1); _cx.fillStyle = '#000'; _cx.fillStyle = css; _cx.fillRect(0, 0, 1, 1);
    const d = _cx.getImageData(0, 0, 1, 1).data; return (_cc[css] = [d[0], d[1], d[2], d[3] / 255]);
  }
  function mix(a, b, t) { const p = rgbOf(a), q = rgbOf(b); return 'rgb(' + [0, 1, 2].map(i => Math.round(p[i] + (q[i] - p[i]) * t)).join(',') + ')'; }
  function rgba(css, alpha) { const p = rgbOf(css); return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + alpha + ')'; }

  function rr(x, px, py, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
  }
  // pill proportions: 32px tall, 2px border, 2px insets, 10px corners. RAD is shared with the 3D card shape
  const RAD = 31, EDGE = 6.25;
  function frameBox(x, T, px, py, w, h, u, opt) {
    // the border is one solid rounded rect so no seam shows where the fill meets it.
    // returns the inner (padding box) rect for the fill, bevel and content
    const R = (opt && opt.r) || RAD * u, W = (T.edge || EDGE) * u * ((opt && opt.thick) || 1);
    x.beginPath(); rr(x, px, py, w, h, R); x.fillStyle = T.line; x.fill();
    const ix = px + W, iy = py + W, iw = w - 2 * W, ih = h - 2 * W, ir = Math.max(2 * u, R - W);
    return { ix, iy, iw, ih, ir, B: EDGE * u, u };
  }
  // the inset shadows (Retroma's 3D button at 135 degrees): dark band bottom right, then the light band top left
  // on top of it with a small soft bloom spilling into the card
  // over a picture the bands lie on top of it, part see-through, so the only hard edge is the card's own outline
  function bevel(x, T, b, over) {
    const { ix, iy, iw, ih, ir, B, u } = b;
    x.save(); x.beginPath(); rr(x, ix, iy, iw, ih, ir); x.clip();
    if (over) x.globalAlpha = 0.72;
    x.beginPath(); rr(x, ix, iy, iw, ih, ir); rr(x, ix - B, iy - B, iw, ih, ir); x.fillStyle = T.bevelDark; x.fill('evenodd');
    x.shadowColor = T.bloom; x.shadowBlur = 2.4 * u;
    x.beginPath(); rr(x, ix, iy, iw, ih, ir); rr(x, ix + B, iy + B, iw, ih, ir); x.fillStyle = T.bevelLight; x.fill('evenodd');
    x.restore();
  }

  /* ---------- icons, drawn in a unit box ---------- */
  function icon(x, kind, px, py, s, color) {
    x.save(); x.translate(px, py); x.scale(s, s);
    x.strokeStyle = color; x.fillStyle = color; x.lineWidth = 0.085; x.lineJoin = 'round'; x.lineCap = 'round';
    const page = () => { x.beginPath(); x.moveTo(0.18, 0.05); x.lineTo(0.62, 0.05); x.lineTo(0.84, 0.27); x.lineTo(0.84, 0.95); x.lineTo(0.18, 0.95); x.closePath(); x.stroke();
      x.beginPath(); x.moveTo(0.62, 0.05); x.lineTo(0.62, 0.27); x.lineTo(0.84, 0.27); x.stroke(); };
    switch (kind) {
      case 'folder':
        x.beginPath(); x.moveTo(0.04, 0.22); x.lineTo(0.38, 0.22); x.lineTo(0.47, 0.32); x.lineTo(0.96, 0.32); x.lineTo(0.96, 0.88); x.lineTo(0.04, 0.88); x.closePath();
        x.globalAlpha = 0.9; x.fill(); x.globalAlpha = 1; break;
      case 'text':
        page(); x.beginPath(); [0.45, 0.6, 0.75].forEach(y => { x.moveTo(0.3, y); x.lineTo(0.72, y); }); x.stroke(); break;
      case 'canvas':
        [[0.05, 0.08], [0.6, 0.08], [0.32, 0.6]].forEach(([a, b]) => { x.beginPath(); rr(x, a, b, 0.36, 0.3, 0.07); x.stroke(); });
        x.beginPath(); x.moveTo(0.41, 0.23); x.lineTo(0.6, 0.23); x.moveTo(0.23, 0.38); x.lineTo(0.4, 0.6); x.moveTo(0.78, 0.38); x.lineTo(0.6, 0.6); x.stroke(); break;
      case 'cube':
        x.beginPath(); x.moveTo(0.5, 0.06); x.lineTo(0.9, 0.28); x.lineTo(0.9, 0.72); x.lineTo(0.5, 0.94); x.lineTo(0.1, 0.72); x.lineTo(0.1, 0.28); x.closePath();
        x.moveTo(0.1, 0.28); x.lineTo(0.5, 0.5); x.lineTo(0.9, 0.28); x.moveTo(0.5, 0.5); x.lineTo(0.5, 0.94); x.stroke(); break;
      case 'audio':
        x.beginPath(); x.moveTo(0.42, 0.75); x.lineTo(0.42, 0.12); x.quadraticCurveTo(0.62, 0.2, 0.78, 0.36); x.stroke();
        x.beginPath(); x.ellipse(0.3, 0.76, 0.15, 0.11, -0.4, 0, Math.PI * 2); x.fill(); break;
      case 'video':
        x.beginPath(); rr(x, 0.04, 0.16, 0.92, 0.68, 0.12); x.stroke();
        x.beginPath(); x.moveTo(0.4, 0.33); x.lineTo(0.68, 0.5); x.lineTo(0.4, 0.67); x.closePath(); x.fill(); break;
      case 'base':
        x.beginPath(); rr(x, 0.06, 0.1, 0.88, 0.8, 0.1); x.stroke();
        x.beginPath(); x.moveTo(0.06, 0.37); x.lineTo(0.94, 0.37); x.moveTo(0.06, 0.63); x.lineTo(0.94, 0.63); x.moveTo(0.38, 0.1); x.lineTo(0.38, 0.9); x.stroke(); break;
      case 'image':
        x.beginPath(); rr(x, 0.05, 0.12, 0.9, 0.76, 0.1); x.stroke();
        x.beginPath(); x.moveTo(0.12, 0.8); x.lineTo(0.38, 0.48); x.lineTo(0.56, 0.68); x.lineTo(0.68, 0.56); x.lineTo(0.88, 0.8); x.closePath(); x.fill();
        x.beginPath(); x.arc(0.7, 0.33, 0.08, 0, Math.PI * 2); x.fill(); break;
      case 'code':
        x.beginPath(); x.moveTo(0.34, 0.24); x.lineTo(0.08, 0.5); x.lineTo(0.34, 0.76); x.moveTo(0.66, 0.24); x.lineTo(0.92, 0.5); x.lineTo(0.66, 0.76);
        x.moveTo(0.58, 0.14); x.lineTo(0.42, 0.86); x.stroke(); break;
      case 'mystery':
        x.beginPath(); x.arc(0.5, 0.3, 0.22, -Math.PI * 0.95, Math.PI * 0.3); x.quadraticCurveTo(0.5, 0.5, 0.5, 0.66); x.stroke();
        x.beginPath(); x.arc(0.5, 0.86, 0.065, 0, Math.PI * 2); x.fill(); break;
      case 'loop':
        x.beginPath(); x.arc(0.5, 0.5, 0.32, -2.6, 2.2); x.stroke();
        x.beginPath(); x.moveTo(0.18, 0.12); x.lineTo(0.16, 0.36); x.lineTo(0.4, 0.34); x.stroke(); break;
      case 'volume':
        x.beginPath(); x.moveTo(0.08, 0.38); x.lineTo(0.28, 0.38); x.lineTo(0.5, 0.18); x.lineTo(0.5, 0.82); x.lineTo(0.28, 0.62); x.lineTo(0.08, 0.62); x.closePath(); x.fill();
        x.beginPath(); x.arc(0.52, 0.5, 0.2, -0.9, 0.9); x.stroke(); x.beginPath(); x.arc(0.52, 0.5, 0.36, -0.9, 0.9); x.stroke(); break;
      default:
        page(); break;
    }
    x.restore();
  }

  function marqueeText(x, label, tx, ty, tw, fs, phase, fill, cy, ch) {
    const full = x.measureText(label).width;
    if (full <= tw) { x.fillText(label, tx, ty); return false; }
    const travel = full - tw + fs * 0.6;
    const ph = phase || 0;
    const k = ph < 0.15 ? 0 : ph < 0.5 ? (ph - 0.15) / 0.35 : ph < 0.65 ? 1 : 1 - (ph - 0.65) / 0.35;
    const e = k * k * (3 - 2 * k);
    x.fillText(label, tx - travel * e, ty);
    if (fill) {
      const fw = fs * 1.1, clear = rgba(fill, 0);
      const gl = x.createLinearGradient(tx, 0, tx + fw, 0); gl.addColorStop(0, fill); gl.addColorStop(1, clear);
      const gr = x.createLinearGradient(tx + tw - fw, 0, tx + tw, 0); gr.addColorStop(0, clear); gr.addColorStop(1, fill);
      if (e > 0.02) { x.fillStyle = gl; x.fillRect(tx, cy, fw, ch); }
      if (e < 0.98) { x.fillStyle = gr; x.fillRect(tx + tw - fw, cy, fw, ch); }
    }
    return true;
  }
  // clips to the face inside its bevel (a rounded rect), so a long name's edge fades, painted in the face colour, never
  // square off the bevel at a rounded corner
  function faceClip(x, b) { const { ix, iy, iw, ih, ir, B, u } = b; x.beginPath(); rr(x, ix + B, iy + B, iw - 2 * B, ih - 2 * B, Math.max(2 * u, ir - B)); x.clip(); }
  function fmtTime(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  /* ---------- the card face ----------
     spec: { theme, name, isDir, kind?, thumb (canvas|image), placeholder (bool), scroll (marquee phase),
             audio: { progress, duration, playing, loop, muted } }
     returns { scrolling, kind, hit?, nameBox? } so the caller knows whether to keep animating, where the audio buttons
     are, and where the name sits ([x, y, w, h, font size], so a rename can be typed right over it) */
  function drawCard(x, w, h, spec) {
    const T = THEMES[spec.theme || 'light'];
    FACE = T.font || SERIF;
    const kind = spec.kind || typeOf(spec.name, spec.isDir);
    const typ = TYPES[kind];
    const u = Math.min(h, w * 0.3) / 100;
    x.clearRect(0, 0, w, h);
    // picture, video and audio cards get a thicker frame
    const b = frameBox(x, T, 0, 0, w, h, u, { thick: typ.media || kind === 'audio' ? 1.15 : 1 });
    const { ix, iy, iw, ih, ir, B } = b;
    if (spec.blank) { x.beginPath(); rr(x, ix, iy, iw, ih, ir); x.fillStyle = T.fill; x.fill(); bevel(x, T, b); return { scrolling: false, kind }; }
    if (spec.stack) {
      // the stack card: no name, one icon in its type's colour for each kind carried and how many of it, spread evenly
      // over the card and shrinking as kinds are added. folders get the rainbow (only here). the selection shows as the
      // 3D rim round the card, so the face is not tinted
      x.beginPath(); rr(x, ix, iy, iw, ih, ir); x.fillStyle = T.fill; x.fill(); bevel(x, T, b);
      const L = spec.stack, n = Math.max(1, L.length), cw = iw - 2 * B, slot = cw / n, chh = ih - 2 * B;
      // (compact: icons only, bigger, when the card is too small for a count to be read)
      const cp = !!spec.compact, is = cp ? Math.min(chh * 0.78, slot * 0.82) : Math.min(chh * 0.56, slot * 0.4), fs = is * 0.78, gap = is * 0.14, cy = iy + ih / 2;
      x.font = '700 ' + fs + 'px ' + FACE; x.textBaseline = 'middle';
      L.forEach((s, i) => {
        const t = TYPES[s.kind] || TYPES.other, label = String(s.n), total = cp ? is : is + gap + x.measureText(label).width;
        const sx = ix + B + slot * i + (slot - total) / 2;
        const col = stackInk(x, T, s.kind, t.color);
        x.save(); x.shadowColor = s.kind === 'folder' ? 'rgba(255,255,255,0.55)' : rgba(t.color, 0.65); x.shadowBlur = is * 0.28;
        icon(x, t.icon, sx, cy - is / 2, is, col);
        if (!cp) { x.fillStyle = T.text; x.fillText(label, sx + is + gap, cy + fs * 0.04); }
        x.restore();
      });
      return { scrolling: false, kind };
    }
    let scrolling = false;
    const media = typ.media;
    const label = displayName(spec.name, spec.isDir);

    // a song in a collage is drawn like a video: its cover (or its color with a note) fills a 4:3 tile, a big play mark
    // while it is stopped, and the name and the transport (play, progress, time) along the bottom
    const songTile = kind === 'audio' && spec.audio && spec.tile;
    if (media === 'image' || media === 'video' || songTile) {
      // the picture fills the frame, cropped from the center
      x.save(); x.beginPath(); rr(x, ix, iy, iw, ih, ir); x.clip();
      x.fillStyle = T.inset; x.fillRect(ix, iy, iw, ih);
      if (spec.thumb && !spec.placeholder) {
        const im = spec.thumb, [w0, h0] = srcSize(im), s = Math.max(iw / w0, ih / h0);
        const dw = w0 * s, dh = h0 * s;
        x.drawImage(im, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh);
      } else if (songTile) {
        const gg = x.createLinearGradient(ix, iy, ix + iw, iy + ih);
        gg.addColorStop(0, typ.color); gg.addColorStop(1, mix(typ.color, '#000', 0.45));
        x.fillStyle = gg; x.fillRect(ix, iy, iw, ih);
        // (the note shows only while it plays: stopped, the big play mark sits on the same spot and the two blur together)
        const is = Math.min(iw, ih) * 0.4;
        if (spec.audio.playing) { x.globalAlpha = 0.5; icon(x, 'audio', ix + (iw - is) / 2, iy + (ih - is) / 2 - ih * 0.07, is, '#fff'); x.globalAlpha = 1; }
      } else {
        const is = Math.min(iw, ih) * 0.4;
        x.globalAlpha = 0.32; icon(x, media === 'video' ? 'video' : 'image', ix + (iw - is) / 2, iy + (ih - is) / 2 - ih * 0.07, is, T.textMute); x.globalAlpha = 1;
      }
      const V = media === 'video' ? (spec.video || { progress: 0, duration: 0, playing: false }) : songTile ? spec.audio : null;
      let playBig = null;
      if (V && !V.playing) {   // big play mark while stopped; it is a button too
        const pr = Math.min(iw, ih) * 0.11, pcx = ix + iw / 2, pcy = iy + ih * 0.4;
        x.beginPath(); x.arc(pcx, pcy, pr, 0, Math.PI * 2); x.fillStyle = 'rgba(0,0,0,0.38)'; x.fill();
        x.beginPath(); x.moveTo(pcx - pr * 0.35, pcy - pr * 0.5); x.lineTo(pcx + pr * 0.55, pcy); x.lineTo(pcx - pr * 0.35, pcy + pr * 0.5); x.closePath(); x.fillStyle = '#fff'; x.fill();
        playBig = [pcx - pr * 1.3, pcy - pr * 1.3, pr * 2.6, pr * 2.6];
      }
      // name (and for video, the transport) on a gradient along the bottom, inside the frame
      // (a tall narrow picture's u comes from its width, which left its name a few px tall; its name gets a little more room)
      const lu = !V && w < h ? Math.max(u, Math.min(h * 0.3, w * 0.5) / 100) : u;
      const gh = Math.min(ih * (V ? 0.5 : 0.4), (V ? 58 : 36) * lu);
      const g = x.createLinearGradient(0, iy + ih - gh, 0, iy + ih);
      const base = T.bevelDark;   // the theme's shade color, same as the band along the bottom and right
      g.addColorStop(0, rgba(base, 0)); g.addColorStop(0.5, rgba(base, 0.74)); g.addColorStop(1, rgba(base, 0.92));
      x.fillStyle = g; x.fillRect(ix, iy + ih - gh, iw, gh);
      const fs = Math.min(gh * (V ? 0.25 : 0.42), 15 * lu);
      // over the shade a picture's name and transport are light in both themes (dark ink on the light theme's purple shade is too faint)
      const ink = T.mode === 'light' ? '#f4fff9' : T.text;
      x.font = '400 ' + fs + 'px ' + FACE; x.textBaseline = 'middle'; x.fillStyle = ink;
      const tx = ix + B + 6 * u, tw = iw - 2 * B - 12 * u;
      x.save(); x.beginPath(); x.rect(tx, iy + ih - gh, tw, gh); x.clip();
      scrolling = marqueeText(x, label, tx, iy + ih - gh * (V ? 0.66 : 0.36), tw, fs, spec.scroll, null);
      x.restore();
      const nameBox = [tx, iy + ih - gh * (V ? 0.66 : 0.36) - fs * 0.8, tw, fs * 1.6, fs];
      let hit = null;
      if (V) {
        const ry = iy + ih - gh * 0.26, bs = gh * 0.32;
        x.beginPath(); x.arc(tx + bs / 2, ry, bs / 2, 0, Math.PI * 2); x.fillStyle = V.playing ? typ.color : rgba(ink, 0.18); x.fill();
        x.lineWidth = 1.2 * u; x.strokeStyle = rgba(ink, 0.6); x.stroke();
        const pcx = tx + bs / 2;
        x.fillStyle = V.playing ? '#10130f' : ink;
        if (V.playing) { x.fillRect(pcx - bs * 0.16, ry - bs * 0.18, bs * 0.11, bs * 0.36); x.fillRect(pcx + bs * 0.05, ry - bs * 0.18, bs * 0.11, bs * 0.36); }
        else { x.beginPath(); x.moveTo(pcx - bs * 0.09, ry - bs * 0.18); x.lineTo(pcx + bs * 0.18, ry); x.lineTo(pcx - bs * 0.09, ry + bs * 0.18); x.closePath(); x.fill(); }
        const tfs = fs * 0.8; x.font = '400 ' + tfs + 'px ' + FACE;
        const tl = fmtTime((V.progress || 0) * (V.duration || 0)) + ' / ' + fmtTime(V.duration || 0), tW = x.measureText(tl).width;
        const sx = tx + bs + 7 * u, sw = Math.max(10 * u, tx + tw - tW - 7 * u - sx), th = bs * 0.26;
        x.beginPath(); rr(x, sx, ry - th / 2, sw, th, th / 2); x.fillStyle = rgba(ink, 0.2); x.fill();
        x.beginPath(); rr(x, sx, ry - th / 2, Math.max(th, sw * (V.progress || 0)), th, th / 2); x.fillStyle = typ.color; x.fill();
        x.beginPath(); x.arc(sx + sw * (V.progress || 0), ry, th * 0.95, 0, Math.PI * 2); x.fillStyle = ink; x.fill();
        x.fillStyle = rgba(ink, 0.85); x.fillText(tl, tx + tw - tW, ry);
        hit = { play: [tx, ry - bs / 2, bs, bs], track: [sx, ry - bs / 2, sw, bs], playBig };
      }
      x.globalAlpha = 1;
      x.restore();
      bevel(x, T, b, true);
      return { scrolling, kind, hit, nameBox };
    }


    x.beginPath(); rr(x, ix, iy, iw, ih, ir); x.fillStyle = T.fill; x.fill();
    bevel(x, T, b);
    const cx = ix + B + 7 * u, cy = iy + B, cw = iw - 2 * B - 14 * u, ch = ih - 2 * B;

    if (media === 'audio' && spec.audio) {
      // album art in a mini frame, then title, then the transport row
      const A = spec.audio, artS = ch * 0.9, ax = cx - 3 * u, ay = cy + (ch - artS) / 2;
      const su = u * 0.6;
      const fb = frameBox(x, T, ax, ay, artS, artS, su, { r: 11 * su });
      x.save(); x.beginPath(); rr(x, fb.ix, fb.iy, fb.iw, fb.ih, fb.ir); x.clip();
      if (spec.thumb && !spec.placeholder) {
        const im = spec.thumb, [w0, h0] = srcSize(im), s = Math.max(fb.iw / w0, fb.ih / h0);
        x.drawImage(im, fb.ix + (fb.iw - w0 * s) / 2, fb.iy + (fb.ih - h0 * s) / 2, w0 * s, h0 * s);
      } else {
        const gg = x.createLinearGradient(fb.ix, fb.iy, fb.ix + fb.iw, fb.iy + fb.ih);
        gg.addColorStop(0, typ.color); gg.addColorStop(1, mix(typ.color, '#000', 0.45));
        x.fillStyle = gg; x.fillRect(fb.ix, fb.iy, fb.iw, fb.ih);
        icon(x, 'audio', fb.ix + fb.iw * 0.2, fb.iy + fb.ih * 0.18, fb.iw * 0.6, 'rgba(255,255,255,0.88)');
      }
      x.restore();
      bevel(x, T, fb);
      // the button trio fills a square on the right the same size as the art: play on top, loop and volume under it
      const qx = cx + cw + 3 * u - artS, qy = ay, bu = u * 0.45;
      const pb = artS * 0.6, bs = artS * 0.43;
      const btn = (bx, by, size, active) => {
        const fb2 = frameBox(x, T, bx, by, size, size, bu, { r: size * 0.5 });
        x.beginPath(); rr(x, fb2.ix, fb2.iy, fb2.iw, fb2.ih, fb2.ir); x.fillStyle = active ? typ.color : T.ctl; x.fill(); bevel(x, T, fb2);
      };
      const px = qx + (artS - pb) / 2, py = qy, lx = qx, vx = qx + artS - bs, by = qy + artS - bs;
      btn(px, py, pb, A.playing);
      const pcx = px + pb / 2, pcy = py + pb / 2;
      x.fillStyle = A.playing ? '#10130f' : T.text;
      if (A.playing) { x.fillRect(pcx - pb * 0.15, pcy - pb * 0.17, pb * 0.1, pb * 0.34); x.fillRect(pcx + pb * 0.05, pcy - pb * 0.17, pb * 0.1, pb * 0.34); }
      else { x.beginPath(); x.moveTo(pcx - pb * 0.08, pcy - pb * 0.17); x.lineTo(pcx + pb * 0.17, pcy); x.lineTo(pcx - pb * 0.08, pcy + pb * 0.17); x.closePath(); x.fill(); }
      btn(lx, by, bs, A.loop); icon(x, 'loop', lx + bs * 0.24, by + bs * 0.24, bs * 0.52, A.loop ? '#10130f' : T.text);
      btn(vx, by, bs, A.muted); icon(x, 'volume', vx + bs * 0.24, by + bs * 0.24, bs * 0.52, A.muted ? '#10130f' : T.text);
      // title, then the time under it, then the playbar a little lower
      const tx = ax + artS + 10 * u, tw = Math.max(10 * u, qx - 10 * u - tx);
      const fs = ch * 0.22, tfs = fs * 0.66;
      x.font = '400 ' + fs + 'px ' + FACE; x.fillStyle = T.text; x.textBaseline = 'middle';
      x.save(); faceClip(x, b); x.beginPath(); x.rect(tx, cy, tw, ch * 0.42); x.clip();
      scrolling = marqueeText(x, label, tx, cy + ch * 0.23, tw, fs, spec.scroll, T.fill, cy, ch * 0.42);
      x.restore();
      x.font = '400 ' + tfs + 'px ' + FACE; x.textBaseline = 'middle'; x.fillStyle = T.textMute;
      x.fillText(fmtTime((A.progress || 0) * (A.duration || 0)) + ' / ' + fmtTime(A.duration || 0), tx, cy + ch * 0.53);
      const ry = cy + ch * 0.78, th = ch * 0.096, sx = tx, sw = tw;
      x.beginPath(); rr(x, sx, ry - th / 2, sw, th, th / 2); x.fillStyle = T.inset; x.fill(); x.lineWidth = 1.2 * u; x.strokeStyle = T.line; x.stroke();
      x.beginPath(); rr(x, sx, ry - th / 2, Math.max(th, sw * (A.progress || 0)), th, th / 2); x.fillStyle = typ.color; x.fill();
      x.beginPath(); x.arc(sx + sw * (A.progress || 0), ry, th * 0.95, 0, Math.PI * 2); x.fillStyle = T.text; x.fill();
      return { scrolling, kind, hit: { play: [px, py, pb, pb], loop: [lx, by, bs, bs], volume: [vx, by, bs, bs], track: [sx, ry - ch * 0.15, sw, ch * 0.3] }, nameBox: [tx, cy + ch * 0.23 - fs * 0.8, tw, fs * 1.6, fs] };
    }

    // the type icon in its type's colour with a small bloom (folders and odd files stay grey)
    // (a new file being named shows the icon of the type its name has so far, spec.iconKind)
    const shown = spec.iconKind || kind, st = TYPES[shown];
    const iconS = ch * 0.5, plain = shown === 'folder' || shown === 'other' || shown === 'junk' || shown === 'mystery';
    x.save(); if (!plain) { x.shadowColor = rgba(st.color, 0.6); x.shadowBlur = iconS * 0.22; }
    icon(x, st.icon, cx, cy + (ch - iconS) / 2, iconS, plain ? T.textMute : iconInk(T, shown, st.color));
    x.restore();
    const tx = cx + iconS + 8 * u, tw = cx + cw - tx;
    // long names drop to a smaller size before the marquee has to take over
    const fs = 0.38 * ch * (label.length > 16 ? 0.86 : 1);
    x.font = (spec.isDir ? '700 ' : '400 ') + fs + 'px ' + FACE;
    x.textBaseline = 'middle'; x.fillStyle = T.text;
    if (spec.wrap) {
      // a card that can take any shape (the playground's): the name wraps onto as many lines as the card's height holds,
      // at the biggest size that fits (down to a third of the one line size), instead of scrolling. a word longer than
      // the width breaks inside, and lines that still do not fit end in an ellipsis
      const weight = spec.isDir ? '700 ' : '400 ', font = s => x.font = weight + s + 'px ' + FACE;
      const wrapAt = s => {
        font(s); const out = []; let line = '';
        for (const word of label.split(/\s+/).filter(Boolean)) {
          let wd = word;
          while (x.measureText(wd).width > tw) {            // a word wider than the line is cut where it stops fitting
            let k = wd.length; while (k > 1 && x.measureText(wd.slice(0, k)).width > tw) k--;
            if (line) { out.push(line); line = ''; }
            out.push(wd.slice(0, k)); wd = wd.slice(k);
          }
          const tryLine = line ? line + ' ' + wd : wd;
          if (x.measureText(tryLine).width <= tw) line = tryLine; else { if (line) out.push(line); line = wd; }
        }
        if (line) out.push(line);
        return out;
      };
      let s = fs, lines = wrapAt(s);
      while (lines.length * s * 1.2 > ch && s > fs / 3) { s *= 0.92; lines = wrapAt(s); }
      const lh = s * 1.2, room = Math.max(1, Math.floor(ch / lh));
      if (lines.length > room) { lines = lines.slice(0, room); let l = lines[room - 1] + '…'; while (l.length > 1 && x.measureText(l).width > tw) l = l.slice(0, -2) + '…'; lines[room - 1] = l; }
      x.save(); faceClip(x, b); x.beginPath(); x.rect(tx, cy, tw, ch); x.clip();
      const y0 = cy + ch / 2 - (lines.length - 1) * lh / 2 + s * 0.06;
      lines.forEach((l, i) => x.fillText(l, tx, y0 + i * lh));
      x.restore();
      return { scrolling: false, kind };
    }
    x.save(); faceClip(x, b); x.beginPath(); x.rect(tx, cy, tw, ch); x.clip();
    scrolling = marqueeText(x, label, tx, cy + ch * 0.53, tw, fs, spec.scroll, T.fill, cy, ch);
    x.restore();
    return { scrolling, kind, nameBox: [tx, cy + ch * 0.53 - fs * 0.8, tw, fs * 1.6, fs] };
  }

  // the undercard surface: type color with a soft sheen; flp gets its orange sparkle
  function drawUnder(x, w, h, kind) {
    const typ = TYPES[kind] || TYPES.other;
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, mix(typ.color, '#fff', 0.12)); g.addColorStop(1, mix(typ.color, '#000', 0.22));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    if (typ.pattern === 'flp') {
      x.save(); x.globalAlpha = 0.5;
      const og = x.createLinearGradient(0, 0, w, 0); og.addColorStop(0, '#ffb547'); og.addColorStop(0.5, '#ff7a1a'); og.addColorStop(1, '#ffd36b');
      x.fillStyle = og;
      for (let i = 0; i < 26; i++) {
        const sx = ((i * 0.6180339) % 1) * w, sy = ((i * 0.3819660 + 0.13) % 1) * h, r = h * (0.06 + (i % 4) * 0.03);
        x.beginPath();
        for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, r2 = k % 2 ? r * 0.42 : r; x.lineTo(sx + Math.cos(a) * r2, sy + Math.sin(a) * r2); }
        x.closePath(); x.fill();
      }
      x.globalAlpha = 0.3; x.fillStyle = '#fff'; x.fillRect(0, h * 0.12, w, h * 0.07);
      x.restore();
    }
  }

  // a picture's own size: a playing gif sits on the page at 2 px (so the browser animates it), and an <img> on the page
  // reports its shown size, not its own
  function srcSize(im) { return [im.naturalWidth || im.videoWidth || im.width || 1, im.naturalHeight || im.videoHeight || im.height || 1]; }
  // a type colour as icon ink: as it is on a dark card, a touch deeper on a light one so it holds against the pale fill
  function iconInk(T, kind, color) { return T.mode === 'light' ? mix(color, '#000', 0.22) : color; }
  // the folder colours, the same run as the page's rainbow
  const RAINBOW = ['#ff5c8d', '#ff9c86', '#ffad4d', '#ffe066', '#c6f25c', '#70e39c', '#70b6ff', '#b38eff'];
  // a kind's ink on the stack card and the clipboard bar: folders the rainbow (corner to corner of the icon's own unit box,
  // icon scales its drawing to that), junk and other the muted text in a dark theme (near black, they could not be seen)
  function stackInk(x, T, kind, color) {
    if (kind === 'folder') { const g = x.createLinearGradient(0, 0, 1, 1); RAINBOW.forEach((c, k) => g.addColorStop(k / (RAINBOW.length - 1), c)); return g; }
    return T.mode !== 'light' && (kind === 'other' || kind === 'junk') ? T.textMute : iconInk(T, kind, color);
  }
  // the Obsidian themes as they stood when this was built: Retroma light, triadic flipped, and Willemstad dark with its
  // Style Settings. the plugin replaces these with what Obsidian resolves now
  const OBSIDIAN_THEMES = {
    retroma: { mode: 'light', paper: 'oklch(0.98 0.0618 74.77)', primary: 'oklch(0.93 0.0618 74.77)', stage: 'oklch(0.67 0.0618 314.77)', tube: 'oklch(0.8 0.0618 194.77)', tube2: 'oklch(0.75 0.0618 194.77)',
      border: 'oklch(0.2 0.0494 194.77)', hi: 'oklch(1 0.0989 194.77)', lo: 'oklch(0.4 0.1 194.77)', text: 'oklch(0.4 0.0618 194.77)', muted: 'oklch(0.5 0.0618 194.77)',
      accent: 'oklch(0.5 0.0618 194.77)', accent2: 'oklch(0.67 0.0618 314.77)', over: 'oklch(0.85 0.0618 74.77)', select: 'oklch(0.67 0.15 314.77)', font: '"Courier New", Georgia, monospace' },
    willemstad: { mode: 'dark', paper: 'oklch(0.27 0.025 45)', primary: 'oklch(0.22 0.018 0)', stage: 'oklch(0.18 0.015 0)', tube: 'oklch(0.18 0.015 0)', tube2: 'oklch(0.22 0.018 0)',
      border: 'oklch(0.42 0.049 57.8)', hi: 'oklch(0.36 0.042 56.4)', lo: 'oklch(0.18 0.015 0)', text: 'oklch(0.95 0.16 70)', muted: 'oklch(0.73 0.09 63.5)',
      accent: 'oklch(0.82 0.11 65)', accent2: 'oklch(0.63 0.17 0)', over: 'oklch(0.36 0.042 56.4)', select: 'oklch(0.63 0.17 0)', font: 'Georgia, "Courier New", serif' }
  };
  // themes of the wheel's own that began as Obsidian themes: read once from each theme's css and Style Settings, with the
  // same reader the plugin uses for the two above, then kept here. nothing from Obsidian ever changes them
  const WHEEL_THEMES = {
    // Vauxhall by CyanVoxel, main color red at the nebula intensity, its own cyan to purple heading colors for the accents
    vauxhall: { mode: 'dark', paper: '#6a233e', primary: '#2d0b16', stage: '#16060b', tube: '#16060b', tube2: '#2d0b16', border: '#6a233e', hi: '#621d36', lo: '#16060b', text: '#ffe0f5', muted: '#cd72a8',
      accent: '#43cfea', accent2: '#9446f8', over: '#621d36', select: '#43cfea', font: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, "Inter", sans-serif', scene: { sky: 'nebula', tubeRough: 0.95 } },
    // Shimmering Focus by pseudometa, the Everforest color scheme
    shimmering: { mode: 'dark', paper: '#1a1f23', primary: '#1f2529', stage: '#1a1f23', tube: '#1a1f23', tube2: '#1f2529', border: '#303a40', hi: '#232a2f', lo: '#1a1f23', text: '#c4d4de', muted: '#b1bcc4',
      accent: '#a8c181', accent2: '#80bcb4', over: '#232a2f', select: '#a8c181', font: '"Recursive S", "Recursive", ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif', scene: { sky: 'shimmer', tubeRough: 0.95 } },
    // Tyrone Neon by Tyrone Jose: all black, and the neon is its own palette (the reader comes up with Obsidian's accent). muted a step up its own grey scale, its #737373 was lost on a card
    tyrone: { mode: 'dark', paper: '#262626', primary: '#000000', stage: '#000000', tube: '#000000', tube2: '#000000', border: '#333333', hi: '#3f3f3f', lo: '#000000', text: '#d4d4d4', muted: '#a3a3a3',
      accent: '#00e5ff', accent2: '#ff0051', over: '#3f3f3f', select: '#00e5ff', font: '"Inter", "Segoe UI", system-ui, sans-serif', scene: { sky: 'neon', tubeRough: 0.95 } },
    // Modern Amiga Workbench 3.1 inspired by Anthony Fitzpatrick, its light Workbench: warm greys and a white and grey bevel
    amiga: { mode: 'light', paper: '#bcb5ae', primary: '#a59d97', stage: '#9b948e', tube: '#9b948e', tube2: '#7f7873', border: '#000000', hi: '#ffffff', lo: '#7f7873', text: '#000000', muted: '#33302d',
      accent: '#1e3d6d', accent2: '#3b67a2', over: '#c3bdb6', select: '#3b67a2', font: 'ui-monospace, "SFMono-Regular", Consolas, monospace', scene: { sky: 'workbench', tubeRough: 0.95, skyHard: true } },
    // Encore by Carbonateb, its Glass Royale colors with the Colorful text
    encore: { mode: 'dark', paper: '#1a1a20', primary: '#080808', stage: '#000000', tube: '#000000', tube2: '#080808', border: '#1a1a20', hi: '#282830', lo: '#000000', text: '#dee3f1', muted: '#adb5c8',
      accent: '#5db4df', accent2: '#3c9cd7', over: '#282830', select: '#5db4df', font: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, "Inter", sans-serif', scene: { sky: 'glass', tubeRough: 0.95 } },
  };
  function themeFrom(r) {
    return { mode: r.mode, fill: r.paper, inset: r.primary, line: r.border, edge: r.mode === 'dark' ? 3.75 : 4.5, bevelLight: r.hi, bloom: rgba(r.hi, 0.6), bevelDark: r.lo,
      text: r.text, textMute: r.muted, select: r.select, ctl: r.primary, font: r.font };
  }
  // one type's icon in its colour, for the page's own bar (folders in the rainbow, as on the stack card)
  function drawIcon(x, kind, px, py, s, theme) {
    const T = THEMES[theme || 'light'], t = TYPES[kind] || TYPES.other;
    icon(x, t.icon, px, py, s, stackInk(x, T, kind, t.color));
  }
  global.VWCards = { drawIcon, themeFrom, OBSIDIAN_THEMES, WHEEL_THEMES, drawCard, drawUnder, typeOf, displayName, frameAspect, THEMES, TYPES, mix, rgba };
})(typeof window !== 'undefined' ? window : globalThis);
