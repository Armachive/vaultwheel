/* VaultWheel playground (#sv): what you carry, on a board to arrange, zoom and play. tools/build.sh inlines this into the
   page's module script, so it shares the page's scope; its styles are playground.css, inlined into the page's style block.
   the page calls in through svOpen, svCards, drawSvCard, openStackView, closeStackView, stepBoard, pgKey and dropGoneVel */
stage.insertAdjacentHTML('beforeend', '<div id="sv" role="dialog" aria-label="Playground"><svg class="links" aria-hidden="true"></svg><div class="board"></div>'
  + '<button type="button" class="pgx" aria-label="Close the playground" title="Close (Esc)">✕</button><div class="ops" role="toolbar" aria-orientation="vertical" aria-label="Playground tools"></div><div class="hint"></div>'
  + '<div class="pgren" role="dialog" aria-label="Rename" hidden><b></b><input type="text" spellcheck="false" autocomplete="off" aria-label="New names"><p class="tip">* is the old name, # counts up</p>'
  + '<ol class="pv"></ol><div class="row"><button type="button" class="pill" data-r="go">Rename</button><button type="button" class="pill" data-r="no">Cancel</button></div></div>'
  + '<div class="pgboards" role="dialog" aria-label="Boards" hidden><div class="head"><b>Boards</b><button type="button" class="pill" data-b="close" aria-label="Close">✕</button></div><div class="row"><input type="text" spellcheck="false" autocomplete="off" placeholder="Name this board" aria-label="Board name">'
  + '<button type="button" class="pill" data-b="save">Save</button></div><ol class="bl"></ol><p class="tip"></p></div></div>');
/* ---------- the carried files on a board ----------
   click the stack (or press Enter while carrying) to open it. a sandbox for whatever you carry, for collages and quick
   reference bundles. it is a canvas: a file stays where you put it. hold a file still for a moment and a string comes out
   of it and follows your pointer; let go on another file and the two are tied. tied files behave like a little graph view,
   pulling to the string's length, and drag each other along (tap a string to cut it). a double click opens a file up in
   place: a picture or video grows, a note shows its text like a note on a canvas. drag a file to move it, its corner to
   size it, the background to pan. Alt + scroll (or a pinch) zooms smoothly at the pointer, across everything. songs and
   videos play here. nothing on disk changes until you press Move here or Trash, and Obsidian asks first. a click on the background (or Esc) leaves */
const sv = $('#sv'), svBoard = sv.querySelector('.board'), svHint = sv.querySelector('.hint'), svLinks = sv.querySelector('.links');
let svOpen = false;
// the board's files that are drawn like a focused wheel card (cover art, a video's current frame, any other file)
let svCards = [];
const boardPos = new Map();       // where each carried file sits on the board, kept for as long as it is carried
const boardAspect = new Map();    // a picture's real shape once it has loaded
const board = { x: 0, y: 0, z: 1, zt: 1, anchor: null, glide: null, drawnZ: 1, top: 1 };
const BOARD_ZOOM = [0.08, 12];
// --inv keeps the select ticks the same size on screen at any zoom
// the ties are drawn in their own layer under the cards, moved and scaled the same way
const applyBoard = () => {
  const t = 'translate(' + board.x.toFixed(2) + 'px,' + board.y.toFixed(2) + 'px) scale(' + board.z.toFixed(4) + ')';
  svBoard.style.transform = t; svLinks.style.transform = t; svBoard.style.setProperty('--inv', (1 / board.z).toFixed(4));
};
// what is ticked on the board. everything starts ticked; what is unticked when you leave goes back where it came from
const pgOff = new Set();
let svOpener = null;  // what had the keyboard when the board opened
let pgHold = false;   // true while the board is closed and opened again around a move or trash, so the ticks stay as they are
const pgOn = () => sel.filter(r => !pgOff.has(r));
function drawSvCard(card) {
  const it = card.it, A = it.audio || it.video, p = boardPos.get(it.ref); if (!p) return;
  // drawn sharper as you zoom in, up to four times
  const s = DPR * board.drawnZ, cw = Math.min(4096, Math.max(32, Math.round(p.w * s)));
  // (the height is held to the same size, and the whole canvas to 16 million pixels, however stretched the card is)
  // an opened note, drawing or folder shows its card only as the header strip on top, so it is drawn at that size
  const ph = p.big && HEADED.has(p.big.kind) ? p.big.hh : p.h;
  let ch = Math.min(4096, Math.max(16, Math.round(cw * ph / p.w))), cw2 = cw;
  if (cw2 * ch > 16e6) { const k = Math.sqrt(16e6 / (cw2 * ch)); cw2 = Math.max(16, Math.floor(cw2 * k)); ch = Math.max(16, Math.floor(ch * k)); }
  if (card.c.width !== cw2 || card.c.height !== ch) { card.c.width = cw2; card.c.height = ch; }
  const g2 = card.c.getContext('2d'); if (!g2) return;
  let thumb = it.media || it.kind === 'audio' ? prov.thumbImage(it.ref, card.onThumb || (card.onThumb = () => { if (svOpen && svCards.includes(card)) drawSvCard(card); })) : null;
  // (a frame from another origin would taint the card's canvas and blank it, so only a drawable one is used)
  if (it.video && A.el && A.playing && A.el.readyState >= 2 && drawable(A.el)) thumb = A.el;
  const res = C.drawCard(g2, card.c.width, card.c.height, { theme, name: it.name, isDir: it.isDir, kind: it.kind, thumb, placeholder: !thumb, audio: it.audio, video: it.video, tile: !!card.tile, wrap: true });
  card.hit = res.hit || null; card.lastDraw = performance.now();
}
// a file's size when it first lands on the board: pictures and videos a row tall, other files a card about as wide
function boardSize(it, rh) {
  if (it.media === 'image' || it.media === 'video') {
    const ar = it.media === 'image' ? boardAspect.get(it.ref) || it.ar : it.w / it.h;
    let h = rh, w = h * ar; if (w > rh * 1.8) { w = rh * 1.8; h = w / ar; }
    return [w, h];
  }
  const w = rh * 1.25; return [w, w * it.h / it.w];
}
// new arrivals: the first ones in small rows around the middle of the board (0, 0), later ones near the middle, and the
// physics spreads them out from there. files are small, so there is room to throw them around at the starting zoom
const PG_ROW = () => clamp(stage.clientHeight * 0.16, 64, 140);
// the room the side panel takes on the right
const panelRoom = () => Math.min(96, stage.clientWidth * 0.3);
function boardPack(refs) {
  const gap = 22, rh = PG_ROW(), any = [...boardPos.keys()].some(r => selSet.has(r));
  if (any) {
    refs.forEach((ref, i) => { const [w, h] = boardSize(itemOf(ref), rh), a = i * 2.4, d = 30 + i * 12; boardPos.set(ref, { x: Math.cos(a) * d - w / 2, y: Math.sin(a) * d - h / 2, w, h, sized: false }); });
    return;
  }
  const rowW = Math.max(rh * 3, Math.sqrt(refs.length) * rh * 1.6);
  let x = 0, y = 0, rowH = 0, x1 = 0;
  for (const ref of refs) {
    const [w, h] = boardSize(itemOf(ref), rh);
    if (x > 0 && x + w > rowW) { x = 0; y += rowH + gap; rowH = 0; }
    boardPos.set(ref, { x, y, w, h, sized: false });
    x += w + gap; rowH = Math.max(rowH, h); x1 = Math.max(x1, x - gap);
  }
  const cx = x1 / 2, cy = (y + rowH) / 2;
  for (const ref of refs) { const p = boardPos.get(ref); p.x -= cx; p.y -= cy; }
}
// the starting view: the zoom left at 1, the middle of the board in the middle of the room left of the side panel
function boardHome() {
  const W = stage.clientWidth, H = stage.clientHeight;
  board.anchor = board.glide = null; board.z = board.zt = 1;
  board.x = (W - panelRoom()) / 2; board.y = H / 2; applyBoard();
}
// everything in view, clear of the side panel and the hint
function boardFit(glide) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const ref of sel) { const p = boardPos.get(ref); if (!p) continue; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + p.w); y1 = Math.max(y1, p.y + p.h); }
  if (!isFinite(x0)) return;
  const W = stage.clientWidth, H = stage.clientHeight, right = panelRoom(), pad = 32;   // clear of the side panel on the right
  const aw = Math.max(80, W - right - pad * 2), ah = Math.max(80, H - pad * 2 - 30);
  const z = clamp(Math.min(aw / (x1 - x0), ah / (y1 - y0), 1.4), BOARD_ZOOM[0], BOARD_ZOOM[1]);
  const x = pad + (aw - (x1 - x0) * z) / 2 - x0 * z, y = pad + (ah - (y1 - y0) * z) / 2 - y0 * z;
  board.anchor = null;
  if (glide) { board.glide = { x, y, z }; board.zt = z; }
  else { board.glide = null; board.x = x; board.y = y; board.z = board.zt = z; applyBoard(); }
}
const placeBoardItem = box => {
  const p = boardPos.get(box.__ref); if (!p) return;
  box.style.left = p.x + 'px'; box.style.top = p.y + 'px'; box.style.width = p.w + 'px'; box.style.height = p.h + 'px';
  // a drawn card's box takes the card's own corner (cards.js: 31 units of min(height, a third of the width)), so the
  // pick outline and the glows follow the card rather than a boxier rectangle round it. an opened note keeps its frame's
  if (box.__card && !(p.big && HEADED.has(p.big.kind))) box.style.borderRadius = (0.31 * Math.min(p.h, p.w * 0.3)).toFixed(1) + 'px';
  else box.style.borderRadius = '';
};
// pictures go on the board as themselves at full quality (the preview only has its thumbnails), so the zoom stays sharp
// a picture on the board is shown from a copy no bigger than it needs (the way Canvas and Excalidraw keep many pictures
// quick): the 1280 px copy the plugin or the site already makes, which is plenty for a card. the whole file only comes
// when the picture is opened up or zoomed in close, and the small copy comes back when it is not
function boardImageSrc(it, full) {
  if (it.media !== 'image') return null;
  if (MODE === 'snapshot') { const t = prov.thumbInfo(it.ref); return t && t.d || null; }
  if (full || /\.gif$/i.test(it.name)) return prov.mediaUrl(it.ref);
  // (the sharp copy is asked for; until it is made, the file itself does, and the image is swapped when it lands)
  const hi = prov.thumbImage(it.ref, null, true);
  return hi ? hi.src : prov.mediaUrl(it.ref);
}
// a picture needs the whole file once it shows bigger than its 1280 px copy: opened up, or zoomed in on
const wantsFull = (box, p) => !!(p.big || (p.w * board.z * DPR > 1400 && boxOnScreen(box)));
function boxOnScreen(box) {
  const p = boardPos.get(box.__ref); if (!p) return false;
  const x0 = p.x * board.z + board.x, y0 = p.y * board.z + board.y, x1 = x0 + p.w * board.z, y1 = y0 + p.h * board.z;
  return x1 > -200 && y1 > -200 && x0 < stage.clientWidth + 200 && y0 < stage.clientHeight + 200;
}
// which pictures get the whole file, and which can let it go, as the view changes (checked once a zoom or pan settles)
function refitImages() {
  for (const box of svBoard.children) {
    const img = box.firstElementChild; if (!img || img.tagName !== 'IMG') continue;
    const it = itemOf(box.__ref), p = boardPos.get(box.__ref); if (!p || it.media !== 'image') continue;
    const full = wantsFull(box, p);
    if (full === !!box.__full) continue;
    box.__full = full; const src = boardImageSrc(it, full);
    if (typeof src === 'string') img.src = src; else if (src) src.then(u => { if (u && box.__full === full) img.src = u; });
  }
}
// pictures far off the screen are not painted at all (content-visibility), so a pan or a zoom only paints what shows
function cullBoard() {
  for (const box of svBoard.children) {
    const on = boxOnScreen(box); if (on === box.__on) continue;
    box.__on = on; box.classList.toggle('offscreen', !on);
  }
}
function addBoardItem(ref) {
  const it = itemOf(ref), box = document.createElement('div');
  box.className = 'item'; box.__ref = ref; box.title = it.name; box.tabIndex = 0; box.setAttribute('aria-label', it.name);
  const src = boardImageSrc(it);
  if (src) {
    const img = document.createElement('img'); img.alt = it.name; img.draggable = false; img.decoding = 'async';
    // a picture takes its own shape once it loads, unless you have sized it yourself
    img.onload = () => {
      if (!img.naturalWidth) return;
      const ar = img.naturalWidth / img.naturalHeight, p = boardPos.get(ref); boardAspect.set(ref, ar);
      if (p && !p.sized && Math.abs(p.w / p.h - ar) > 0.01) { p.w = p.h * ar; placeBoardItem(box); placeTies(); }
    };
    if (typeof src === 'string') img.src = src; else src.then(u => { if (u && !box.__full) img.src = u; });
    // the sharp copy may still be on its way: when it lands the picture swaps to it (unless the whole file is wanted by then)
    if (MODE !== 'snapshot' && !/\.gif$/i.test(it.name)) prov.thumbImage(ref, () => { if (!box.__full && box.isConnected) { const hi = prov.thumbImage(ref, null, true); if (hi && hi.src) img.src = hi.src; } }, true);
    box.appendChild(img);
  } else {
    const c = document.createElement('canvas'), card = { c, it, hit: null, lastDraw: 0, box };
    svCards.push(card); box.__card = card; box.appendChild(c); box.classList.add("drawn");
  }
  const tk = document.createElement('div'); tk.className = 'tick'; tk.title = 'Select or deselect'; tk.tabIndex = 0; tk.setAttribute('role', 'checkbox'); tk.setAttribute('aria-label', 'Select ' + it.name); box.appendChild(tk);
  markTick(box);
  // a file left opened up comes back opened up
  if (boardPos.get(ref) && boardPos.get(ref).big) buildOpen(box);
  svBoard.appendChild(box); placeBoardItem(box);
}
// a card's tick: faded when unticked, and a checkbox a screen reader can read and Space or Enter can press
function markTick(box) {
  const off = pgOff.has(box.__ref); box.classList.toggle('off', off);
  const tk = box.querySelector('.tick'); if (tk) tk.setAttribute('aria-checked', off ? 'false' : 'true');
}
svBoard.addEventListener('keydown', e => {
  if ((e.key === ' ' || e.key === 'Enter') && e.target.classList.contains('tick')) { e.preventDefault(); e.stopPropagation(); toggleTick(e.target.parentNode); }
  // on a file itself: Enter opens it up (or shrinks it back), Space plays a song or video
  else if ((e.key === ' ' || e.key === 'Enter') && e.target.classList.contains('item') && !e.repeat) {
    e.preventDefault(); e.stopPropagation();
    const box = e.target, it = itemOf(box.__ref), A = it.audio || it.video;
    if (e.key === 'Enter') toggleExpand(box); else if (A) { setPlaying(it, !A.playing); redrawMedia(A); }
  }
});
function toggleTick(box) {
  const ref = box.__ref;
  if (pgOff.has(ref)) pgOff.delete(ref); else pgOff.add(ref);
  markTick(box); sfx.select(); renderPanel();
  if (!pgRen.hidden) closeRename();      // the names it was going to change are not the ticked ones any more
}
// A, or the All button: everything ticked, or (when it all is) nothing
function toggleAll() {
  if (pgOff.size) pgOff.clear(); else sel.forEach(r => pgOff.add(r));
  for (const box of svBoard.children) markTick(box);
  sfx.select(); renderPanel();
  if (!pgRen.hidden) closeRename();
}
// (empty is only for the saved boards, opened from the bar with nothing carried)
function openStackView(empty) {
  if (svOpen || (!sel.length && !empty)) return;
  if (!pgHold) svOpener = document.activeElement;
  svOpen = true; svBoard.innerHTML = ''; svCards = []; if (!pgHold) pgOff.clear();
  // everything on the board is kept for the session: where each file sits, its size, what is opened up, the strings and
  // the view. a file that leaves the carry keeps its place too, so carrying it again puts it back where it was
  boardPack(sel.filter(r => !boardPos.has(r)));
  sel.forEach(addBoardItem);
  pruneTies(); drawTies(); phys.awake = 1;
  // the view starts in the middle the first time only; after that it is where you left it
  if (!board.homed) { boardHome(); board.homed = true; } else applyBoard();
  board.drawnZ = clamp(board.z, 1, 4);
  svCards.forEach(drawSvCard);
  renderPanel();
  sv.classList.add('on'); sfx.open(); tellHost();
  hideTip();     // a card's tooltip must not stay up over the board
  // the keyboard starts in the side panel, so Tab walks the tools and then the ticks
  if (!pgHold) { const f = svPanel.querySelector('button:not([disabled])'); if (f) f.focus(); }
}
// leaving: what is unticked goes back where it came from (nothing moved, so it just stops being carried). the page also
// calls this from rebuildStack and when the rows change, so it closes first and puts things back a moment later
function closeStackView() {
  if (!svOpen) return;
  const back = pgHold ? [] : sel.filter(r => pgOff.has(r)); if (!pgHold) pgOff.clear();
  // (an opened-up file stays open: it is there the same way next time)
  pickBox(null); closeEditor();
  // a video playing on the board stops with it; songs carry on
  // (opened again around a move, the videos still carried go on playing)
  const vids = svCards.filter(c => c.it.video && c.it.video.playing && !(pgHold && selSet.has(c.it.ref))).map(c => c.it);
  // the keyboard goes back to what opened the board (or nowhere), unless it is about to open again
  if (sv.contains(document.activeElement)) {
    const back = !pgHold && svOpener && svOpener.isConnected && svOpener !== document.body && !sv.contains(svOpener) ? svOpener : null;
    if (pgHold || !back) document.activeElement.blur(); else back.focus();
  }
  svOpen = false; sv.classList.remove('on', 'panning'); svBoard.innerHTML = ''; svLinks.innerHTML = ''; svCards = []; svPtr.clear(); svDrag = null; tellHost();
  for (const it of vids) { setPlaying(it, false); redrawMedia(it.video); }
  if (!volPop.hidden) { volPop.hidden = true; volFor = null; }
  closeRename();
  // a batch rename changed names the stack's top card still shows
  if (back.length) queueMicrotask(() => putBack(back)); else if (pgRenamed) queueMicrotask(() => { if (!svOpen && sel.length) rebuildStack(false); });
  pgRenamed = false;
}
function putBack(refs) {
  const gone = new Set(refs.filter(r => selSet.has(r))); if (!gone.size) return;
  setSel(sel.filter(r => !gone.has(r)));
  settleAfterSelection([...gone][0]);
  rebuildStack(false); renderSel(); sfx.cancel();
}

/* ---------- the side panel ---------- */
const svPanel = sv.querySelector('.ops');
// (copy here, batch rename and duplicate are off the panel; their code stays, for the tests and for when they come back)
const PG_OPS = [['fit', '🔍', 'Fit'], ['tidy', '🧹', 'Tidy'], null, ['all', '☑️', 'All'], null, ['move', '➡️', 'Move here'], ['trash', '🗑️', 'Trash']];
svPanel.innerHTML = PG_OPS.map(o => !o ? '<i class="seg"></i>'
  : '<button type="button" data-op="' + o[0] + '"' + (o[0] === 'trash' ? ' class="danger"' : '') + '><span aria-hidden="true">' + o[1] + '</span><small>' + o[2] + '</small></button>').join('');
const pgBtn = k => svPanel.querySelector('[data-op="' + k + '"]');
function renderPanel() {
  const n = pgOn().length, none = !n;
  pgBtn('all').querySelector('small').textContent = pgOff.size ? 'All' : 'None';
  pgBtn('all').title = (pgOff.size ? 'Select everything' : 'Deselect everything') + ' (A)';
  const here = path.length ? path[path.length - 1].name : 'this folder';
  pgBtn('move').title = 'Move the selected into ' + here + ' (ctrl + Z undoes it)';
  pgBtn('trash').title = 'Move the selected to .trash';
  pgBtn('fit').title = 'Fit them all in view'; pgBtn('tidy').title = 'Line them up again';
  for (const k of ['move', 'trash']) pgBtn(k).disabled = none || pgBusy;
  // the site leaves the jobs that change the vault (other than moves) to Obsidian
  if (MODE === 'live') { pgBtn('trash').disabled = true; pgBtn('trash').title = OBSIDIAN_ONLY; }
  svHint.textContent = n + ' of ' + sel.length + ' selected · ' + (LITE ? 'pinch to zoom · tap the background to go back'
    : 'A selects all · Alt + scroll to zoom · click the background to go back');
}
let pgBusy = false;
svPanel.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const op = b.dataset.op;
  if (op === 'fit') boardFit(true);
  else if (op === 'tidy') {
    shrinkAll(); boardPos.clear(); vel.clear(); boardPack(sel.slice()); phys.awake = 1;
    for (const box of svBoard.children) placeBoardItem(box);
    svCards.forEach(drawSvCard); boardFit(true);
  }
  else if (op === 'all') toggleAll();
  else if (op === 'move') pgMove();
  else if (op === 'trash') pgTrash();
});
// keys while the playground is open (the page hands them all over)
function pgKey(e) {
  if (e.key === 'Escape' && ed) closeEditor();
  else if (e.key === 'Escape' && !pgBoards.hidden) closeBoards();
  else if (e.key === 'Escape' && !pgRen.hidden) closeRename();
  else if (e.key === 'Escape' && !volPop.hidden) { volPop.hidden = true; volFor = null; }     // Esc closes the volume slider first
  else if (e.key === 'Escape') closeStackView();
  else if (e.key === 'Alt') e.preventDefault();
  else if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) { e.preventDefault(); toggleAll(); }
  else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.repeat) { e.preventDefault(); undo(); }
}

/* ---------- move here and trash: Obsidian asks first, in its own window, once for the whole batch ---------- */
// the bridge's own request, which gives up on one nobody answers (an older plugin, a view that went away) so the board never
// stays busy
const pgAsk = (t, data) => prov.ask(t, data);
// a batch move in Obsidian: one question, links kept, and an undo moves them back without asking. what went is moved here too
// and added to moved, what did not to skipped. false: nothing was done (a no, or no answer)
async function moveInObsidian(refs, to, nested, moved, skipped) {
  const was = new Map(refs.map(r => [r, pathOf(r)]));     // the paths asked about, as they were when asked
  pgBusy = true; if (svOpen) renderPanel();
  const m = await pgAsk('moveMany', { from: refs.map(r => was.get(r)), to: pathOf(to) });
  pgBusy = false; if (svOpen) renderPanel();
  if (m.cancelled) return false;
  if (!m.results && m.err) { toast('Could not move: ' + m.err); sfx.nope(); return false; }
  const res = new Map((m.results || []).map(x => [x.p, x]));
  for (const ref of refs) {
    const x = res.get(was.get(ref));
    if (x && x.ok) { if (!nested.has(ref) && ref.parent !== to) localMove(ref, to); moved.push(ref); }
    else skipped.push(ref.name + (x && x.err ? ' (' + x.err + ')' : ''));
  }
  return true;
}
// what came off the board: out of the carry and off the board, and the playground closes once nothing is left
function pgDone(refs) {
  const gone = new Set(refs); if (!gone.size) return;
  for (const r of gone) { pgOff.delete(r); boardPos.delete(r); }
  setSel(sel.filter(r => !gone.has(r)));
  for (const box of [...svBoard.children]) if (gone.has(box.__ref)) { if (box.__card) svCards.splice(svCards.indexOf(box.__card), 1); box.remove(); }
  shareCache.clear(); prov.onChange();
  // rebuildStack closes the board; it opens again on what is left, ticks kept, unless nothing is left
  const reopen = svOpen && sel.length > 0, ae = document.activeElement, op = ae && sv.contains(ae) && ae.dataset ? ae.dataset.op : null;
  pgHold = true;
  if (!sel.length) closeStackView();
  settleAfterSelection([...gone][0]);
  rebuildStack(false); renderSel();
  if (reopen) {
    openStackView();
    // the keyboard stays on the button that was pressed (or the first that still works)
    const b = op && pgBtn(op), f = b && !b.disabled ? b : svPanel.querySelector('button:not([disabled])'); if (f) f.focus();
  }
  pgHold = false;
}
async function pgMove() {
  const to = path[path.length - 1], on = pgOn(); if (!to || !on.length || pgBusy) return;
  const ok = [], skipped = [], from = new Map(on.map(r => [r, r.parent]));
  const want = on.filter(ref => {
    if (ref.parent === to) { ok.push(ref); return false; }
    if (ref.isDir) for (let p = to; p; p = p.parent) if (p === ref) { skipped.push(ref.name + ' (a folder cannot go inside itself)'); return false; }
    return true;
  });
  // a file picked up along with its folder travels with that folder
  const nested = nestedIn(want);
  if (want.length) {
    if (MODE === 'bridge') { if (!await moveInObsidian(want, to, nested, ok, skipped)) return; }
    else {
      if (!confirm('Move ' + want.length + (want.length === 1 ? ' item' : ' items') + ' into ' + to.name + '?')) return;
      for (const ref of want) {
        if (nested.has(ref)) { ok.push(ref); continue; }
        if ((ref.isDir ? to.dirs : to.files).some(x => x.name === ref.name)) { skipped.push(ref.name + ' (name already exists here)'); continue; }
        if (prov.move(ref, to) === false) { skipped.push(ref.name + ' (read-only here)'); continue; }
        ok.push(ref);
      }
    }
  }
  pgDone(ok);
  // what really changed folder can be put back with undo (what was already here has nothing to undo)
  const moves = ok.filter(r => !nested.has(r) && from.get(r) !== to).map(ref => ({ ref, from: from.get(ref) }));
  if (moves.length) undoLog.push({ t: 'moved', moves });
  if (ok.length) { const m = 'Moved ' + ok.length + ' into ' + to.name + (skipped.length ? '. Skipped: ' + skipped.join(', ') : '') + DONE_NOTE; if (moves.length) toastUndo(m); else toast(m); sfx.drop(); }
  else if (skipped.length) { toast('Nothing moved. ' + skipped.join(', ')); sfx.nope(); }
}
// undo for a move: each file goes back to the folder it came from, one quiet batch per folder (the move was already
// confirmed). anything renamed, gone, or with its old name taken back home stays where it is
// a file or folder that is really still in the tree (one taken out keeps its parent, so the parent alone does not say)
const inTree = ref => !!ref && !!ref.parent && (ref.isDir ? ref.parent.dirs : ref.parent.files).includes(ref);
async function moveBack(moves) {
  const byDir = new Map();
  for (const mv of moves) {
    const { ref, from } = mv;
    if (!inTree(ref) || !inTree(from) && from !== prov.root || ref.parent === from || (ref.isDir ? from.dirs : from.files).some(x => x.name === ref.name)) continue;
    if (!byDir.has(from)) byDir.set(from, []); byDir.get(from).push(ref);
  }
  let n = 0;
  for (const [dir, refs] of byDir) {
    if (MODE === 'bridge') {
      const was = new Map(refs.map(r => [r, pathOf(r)]));
      pgBusy = true; if (svOpen) renderPanel();
      const m = await pgAsk('moveMany', { from: refs.map(r => was.get(r)), to: pathOf(dir), quiet: true });
      pgBusy = false; if (svOpen) renderPanel();
      // a no in Obsidian leaves the undo to try again (the caller puts it back)
      if (m.cancelled && !n) return -1;
      if (!m.results && m.err) { toast('Could not move back: ' + m.err); sfx.nope(); continue; }
      const res = new Map((m.results || []).map(x => [x.p, x]));
      for (const ref of refs) { const x = res.get(was.get(ref)); if (x && x.ok) { if (ref.parent !== dir) localMove(ref, dir); n++; } }
    } else for (const ref of refs) if (prov.move(ref, dir) !== false) n++;
  }
  if (n) treeChanged(null); else { toast('Nothing could be moved back'); sfx.nope(); }
  return n;
}
// copy here: copies of the ticked files land in the folder in the content column; the originals stay where they are and
// leave the stack. undo puts the copies in .trash
async function pgCopy() {
  const to = path[path.length - 1], on = pgOn(); if (!to || !on.length || pgBusy) return;
  if (MODE === 'live') { toast('Copying works inside Obsidian.'); sfx.nope(); return; }
  const skipped = [], done = [], copies = [];
  const want = on.filter(ref => {
    if (ref.isDir) for (let p = to; p; p = p.parent) if (p === ref) { skipped.push(ref.name + ' (a folder cannot be copied inside itself)'); return false; }
    return true;
  });
  const nested = nestedIn(want);
  const land = (ref, name) => {
    // (a file inside a folder that is copied too is already in that copy)
    if (nested.has(ref)) { done.push(ref); return; }
    const c = addLocal(to, cloneLocal(ref, to, name));
    if (c.isDir && MODE === 'bridge') { c.listed = false; c.files = []; c.dirs = []; }     // the plugin lists the copy when it opens
    copies.push(c); done.push(ref);
  };
  if (want.length && MODE === 'bridge') {
    pgBusy = true; renderPanel();
    const was = new Map(want.map(r => [r, pathOf(r)]));
    const m = await pgAsk('copyMany', { from: want.map(r => was.get(r)), to: pathOf(to) });
    pgBusy = false;
    if (m.cancelled) { renderPanel(); return; }
    if (!m.results && m.err) { renderPanel(); toast('Could not copy: ' + m.err); sfx.nope(); return; }
    const res = new Map((m.results || []).map(x => [x.p, x]));
    for (const ref of want) {
      const x = res.get(was.get(ref));
      // a vault change may have shown the copy already; then it is only found, not added twice
      if (x && x.ok) { const have = !nested.has(ref) && entryAt(x.newPath); if (have) { copies.push(have); done.push(ref); } else land(ref, x.name); }
      else skipped.push(ref.name + (x && x.err ? ' (' + x.err + ')' : ''));
    }
  } else if (want.length) {
    if (!confirm('Copy ' + want.length + (want.length === 1 ? ' item' : ' items') + ' into ' + to.name + '?')) return;
    const taken = n => to.dirs.concat(to.files).some(x => x.name === n);
    for (const ref of want) {
      const [stem, ext] = splitName(ref);
      let name = ref.name; for (let i = 1; taken(name); i++) name = stem + (i === 1 ? ' copy' : ' copy ' + i) + ext;
      land(ref, name);
    }
  }
  pgDone(done);
  if (copies.length) undoLog.push({ t: 'madeMany', refs: copies });
  if (done.length) { const m = 'Copied ' + done.length + ' into ' + to.name + (skipped.length ? '. Skipped: ' + skipped.join(', ') : '') + DONE_NOTE; if (copies.length) toastUndo(m); else toast(m); sfx.drop(); }
  else if (skipped.length) { toast('Nothing copied. ' + skipped.join(', ')); sfx.nope(); }
}
/* ---------- saved boards ----------
   a board can be saved under a name and opened again in any later session: which files are on it, where each sits and
   how big it is, what is opened up, the strings between them, what is unticked and the view. in Obsidian they are kept
   by the plugin (synced like its other settings); on the site and in the preview, in this browser. opening a saved board
   puts back what you carry now and carries the board's files instead */
const pgBoards = sv.querySelector('.pgboards'), pgBoardsIn = pgBoards.querySelector('input'), pgBoardsList = pgBoards.querySelector('.bl'), pgBoardsTip = pgBoards.querySelector('.tip');
let boardsCache = null;
async function boardsGet() {
  if (MODE === 'bridge') { const m = await pgAsk('boards', {}); if (m && Array.isArray(m.boards)) return m.boards; }
  try { return JSON.parse(localStorage.getItem('vw.boards') || '[]'); } catch (e) { return []; }
}
async function boardsPut(list) {
  if (MODE === 'bridge') { const m = await pgAsk('boardsSave', { boards: list }); if (m && m.ok) return true; }
  try { localStorage.setItem('vw.boards', JSON.stringify(list)); return true; } catch (e) { return false; }
}
function boardSnapshot(name) {
  const on = sel.filter(r => boardPos.has(r));
  const items = on.map(r => { const p = boardPos.get(r); return { p: pathOf(r), dir: !!r.isDir, x: p.x, y: p.y, w: p.w, h: p.h, sized: !!p.sized, big: p.big || null }; });
  const strings = [];
  for (const [a, s] of ties) for (const b of s) if (selSet.has(a) && selSet.has(b) && sel.indexOf(a) < sel.indexOf(b)) strings.push([pathOf(a), pathOf(b)]);
  return { name, t: Date.now(), items, ties: strings, view: { x: board.x, y: board.y, z: board.z }, off: sel.filter(r => pgOff.has(r)).map(r => pathOf(r)) };
}
// a saved path back to a file, listing its folder first if it has not been opened yet this session
function findPath(path, isDir) {
  const parts = path.split('/'), last = parts.pop(); let d = prov.root;
  for (const n of parts) { d = d && d.dirs.find(x => x.name === n); if (!d) return Promise.resolve(null); }
  if (isDir) return Promise.resolve(d.dirs.find(x => x.name === last) || null);
  const look = () => d.files.find(x => x.name === last) || null;
  if (d.listed) return Promise.resolve(look());
  return new Promise(res => { const t = setTimeout(() => res(null), 8000); prov.ensure(d, () => { clearTimeout(t); res(look()); }); if (d.listed) { clearTimeout(t); res(look()); } });
}
async function loadBoard(b) {
  const found = [];
  for (const it of b.items) { const r = await findPath(it.p, it.dir); if (r && !path.includes(r)) found.push([r, it]); }
  const missing = b.items.length - found.length;
  if (!found.length) { toast('None of the files on ' + b.name + ' are there any more.'); sfx.nope(); return; }
  closeBoards();
  const was = svOpen; pgHold = true; if (was) closeStackView();
  // what is carried now goes back; the board's files are carried instead, each where the board had it
  const old = sel.slice();
  setSel(found.map(f => f[0]));
  for (const [r, it] of found) boardPos.set(r, { x: it.x, y: it.y, w: it.w, h: it.h, sized: it.sized, big: it.big || null });
  const byPath = new Map(found.map(([r]) => [pathOf(r), r]));
  for (const [pa, pb] of b.ties || []) { const a = byPath.get(pa), c = byPath.get(pb); if (a && c) for (const [x, y] of [[a, c], [c, a]]) { if (!ties.has(x)) ties.set(x, new Set()); ties.get(x).add(y); } }
  pgOff.clear(); for (const p of b.off || []) { const r = byPath.get(p); if (r) pgOff.add(r); }
  if (b.view) { board.x = b.view.x; board.y = b.view.y; board.z = board.zt = b.view.z; board.homed = true; board.anchor = board.glide = null; }
  for (const w of wheels) if (!w.dying) refreshKeeping(w);
  settleAfterSelection(old.find(r => !selSet.has(r)) || null);
  rebuildStack(false); renderSel();
  openStackView(); pgHold = false;
  toast('Opened ' + b.name + (missing ? '. ' + missing + (missing === 1 ? ' file is' : ' files are') + ' not there any more.' : '')); sfx.open();
}
function renderBoards() {
  pgBoardsList.textContent = '';
  const list = boardsCache || [];
  pgBoardsTip.textContent = list.length ? '' : 'No saved boards yet.';
  for (const b of list.slice().sort((x, y) => y.t - x.t)) {
    const li = document.createElement('li'), name = document.createElement('span');
    name.textContent = b.name; name.title = b.items.length + (b.items.length === 1 ? ' file' : ' files') + ' · ' + new Date(b.t).toLocaleString();
    const open = document.createElement('button'); open.type = 'button'; open.className = 'pill'; open.textContent = 'Open'; open.onclick = () => loadBoard(b);
    // save over: this board as it is now takes the saved one's place, under its name (asked first, since the old one goes)
    const over = document.createElement('button'); over.type = 'button'; over.className = 'pill'; over.textContent = '💾'; over.title = 'Save over ' + b.name + ' with this board'; over.setAttribute('aria-label', 'Save over ' + b.name);
    over.disabled = !sel.length;
    over.onclick = async () => {
      if (!sel.length || !confirm('Save over "' + b.name + '" with the board as it is now?')) return;
      const list = (boardsCache || []).filter(x => x !== b); list.push(boardSnapshot(b.name)); boardsCache = list;
      if (await boardsPut(list)) { toast('Saved over ' + b.name); sfx.drop(); renderBoards(); } else { toast('Could not save the board'); sfx.nope(); }
    };
    const del = document.createElement('button'); del.type = 'button'; del.className = 'pill'; del.textContent = '✕'; del.setAttribute('aria-label', 'Forget ' + b.name);
    del.onclick = async () => { boardsCache = (boardsCache || []).filter(x => x !== b); await boardsPut(boardsCache); renderBoards(); toast('Forgot ' + b.name); };
    li.append(name, over, open, del); pgBoardsList.appendChild(li);
  }
}
async function openBoards() {
  closeRename(); pgBoards.hidden = false; pgBoardsTip.textContent = 'Opening…';
  // (the name field is not given the focus: on a phone that would bring the keyboard up and shove the board about. it comes
  // up when you tap the field to type)
  pgBoardsIn.value = '';
  boardsCache = await boardsGet(); if (!pgBoards.hidden) renderBoards();
}
function closeBoards() { pgBoards.hidden = true; }
async function saveBoard() {
  const name = pgBoardsIn.value.trim() || 'Board ' + new Date().toLocaleDateString();
  if (!sel.length) return;
  const list = (boardsCache || await boardsGet()).filter(b => b.name !== name);     // the same name is saved over
  list.push(boardSnapshot(name)); boardsCache = list;
  if (await boardsPut(list)) { toast('Saved ' + name); sfx.drop(); pgBoardsIn.value = ''; renderBoards(); }
  else { toast('Could not save the board'); sfx.nope(); }
}
pgBoards.querySelector('[data-b=save]').addEventListener('click', saveBoard);
pgBoards.querySelector('[data-b=close]').addEventListener('click', closeBoards);
pgBoardsIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveBoard(); } else if (e.key === 'Escape') { e.preventDefault(); closeBoards(); } });
/* ---------- batch rename and duplicate ---------- */
// the ticked files in the order they sit on the board, row by row, so a numbered rename follows the layout you made
// (rows are found first, a file joining a row when it sits level with the one before it, then each row goes left to right)
function boardOrder(refs) {
  const have = refs.filter(r => boardPos.has(r)).sort((a, b) => boardPos.get(a).y - boardPos.get(b).y), rows = [];
  for (const r of have) {
    const p = boardPos.get(r), row = rows[rows.length - 1], q = row && boardPos.get(row[row.length - 1]);
    if (row && Math.abs(p.y - q.y) <= Math.min(p.h, q.h) / 2) row.push(r); else rows.push([r]);
  }
  return rows.flatMap(row => row.sort((a, b) => boardPos.get(a).x - boardPos.get(b).x)).concat(refs.filter(r => !boardPos.has(r)));
}
const splitExt = name => { const dot = name.lastIndexOf('.'); return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']; };
const splitName = ref => ref.isDir ? [ref.name, ''] : splitExt(ref.name);
// a pattern: * is the old name (without its extension), a run of # is the count, padded to the run's length or to the
// count's own width. a pattern with no # gets a number on the end when more than one file is renamed. extensions stay
function patternNames(refs, pat) {
  pat = String(pat || '').trim(); const n = refs.length, w = String(n).length;
  // one file is a plain rename: the name is taken as typed, so a # or * in it stays a # or *
  if (n === 1) return pat ? [pat + splitName(refs[0])[1]] : [''];
  if (!pat.includes('#')) pat += ' #';
  return refs.map((ref, i) => {
    const [stem, ext] = splitName(ref);
    // (the old name goes in through a function, so a $ in it is kept as written)
    const name = pat.replace(/#+/g, run => String(i + 1).padStart(Math.max(run.length, run.length === 1 ? w : 0), '0')).replace(/\*/g, () => stem).trim();
    return name ? name + ext : '';
  });
}
// what is wrong with a set of new names, or '' when they can all be used
function renameProblem(refs, names) {
  const mine = new Set(refs);
  for (let i = 0; i < refs.length; i++) {
    const nm = names[i], p = refs[i].parent;
    if (!nm) return 'A name cannot be empty.';
    if (/[\\/:]/.test(nm)) return 'A name cannot have / \\ or : in it.';
    for (let j = 0; j < i; j++) if (names[j] === nm && refs[j].parent === p) return 'Two files would both be called ' + nm + '.';
    const there = p && p.dirs.concat(p.files).find(x => x.name === nm && x !== refs[i]);
    if (there) return (mine.has(there) ? nm + ' is one of the files being renamed. Rename in two steps.' : 'Something called ' + nm + ' is already in ' + p.name + '.');
  }
  return '';
}
const pgRen = sv.querySelector('.pgren'), pgRenIn = pgRen.querySelector('input'), pgRenPv = pgRen.querySelector('.pv');
let pgRenRefs = [], pgRenamed = false;
function openRename() {
  pgRenRefs = boardOrder(pgOn()); if (!pgRenRefs.length) return;
  pgRen.querySelector('b').textContent = 'Rename ' + pgRenRefs.length + (pgRenRefs.length === 1 ? ' item' : ' items');
  pgRenIn.value = pgRenRefs.length === 1 ? splitName(pgRenRefs[0])[0] : '* #';
  pgRen.hidden = false; renderRename(); pgRenIn.focus(); pgRenIn.select();
}
function closeRename() { pgRen.hidden = true; pgRenRefs = []; }
function renderRename() {
  const names = patternNames(pgRenRefs, pgRenIn.value), bad = renameProblem(pgRenRefs, names);
  pgRenPv.innerHTML = '';
  names.slice(0, 4).forEach((nm, i) => { const li = document.createElement('li'); li.textContent = pgRenRefs[i].name + '  →  ' + (nm || '?'); pgRenPv.appendChild(li); });
  if (names.length > 4) { const li = document.createElement('li'); li.textContent = '… and ' + (names.length - 4) + ' more'; pgRenPv.appendChild(li); }
  const tip = pgRen.querySelector('.tip'); tip.textContent = bad || '* is the old name, # counts up'; tip.classList.toggle('bad', !!bad);
  pgRen.querySelector('[data-r=go]').disabled = !!bad || pgBusy;
}
pgRenIn.addEventListener('input', renderRename);
pgRenIn.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); pgRename(); }
  else if (e.key === 'Escape') { e.preventDefault(); closeRename(); }
});
pgRen.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.r === 'go') pgRename(); else closeRename(); });
// the board's cards show the new names at once
function pgRelabel(refs) {
  const set = new Set(refs);
  for (const box of svBoard.children) {
    if (!set.has(box.__ref)) continue;
    // the renamed file gets a fresh item; a song or video keeps its player (and goes on playing) rather than a new one
    const old = box.__card && box.__card.it, it = itemOf(box.__ref); box.title = it.name; box.setAttribute('aria-label', it.name);
    const tk = box.querySelector('.tick'); if (tk) tk.setAttribute('aria-label', 'Select ' + it.name);
    const xb = box.querySelector('.xbar b'); if (xb) xb.textContent = it.name;
    if (old && old !== it) { if (old.audio) it.audio = old.audio; if (old.video) it.video = old.video; }
    if (box.__card) { box.__card.it = it; drawSvCard(box.__card); }
  }
}
async function pgRename() {
  const refs = pgRenRefs, names = patternNames(refs, pgRenIn.value);
  if (!refs.length || pgBusy || renameProblem(refs, names)) return;
  closeRename(); pgBusy = true; renderPanel();
  const done = [];
  for (let i = 0; i < refs.length; i++) {
    const from = refs[i].name; if (names[i] === from) continue;
    if (await renameRef(refs[i], names[i], true)) done.push({ ref: refs[i], from });
  }
  pgBusy = false;
  // (if the board was closed while the renames ran, the stack card is fixed now; otherwise when the board closes)
  if (done.length && !svOpen && sel.length) rebuildStack(false); else if (done.length) pgRenamed = true;
  if (done.length) { undoLog.push({ t: 'renameMany', items: done }); pgRelabel(done.map(d => d.ref)); renderSel(); toastUndo('Renamed ' + done.length + (done.length === 1 ? ' item' : ' items')); }
  if (svOpen) renderPanel();
}
// undo for a batch rename: back to the old names, last first
async function renameBack(items) {
  let n = 0;
  for (const it of items.slice().reverse()) if (inTree(it.ref) && await renameRef(it.ref, it.from, true)) n++;
  // the stack card shows a name too: fixed now if the board is shut, when it shuts if not
  if (n && !svOpen && sel.length) rebuildStack(false); else if (n && svOpen) pgRenamed = true;
  if (svOpen) { pgRelabel(items.map(i => i.ref)); renderPanel(); }
  return n;
}
// duplicate: a copy of each ticked file next to it, in its own folder. undo puts the copies in .trash
async function pgDuplicate() {
  const on = pgOn(); if (!on.length || pgBusy || !canDo('duplicate')) return;
  pgBusy = true; renderPanel();
  const copies = [], failed = [];
  for (const ref of on) {
    if (!ref.parent) continue;
    const r = await prov.duplicate(ref);
    if (!r.ok) { failed.push(ref.name + (r.err ? ' (' + r.err + ')' : '')); continue; }
    const have = ref.parent.dirs.concat(ref.parent.files).find(x => x.name === r.name);
    const c = have || addLocal(ref.parent, cloneLocal(ref, ref.parent, r.name));
    if (!have && c.isDir && MODE === 'bridge') { c.listed = false; c.files = []; c.dirs = []; }
    copies.push(c);
  }
  pgBusy = false; treeChanged(null); if (svOpen) renderPanel();
  if (copies.length) { undoLog.push({ t: 'madeMany', refs: copies }); toastUndo('Made ' + copies.length + (copies.length === 1 ? ' copy' : ' copies') + (failed.length ? '. Failed: ' + failed.join(', ') : '')); sfx.select(); }
  else if (failed.length) { toast('Nothing duplicated. ' + failed.join(', ')); sfx.nope(); }
}
async function pgTrash() {
  const on = pgOn(); if (!on.length || pgBusy) return;
  if (MODE === 'live') { toast('Trash only works inside Obsidian.'); sfx.nope(); return; }
  const ok = [], failed = [];
  if (MODE === 'bridge') {
    pgBusy = true; renderPanel();
    const was = new Map(on.map(r => [r, pathOf(r)]));
    const m = await pgAsk('trashMany', { paths: on.map(r => was.get(r)) });
    pgBusy = false;
    if (m.cancelled) { renderPanel(); return; }
    if (!m.results && m.err) { renderPanel(); toast('Could not trash: ' + m.err); sfx.nope(); return; }
    const res = new Map((m.results || []).map(x => [x.p, x]));
    for (const ref of on) { const x = res.get(was.get(ref)); if (x && x.ok) ok.push(ref); else failed.push(ref.name + (x && x.err ? ' (' + x.err + ')' : '')); }
  } else {
    if (!confirm('Move ' + on.length + (on.length === 1 ? ' item' : ' items') + ' to .trash?')) return;
    ok.push(...on);
  }
  // (a file inside a trashed folder goes with it, and removeLocal only takes an entry out of a list it is really in: a vault
  // change may already have removed it)
  const inner = nestedIn(ok); ok.filter(r => !inner.has(r)).forEach(removeLocal);
  pgDone(ok);
  if (ok.length) { toast('Moved ' + ok.length + ' to .trash' + (failed.length ? '. Failed: ' + failed.join(', ') : '') + DONE_NOTE); sfx.drop(); }
  else if (failed.length) { toast('Nothing trashed. ' + failed.join(', ')); sfx.nope(); }
}
/* ---------- pointers ----------
   on a file: drag moves it, hold it still and a string comes out, a right-button drag resizes it from wherever you took
   hold of it (like AltSnap: a corner, a side, or the middle for all round), a double click opens it up. a tap picks a
   file and shows its box: dragging that box's edges is the same resize, for a touch screen.
   on the empty board: the mouse draws a lasso (the files inside are ticked or unticked), the middle button pans, scroll
   pans, Alt + scroll zooms. a finger pans; hold it still first and it draws the lasso. two fingers pinch.
   the board only closes from its ✕, Esc, or a double tap on its empty board (Obsidian keeps the Android back button for itself) */
const svPtr = new Map();
let svDrag = null, svLastTap = null, svPicked = null;
const svLocal = e => { const r = sv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const toBoard = (lx, ly) => [(lx - board.x) / board.z, (ly - board.y) / board.z];
const MIN_W = 40;
sv.addEventListener('contextmenu', e => { if (e.target.closest('.board, .links') || e.target === sv) e.preventDefault(); });
// the file a tap picked: its box shows, with handles on every corner and side
function pickBox(box) {
  if (svPicked === box) return;
  if (svPicked) { svPicked.classList.remove('picked'); for (const h of svPicked.querySelectorAll('.bb')) h.remove(); }
  svPicked = box;
  if (box) {
    box.classList.add('picked');
    for (const z of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) { const h = document.createElement('div'); h.className = 'bb'; h.dataset.z = z; box.appendChild(h); }
  }
}
// which part of a file the pointer took hold of, AltSnap style: thirds across and down. the middle third of both is
// the centre (it grows or shrinks all round)
function zoneAt(p, bx, by) {
  const fx = (bx - p.x) / p.w, fy = (by - p.y) / p.h;
  return (fy < 1 / 3 ? 'n' : fy > 2 / 3 ? 's' : '') + (fx < 1 / 3 ? 'w' : fx > 2 / 3 ? 'e' : '') || 'c';
}
// the resize itself, from the size the file had when the drag began (no snapping, no lining up: you shape it as you like)
function resizeBy(d, dx, dy) {
  const p = d.p, z = d.zone; let x = d.px, y = d.py, w = d.pw, h = d.ph;
  // an opened note, drawing or folder keeps at least its header and a little of what is inside
  const MIN_H = p.big && HEADED.has(p.big.kind) ? p.big.hh + 48 : 24;
  if (z === 'c') { w = Math.max(MIN_W, d.pw + 2 * dx); h = Math.max(MIN_H, d.ph + 2 * dy); x = d.px + (d.pw - w) / 2; y = d.py + (d.ph - h) / 2; }
  else {
    if (z.includes('e')) w = Math.max(MIN_W, d.pw + dx);
    if (z.includes('w')) { w = Math.max(MIN_W, d.pw - dx); x = d.px + d.pw - w; }
    if (z.includes('s')) h = Math.max(MIN_H, d.ph + dy);
    if (z.includes('n')) { h = Math.max(MIN_H, d.ph - dy); y = d.py + d.ph - h; }
  }
  Object.assign(p, { x, y, w, h, sized: true });
  placeBoardItem(d.box); placeTies(); phys.awake = 1;
  // a drawn card is drawn again as it changes shape, now and then while you drag and once more at the end
  if (d.box.__card && performance.now() - (d.drawn || 0) > 120) { d.drawn = performance.now(); drawSvCard(d.box.__card); }
}
// the lasso: a loop drawn on the board; a file whose middle is inside it is ticked if it was not, unticked if it was
function lassoPath(d) { d.path.setAttribute('d', 'M' + d.pts.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L') + ' Z'); }
function inLoop(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function lassoDone(d) {
  d.path.remove();
  if (d.pts.length < 3) return;
  let n = 0;
  for (const box of svBoard.children) {
    const p = boardPos.get(box.__ref); if (!p || !inLoop(d.pts, p.x + p.w / 2, p.y + p.h / 2)) continue;
    const ref = box.__ref; if (pgOff.has(ref)) pgOff.delete(ref); else pgOff.add(ref);
    markTick(box); n++;
  }
  if (n) { sfx.select(); renderPanel(); if (!pgRen.hidden) closeRename(); }
}
function startLasso(d, lx, ly) {
  const path = document.createElementNS(SVGNS, 'path'); path.classList.add('lasso'); svLinks.appendChild(path);
  Object.assign(d, { mode: 'lasso', path, pts: [toBoard(lx, ly)] }); lassoPath(d);
}
// while a string is out, the file under the pointer lights up the same way as the one it came from
function tieTarget(d, e) {
  const hit = document.elementFromPoint(e.clientX, e.clientY), to = hit && hit.closest('#sv .item');
  const t = to && to.__ref !== d.from ? to : null;
  if (d.target !== t) { if (d.target) d.target.classList.remove('target'); if (t) t.classList.add('target'); d.target = t; }
}
sv.addEventListener('pointerdown', e => {
  e.stopPropagation();
  if (e.target.closest('.ops, .pgren, .pgboards, .pged, .pgx, .xbar button, .embed .txt')) return;
  if (e.target.classList.contains('tick')) { if (e.button === 0) toggleTick(e.target.parentNode); return; }
  if (e.button > 2) return;
  const [lx, ly] = svLocal(e);
  svPtr.set(e.pointerId, { x: lx, y: ly });
  try { sv.setPointerCapture(e.pointerId); } catch (err) { }
  board.anchor = board.glide = null; board.zt = board.z;
  if (svPtr.size === 2) {
    // a second finger turns whatever the first was doing into a pinch: a string or lasso half drawn goes away with it
    if (svDrag) clearTimeout(svDrag.hold);
    if (svDrag && svDrag.mode === 'tie') { svDrag.line.remove(); svDrag.box.classList.remove('stringing'); if (svDrag.target) svDrag.target.classList.remove('target'); }
    if (svDrag && svDrag.mode === 'lasso') svDrag.path.remove();
    if (svDrag && svDrag.box) svDrag.box.classList.remove('lift');
    const [a, b] = [...svPtr.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    svDrag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: board.z, bx: (mx - board.x) / board.z, by: (my - board.y) / board.z };
    return;
  }
  if (svPtr.size > 2) return;
  // a tap on a string cuts it
  if (e.button === 0 && e.target.classList.contains('tie') && !e.target.classList.contains('draft')) { svPtr.delete(e.pointerId); tie(e.target.__a, e.target.__b); return; }
  const box = e.target.closest('.item');
  const [bx, by] = toBoard(lx, ly);
  if (box && e.button !== 1) {
    box.style.zIndex = ++board.top;
    const p = boardPos.get(box.__ref), handle = e.target.classList.contains('bb') ? e.target.dataset.z : null;
    const base = { box, p, id: e.pointerId, x0: lx, y0: ly, px: p.x, py: p.y, pw: p.w, ph: p.h, moved: false };
    // the right button, or a handle on a picked file's box: resize from where it was taken hold of
    if (e.button === 2 || handle) { svDrag = Object.assign(base, { mode: 'size', zone: handle || zoneAt(p, bx, by) }); box.classList.add('sizing'); return; }
    box.classList.add('lift');
    const d = svDrag = Object.assign(base, { mode: 'move' });
    // held still for a moment, the file lets out a string that follows the pointer until it is let go on another file
    d.hold = setTimeout(() => {
      if (svDrag !== d || d.moved) return;
      const l = document.createElementNS(SVGNS, 'line'); l.classList.add('tie', 'draft'); svLinks.appendChild(l);
      box.classList.remove('lift'); box.classList.add('stringing');
      Object.assign(d, { mode: 'tie', from: box.__ref, line: l }); tieDraft(d.lastX ?? lx, d.lastY ?? ly); sfx.tick();
    }, STRING_HOLD_MS);
    return;
  }
  // the empty board: the mouse draws a lasso, the middle button pans; a finger pans, or held still first, lassos
  const d = svDrag = { mode: 'pan', id: e.pointerId, x0: lx, y0: ly, bx: board.x, by: board.y, moved: false, touch: e.pointerType !== 'mouse' };
  if (e.button === 0 && e.pointerType === 'mouse') startLasso(d, lx, ly);
  else if (d.touch) d.hold = setTimeout(() => { if (svDrag === d && !d.moved) { startLasso(d, lx, ly); sfx.tick(); } }, STRING_HOLD_MS);
});
sv.addEventListener('pointermove', e => {
  // (a drag inside the editor panel belongs to its library, which listens on the window: the waveform's mark and its
  // handles are moved by finger there, so those moves must get through)
  if (e.target.closest && e.target.closest('.pged')) return;
  e.stopPropagation();
  const q = svPtr.get(e.pointerId); if (!q || !svDrag) return;
  [q.x, q.y] = svLocal(e);
  if (svDrag.mode === 'pinch') {
    const [a, b] = [...svPtr.values()]; if (!b) return;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    board.z = board.zt = clamp(svDrag.z0 * Math.hypot(a.x - b.x, a.y - b.y) / svDrag.d0, BOARD_ZOOM[0], BOARD_ZOOM[1]);
    board.x = mx - svDrag.bx * board.z; board.y = my - svDrag.by * board.z; applyBoard();
    return;
  }
  if (e.pointerId !== svDrag.id) return;
  const dx = q.x - svDrag.x0, dy = q.y - svDrag.y0, d = svDrag;
  d.lastX = q.x; d.lastY = q.y;
  if (d.mode === 'tie') { tieDraft(q.x, q.y); tieTarget(d, e); return; }
  if (d.mode === 'lasso') { const pt = toBoard(q.x, q.y), last = d.pts[d.pts.length - 1]; if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) * board.z > 3) { d.pts.push(pt); lassoPath(d); } d.moved = true; return; }
  if (!d.moved && Math.hypot(dx, dy) < 4) return;
  d.moved = true; clearTimeout(d.hold);
  if (d.mode === 'pan') { sv.classList.add('panning'); board.x = d.bx + dx; board.y = d.by + dy; applyBoard(); }
  else if (d.mode === 'move') { d.p.x = d.px + dx / board.z; d.p.y = d.py + dy / board.z; placeBoardItem(d.box); placeTies(); phys.awake = 1; }
  else if (d.mode === 'size') resizeBy(d, dx / board.z, dy / board.z);
});
function svRelease(e) {
  if (e.target.closest && e.target.closest('.pged') && !svPtr.has(e.pointerId)) return;     // (a finger lifted off the editor's waveform: its library ends the drag)
  e.stopPropagation();
  if (!svPtr.has(e.pointerId)) return;
  svPtr.delete(e.pointerId);
  const d = svDrag; if (!d) return;
  if (d.mode === 'pinch') { svDrag = null; return; }     // the other finger does nothing more until it lifts too
  clearTimeout(d.hold);
  if (d.mode === 'tie' && e.pointerId === d.id) {
    svDrag = null; d.line.remove(); if (d.box) d.box.classList.remove('stringing'); if (d.target) d.target.classList.remove('target');
    const hit = document.elementFromPoint(e.clientX, e.clientY), to = hit && hit.closest('#sv .item');
    // (a string that was cancelled by the system ties nothing, and one dropped on a file it is already tied to keeps that
    // tie: only a tap on the string itself cuts it)
    if (to && to.__ref !== d.from && e.type !== 'pointercancel') tie(d.from, to.__ref, true);
    return;
  }
  if (e.pointerId !== d.id) return;
  svDrag = null; sv.classList.remove('panning');
  // a lasso that never moved is a plain click on the background: it lets go of the picked file and closes the cards
  // a tap without a drag on the empty board lets go of the picked file and closes the cards; two taps close the board
  if (d.mode === 'lasso' && !d.moved) { d.path.remove(); if (bgTap()) return; pickBox(null); closeRename(); closeBoards(); return; }
  if (d.mode === 'lasso') { if (e.type === 'pointercancel') d.path.remove(); else lassoDone(d); return; }
  if (d.box) { d.box.classList.remove('lift', 'sizing'); if (d.mode === 'size' && d.box.__card) drawSvCard(d.box.__card); }
  if (d.mode === 'size' || d.moved || e.type === 'pointercancel') return;
  // a tap without a drag: on the background it lets go of the picked file and closes the rename card (the board itself
  // stays open); on a song or video its controls work as on the wheel; on a file it picks it, and twice opens it up
  if (d.mode === 'pan') { if (bgTap()) return; pickBox(null); if (!pgRen.hidden) closeRename(); if (!pgBoards.hidden) closeBoards(); return; }
  const card = d.box.__card, now = performance.now();
  if (card && (card.it.audio || card.it.video)) {
    const rc = card.c.getBoundingClientRect();
    if (mediaPress(card.it, card.hit, (e.clientX - rc.left) / rc.width * card.c.width, (e.clientY - rc.top) / rc.height * card.c.height, { x: e.clientX, y: e.clientY })) { svLastTap = null; return; }
  }
  if (svLastTap && svLastTap.box === d.box && now - svLastTap.t < DBL_MS) { svLastTap = null; toggleExpand(d.box); return; }
  svLastTap = { box: d.box, t: now };
  pickBox(d.box);
}
sv.addEventListener('pointerup', svRelease);
sv.addEventListener('pointercancel', svRelease);
// the magnifier: Alt + scroll zooms smoothly at the pointer (a trackpad pinch arrives as ctrl + scroll); plain scroll pans
sv.addEventListener('wheel', e => {
  // scrolling over a note's text, the side panel or the rename card scrolls that (a zoom still zooms)
  if (e.target.closest('.embed .txt, .ops, .pgren, .pgboards, .pged') && !(e.altKey || e.ctrlKey || e.metaKey)) { e.stopPropagation(); return; }
  e.preventDefault(); e.stopPropagation();
  const k = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1, [lx, ly] = svLocal(e);
  if (e.altKey || e.ctrlKey || e.metaKey) {
    const dy = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * k;
    board.glide = null;
    board.zt = clamp(board.zt * Math.exp(-dy * (e.altKey ? 0.0022 : 0.01)), BOARD_ZOOM[0], BOARD_ZOOM[1]);
    board.anchor = { lx, ly, bx: (lx - board.x) / board.z, by: (ly - board.y) / board.z };
    return;
  }
  board.anchor = board.glide = null; board.zt = board.z;
  board.x -= e.deltaX * k; board.y -= e.deltaY * k; applyBoard();
}, { passive: false });
/* ---------- the physics: like Obsidian's graph view ----------
   every file pushes the ones too close to it away, everything is pulled gently toward the middle, ties pull their two
   files to a set distance. the file you hold stays under your pointer, and what is tied to it follows. it all comes to
   rest and then stops working until something moves again */
const phys = { awake: 0 };
const vel = new Map();          // ref -> [vx, vy] in board pixels a second
const ties = new Map();         // ref -> Set of refs it is tied to, both ways
function tie(a, b, keep) {
  if (a === b) return;
  const on = ties.get(a) && ties.get(a).has(b);
  if (on && keep) return;
  for (const [x, y] of [[a, b], [b, a]]) { if (!ties.has(x)) ties.set(x, new Set()); if (on) ties.get(x).delete(y); else ties.get(x).add(y); }
  drawTies(); phys.awake = 1; sfx.select();
}
// a string only shows (and pulls) while both its files are carried; it is kept for when they are carried again
const tiedNow = r => { const s = ties.get(r); if (!s) return false; for (const b of s) if (selSet.has(b)) return true; return false; };
// ties to files that no longer exist go (a trashed file, say)
function pruneTies() {
  for (const [a, s] of ties) { if (!inTree(a)) { ties.delete(a); continue; } for (const b of s) if (!inTree(b)) s.delete(b); }
}
const SVGNS = 'http://www.w3.org/2000/svg';
function drawTies() {
  svLinks.innerHTML = '';
  for (const [a, s] of ties) for (const b of s) {
    if (!selSet.has(a) || !selSet.has(b) || sel.indexOf(a) > sel.indexOf(b)) continue;     // carried pairs, each once
    // on a touch screen a wide see-through line under the string makes it easy to hit
    if (LITE) { const h = document.createElementNS(SVGNS, 'line'); h.classList.add('tie', 'hit'); h.__a = a; h.__b = b; svLinks.appendChild(h); }
    const l = document.createElementNS(SVGNS, 'line'); l.classList.add('tie'); l.__a = a; l.__b = b; svLinks.appendChild(l);
  }
  placeTies();
}
/* ---------- a file opened up in place ----------
   a double click grows a file where it sits: a picture or video to a big view, a song to a big player, a note to a card
   showing its text that scrolls inside, like a note embedded on a canvas. a bar along its top has Open (the file in
   Obsidian) and a button to shrink it back; a double click shrinks it back too */
const STRING_HOLD_MS = 420;
const TEXTY = /\.(md|txt|csv|json|js|ts|css|html|py|yml|yaml|ini|log|sh)$/i;
// a light reading of markdown: headings, bold, italics, code, list dots and wiki links; everything else stays as written
function mdLite(text) {
  return text.split('\n').map(line => {
    let h = esc(line)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (m, a, b, c) => '<u>' + (c || a) + '</u>');
    const hd = /^(#{1,6})\s+(.*)$/.exec(h);
    if (hd) return '<p class="h' + hd[1].length + '">' + hd[2] + '</p>';
    if (/^\s*[-*]\s+/.test(h)) return '<p class="li">' + h.replace(/^\s*[-*]\s+/, '• ') + '</p>';
    return '<p>' + (h || '&nbsp;') + '</p>';
  }).join('');
}
// a file's text: from Obsidian through the plugin, from the site's server, not at all in the preview
function readText(ref) {
  if (MODE === 'bridge') return pgAsk('read', { p: pathOf(ref) });
  if (MODE === 'live' && prov.fileUrl) return fetch(prov.fileUrl(ref).replace('/api/file?', '/api/open?')).then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status))).then(text => ({ ok: true, text }), e => ({ ok: false, err: e.message }));
  return Promise.resolve({ ok: false, err: 'Notes show their text in Obsidian and on the site.' });
}
// what a double click opens depends on the file:
//   a note or other text: the card stays on top as its header and the text opens below it, in one frame, read only
//   a drawing (Excalidraw): the same, with the drawing below the header, as Obsidian's Excalidraw plugin draws it
//   a folder: a double click pours its files onto the board as cards of their own (see unpackFolder)
//   a song: turns into its cover with a play button, as in a scaled folder, and back
//   a picture, a video or anything else: grows to a big view in its frame
// the state lives on the file's board place (p.big), so an opened file stays open when the board closes and comes back
// the kinds that open below their own card, which stays on top as a header strip
const HEADED = new Set(['text', 'draw']);
function openKind(ref, it) {
  if (ref.isDir) return 'folder';
  if (/\.excalidraw(\.md)?$/i.test(ref.name)) return 'draw';
  if (it.kind === 'audio') return 'song';
  if (!it.media && TEXTY.test(ref.name)) return 'text';
  return 'media';
}
// a drawing, as a picture, from the Excalidraw plugin through ours (only inside Obsidian)
function readDrawing(ref) {
  if (MODE !== 'bridge') return Promise.resolve({ ok: false, err: 'Drawings open inside Obsidian.' });
  return pgAsk('excalidraw', { p: pathOf(ref) }).then(m => m && m.ok && m.svg ? m : { ok: false, err: (m && m.err) || 'Could not draw it' });
}
// the inside of an opened file, built from its state (also when the board comes back with it open)
function buildOpen(box) {
  const ref = box.__ref, p = boardPos.get(ref), b = p && p.big; if (!b) return;
  box.classList.add('big', 'open-' + b.kind); box.style.setProperty('--hh', b.hh + 'px');
  const bar = document.createElement('div'); bar.className = 'xbar';
  bar.innerHTML = '<b></b><button type="button" class="pill" data-x="open">Open</button><button type="button" class="pill" data-x="edit" title="Edit" aria-label="Edit">✎</button><button type="button" class="pill" data-x="shrink" aria-label="Shrink back">✕</button>';
  bar.querySelector('b').textContent = ref.name; box.appendChild(bar);
  { const it2 = itemOf(ref), canEdit = !ref.isDir && (it2.kind === 'audio' || it2.media === 'image' || it2.media === 'video'); if (!canEdit) bar.querySelector('[data-x=edit]').remove(); }
  if (b.kind === 'song' && box.__card) box.__card.tile = true;
  if (b.kind !== 'text' && b.kind !== 'draw') return;
  const em = document.createElement('div'); em.className = 'embed'; box.appendChild(em);
  // a link in a note is never followed in here, which would replace the page: Obsidian opens it
  em.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a'); if (!a) return;
    e.preventDefault();
    if (MODE === 'bridge') pgAsk('openLink', { href: a.getAttribute('data-href') || a.getAttribute('href') || '', from: pathOf(ref) }).then(m => { if (m && m.ok === false && m.err) toast(m.err); });
  });
  const say = (t, msg) => { t.textContent = ''; const i = document.createElement('i'); i.textContent = msg; t.appendChild(i); };
  // a drawing: as Obsidian's Excalidraw plugin draws it, shown as an <img> (an svg there cannot run anything)
  const showDrawing = () => {
    em.innerHTML = '<div class="txt draw"><p><i>Opening…</i></p></div>';
    readDrawing(ref).then(r => {
      const t = em.querySelector('.txt'); if (!t.isConnected) return;
      if (!r.ok) return say(t, r.err);
      t.textContent = ''; const img = document.createElement('img'); img.alt = ref.name; img.draggable = false;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg); t.appendChild(img);
    });
  };
  if (b.kind === 'text') {
    em.innerHTML = '<div class="txt"><p><i>Opening…</i></p></div>';
    readText(ref).then(r => {
      const t = em.querySelector('.txt'); if (!t.isConnected) return;
      if (!r.ok) return say(t, r.err || 'Could not read it');
      const text = String(r.text || '');
      // a note that is really an Excalidraw drawing (its name need not say so) opens as the drawing, not its raw data
      if (/^---[\s\S]*?excalidraw-plugin\s*:/m.test(text.slice(0, 4000)) || /^#+\s*Excalidraw Data\s*$/m.test(text)) {
        b.kind = 'draw'; box.classList.remove('open-text'); box.classList.add('open-draw'); return showDrawing();
      }
      // in Obsidian a markdown note comes back drawn by Obsidian itself (cleaned of anything that could run); anything else,
      // or an older plugin, gets the light reading here
      const plain = () => { t.innerHTML = mdLite(text.slice(0, 200000)) || '<p><i>Empty</i></p>'; };
      if (MODE === 'bridge' && /\.md$/i.test(ref.name)) pgAsk('renderMd', { p: pathOf(ref) }).then(m => {
        if (!t.isConnected) return;
        if (m && m.ok && typeof m.html === 'string') { t.classList.add('md'); t.innerHTML = m.html || '<p><i>Empty</i></p>'; } else plain();
      }); else plain();
    });
  } else if (b.kind === 'draw') {
    showDrawing();
  }
}
/* ---------- a folder on the board: a double click pours its contents onto the board ----------
   the folder's card goes, and every file in it (and in the folders inside it) is carried in its place, each as a real
   card you can move, string, tick, open up, move or trash, as if you had picked them all up by hand. a bulk add */
async function unpackFolder(box) {
  const dir = box.__ref, p = boardPos.get(dir); if (!dir.isDir || !p || pgBusy) return;
  pgBusy = true; renderPanel();
  // every folder in it is listed first (a folder not opened yet this session has no file list)
  const dirs = [];
  (function walk(d) { dirs.push(d); for (const c of d.dirs) walk(c); })(dir);
  await Promise.all(dirs.map(d => d.listed ? null : new Promise(res => { const t = setTimeout(res, 8000); prov.ensure(d, () => { clearTimeout(t); res(); }); if (d.listed) { clearTimeout(t); res(); } })));
  const files = []; for (const d of dirs) for (const f of d.files) if (!selSet.has(f)) files.push(f);
  pgBusy = false;
  if (!files.length) { renderPanel(); toast(dir.name + ' has no files in it'); sfx.nope(); return; }
  if (files.length > 400) { renderPanel(); toast(dir.name + ' holds ' + files.length + ' files, too many for one board (400 at most)'); sfx.nope(); return; }
  // the files take the folder's place in the carry, laid out in rows from where its card was
  const wasOff = pgOff.has(dir), tiedTo = ties.get(dir) ? [...ties.get(dir)] : [];
  pgHold = true; closeStackView();
  const at = sel.indexOf(dir);
  const kept = sel.filter(r => r !== dir); kept.splice(at < 0 ? kept.length : at, 0, ...files); setSel(kept);
  boardPos.delete(dir); pgOff.delete(dir); ties.delete(dir); for (const t of tiedTo) { const s = ties.get(t); if (s) s.delete(dir); }
  const gap = 22, rh = PG_ROW(), rowW = Math.max(rh * 3, Math.sqrt(files.length) * rh * 1.6);
  let x = p.x, y = p.y, rowH = 0;
  for (const f of files) {
    const [w, h] = boardSize(itemOf(f), rh);
    if (x > p.x && x - p.x + w > rowW) { x = p.x; y += rowH + gap; rowH = 0; }
    boardPos.set(f, { x, y, w, h, sized: false }); x += w + gap; rowH = Math.max(rowH, h);
    if (wasOff) pgOff.add(f);
  }
  for (const w of wheels) if (!w.dying) refreshKeeping(w);
  settleAfterSelection(null);
  rebuildStack(false); renderSel();
  openStackView(); pgHold = false;
  toast(files.length + (files.length === 1 ? ' file' : ' files') + ' from ' + dir.name + ' are on the board'); sfx.open();
}
function toggleExpand(box, quiet) {
  const ref = box.__ref, p = boardPos.get(ref), it = itemOf(ref); if (!p) return;
  if (ref.isDir && !p.big) { if (!quiet) unpackFolder(box); return; }
  // a song opens straight into the sound editor (no cover tile in between)
  if (!p.big && (it.kind === 'audio' || it.media === 'video') && !quiet) { openEditor(box); return; }
  if (p.big) {
    // it shrinks where it is now (it may have been dragged, resized or pulled by a string while open)
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, b = p.big;
    Object.assign(p, { w: b.w, h: b.h, sized: b.sized, x: cx - b.w / 2, y: cy - b.h / 2 }); p.big = null;
    box.classList.remove('big', 'open-' + b.kind); box.style.removeProperty('--hh');
    for (const el of box.querySelectorAll('.xbar, .embed')) el.remove();
    if (box.__card) box.__card.tile = false;
  } else {
    const kind = openKind(ref, it), b = p.big = { w: p.w, h: p.h, sized: p.sized, kind, hh: p.h };
    const room = stage.clientHeight * 0.7 / board.z;
    let w, h;
    if (kind === 'text' || kind === 'draw') { w = Math.max(p.w, 380); h = p.h + Math.min(room, 420); }
    else if (kind === 'song') { w = h = Math.min(room, Math.max(p.h * 3, 220)); }
    else { h = Math.min(room, Math.max(p.h * 3, 220)); w = h * p.w / p.h; }
    // never wider or taller than the room the screen has beside the side panel (a phone is narrow), keeping its shape for
    // a picture
    const roomW = Math.max(160, stage.clientWidth - panelRoom() - 24) / board.z, roomH = Math.max(160, stage.clientHeight - 80) / board.z;
    if (w > roomW) { const k = roomW / w; w = roomW; if (!HEADED.has(kind)) h *= k; }
    if (h > roomH) { const k = roomH / h; h = roomH; if (!HEADED.has(kind)) w *= k; }
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2; Object.assign(p, { x: cx - w / 2, y: cy - b.hh / 2, w, h, sized: true });
    if (!HEADED.has(kind)) p.y = cy - h / 2;
    // and nudged so all of it is in view
    const [vx0, vy0] = toBoard(12, 56), [vx1, vy1] = toBoard(stage.clientWidth - panelRoom() - 12, stage.clientHeight - 12);
    p.x = clamp(p.x, vx0, Math.max(vx0, vx1 - w)); p.y = clamp(p.y, vy0, Math.max(vy0, vy1 - h));
    box.style.zIndex = ++board.top;
    buildOpen(box);
  }
  placeBoardItem(box); if (box.__card) drawSvCard(box.__card); placeTies(); phys.awake = 1; if (!quiet) sfx.open();
  refitImages();     // an opened picture gets the whole file; one shrunk back lets it go
}
function shrinkAll() { for (const box of [...svBoard.querySelectorAll(".item.big")]) toggleExpand(box, true); }
svBoard.addEventListener('click', e => {
  const b = e.target.closest('.xbar button'); if (!b) return;
  const box = b.closest('.item');
  if (b.dataset.x === 'open') openRef(box.__ref); else if (b.dataset.x === 'edit') openEditor(box); else toggleExpand(box);
});
// the tie being drawn runs from the file's middle to the pointer
function tieDraft(lx, ly) {
  const d = svDrag, p = d && boardPos.get(d.from); if (!p) return;
  d.line.setAttribute('x1', p.x + p.w / 2); d.line.setAttribute('y1', p.y + p.h / 2);
  d.line.setAttribute('x2', (lx - board.x) / board.z); d.line.setAttribute('y2', (ly - board.y) / board.z);
}
sv.querySelector('.pgx').addEventListener('click', () => closeStackView());
function placeTies() {
  for (const l of svLinks.children) {
    const p = boardPos.get(l.__a), q = boardPos.get(l.__b); if (!p || !q) continue;
    l.setAttribute('x1', p.x + p.w / 2); l.setAttribute('y1', p.y + p.h / 2); l.setAttribute('x2', q.x + q.w / 2); l.setAttribute('y2', q.y + q.h / 2);
  }
}
function stepPhysics(dt) {
  if (!phys.awake || !svOpen) return;
  dt = Math.min(dt, 1 / 30);
  // only tied files move by themselves: an untied file stays where you put it, like a card on a canvas. a tied group
  // behaves like a little graph: its strings pull to a set length and its files keep from covering each other
  const refs = sel.filter(r => boardPos.has(r) && tiedNow(r)), held = svDrag && svDrag.mode === 'move' ? svDrag.box.__ref : null;
  const n = refs.length, P = refs.map(r => boardPos.get(r)), F = refs.map(() => [0, 0]);
  if (!n) { phys.awake = 0; return; }       // nothing tied, nothing to move: an untied board does no work at all
  const cx = P.map(p => p.x + p.w / 2), cy = P.map(p => p.y + p.h / 2), rad = P.map(p => Math.hypot(p.w, p.h) * 0.42);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ti = ties.get(refs[i]), tied = ti && ti.has(refs[j]);
      let dx = cx[j] - cx[i], dy = cy[j] - cy[i], d = Math.hypot(dx, dy);
      if (d < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = 0.5; }
      const R = rad[i] + rad[j] + 26;
      // a soft wall between tied files that come too close, and the string itself pulling to its length
      let f = d < R ? (R - d) * 18 : 0;
      if (tied) f -= (d - (rad[i] + rad[j] + 40)) * 14;
      if (!f) continue;
      const ux = dx / d, uy = dy / d;
      F[i][0] -= ux * f; F[i][1] -= uy * f; F[j][0] += ux * f; F[j][1] += uy * f;
    }
  }
  let energy = 0;
  // heavy and steady, not springy: the damping is well past the point where anything could swing back, so a pulled file
  // eases in behind the one you drag like a weight on a string and stops without a wobble
  const keep = Math.exp(-15 * dt);
  for (let i = 0; i < n; i++) {
    const r = refs[i], p = P[i];
    if (r === held) { vel.set(r, [0, 0]); continue; }
    const v = vel.get(r) || [0, 0];
    v[0] = (v[0] + F[i][0] * dt) * keep; v[1] = (v[1] + F[i][1] * dt) * keep;
    const sp = Math.hypot(v[0], v[1]); if (sp > 1200) { v[0] *= 1200 / sp; v[1] *= 1200 / sp; }
    vel.set(r, v); p.x += v[0] * dt; p.y += v[1] * dt; energy += sp;
  }
  const moving = new Set(refs);
  for (const box of svBoard.children) if (box.__ref !== held && moving.has(box.__ref)) placeBoardItem(box);
  placeTies();
  // asleep once nothing is really moving and nothing is held
  if (!held && energy < n * 4) phys.awake = 0;
}
// the zoom and the fit ease in; cards are drawn again sharper (or lighter) once a zoom settles
function stepBoard(dt) {
  stepPhysics(dt);
  const a = board.anchor, g = board.glide;
  if (a) {
    board.z = damp(board.z, board.zt, 14, dt); if (Math.abs(board.z - board.zt) < board.zt * 0.002) { board.z = board.zt; board.anchor = null; }
    board.x = a.lx - a.bx * board.z; board.y = a.ly - a.by * board.z; applyBoard();
  } else if (g) {
    board.x = damp(board.x, g.x, 12, dt); board.y = damp(board.y, g.y, 12, dt); board.z = damp(board.z, g.z, 12, dt);
    if (Math.abs(board.x - g.x) < 0.5 && Math.abs(board.y - g.y) < 0.5 && Math.abs(board.z - g.z) < g.z * 0.002) { board.x = g.x; board.y = g.y; board.z = g.z; board.glide = null; }
    applyBoard();
  }
  // once the view settles: what is off the screen stops being painted, and pictures that now show big get the whole file
  if (!board.anchor && !board.glide && !svDrag && (board.x !== board.seenX || board.y !== board.seenY || board.z !== board.seenZ)) {
    board.seenX = board.x; board.seenY = board.y; board.seenZ = board.z; cullBoard(); refitImages();
  }
  const want = clamp(board.z, 1, 4);
  if (!board.anchor && !board.glide && !svDrag && Math.abs(want / board.drawnZ - 1) > 0.2) { board.drawnZ = want; svCards.forEach(drawSvCard); }
}

/* ---------- the editors: a picture, a song or a video opened up on the board gets an ✎ in its bar ----------
   each editor is a known library in the board's own look (vendor/, only run the first time its editor opens): Cropper.js
   for pictures, AudioMass for sound, Clip for video. a save goes over the file itself (the plugin keeps the old bytes in .trash first and checks both); a grabbed frame, or an edit
   a format cannot take, goes beside the original. saving works inside Obsidian (the
   plugin writes the file); on the site and in the preview the editors are there to look at */
sv.insertAdjacentHTML('beforeend', '<div class="pged" role="dialog" aria-label="Editor" hidden><div class="head"><b class="nm"></b><span class="note"></span><span class="grow"></span><span class="why" hidden></span>'
  + '<button type="button" class="pill" data-e="save">Save</button><button type="button" class="pill" data-e="close" aria-label="Close the editor">✕</button></div>'
  + '<div class="work"><div class="busy" hidden></div></div><div class="tools"></div>'
  + '<button type="button" class="xclose" data-e="close" aria-label="Close the editor" title="Close (Esc)">✕</button></div>');
const pgEd = sv.querySelector('.pged'), edWork = pgEd.querySelector('.work'), edTools = pgEd.querySelector('.tools'), edBusy = pgEd.querySelector('.busy');
let ed = null;      // the open editor: { kind, ref, box, url, save(), close() }
// the libraries are on window.__VENDOR, from the page or from their file the first time an editor opens. a file that did not
// come is asked for again the next time
let vendorAsked = null;
function vendorReady() {
  if (window.__VENDOR) return Promise.resolve();
  return vendorAsked || (vendorAsked = prov.pack('vendor').then(t => { window.__VENDOR = JSON.parse(t); }).catch(e => { vendorAsked = null; throw e; }));
}
// a library's text comes out of the base64 the build put on window.__VENDOR and runs once, as a script or a style
const vendorRan = new Set();
function vendorText(key) {
  const b64 = window.__VENDOR && window.__VENDOR[key]; if (!b64) return null;
  const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < u8.length; i++) u8[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(u8);
}
function vendorRun(key) {
  if (vendorRan.has(key)) return true;
  try {
    const text = vendorText(key); if (text === null) return false;
    const el = document.createElement(key.endsWith('Css') ? 'style' : 'script'); el.textContent = text; document.head.appendChild(el);
    vendorRan.add(key); return true;
  } catch (e) { console.warn('vendor ' + key, e); return false; }
}
// the file's bytes: from the plugin in Obsidian, from the server on the site, not at all in the preview
async function readBytes(ref) {
  if (MODE === 'bridge') {
    const m = await pgAsk('readBinary', { p: pathOf(ref) });
    if (m && m.ok && m.buf) return m.buf;
    // a plugin from before the editors answers 'unknown request' (or nothing): a restart loads the new one
    const err = m && m.err || 'no reply';
    throw new Error(/unknown request|no answer|no reply/i.test(err) ? 'Restart Obsidian once to use the editors (the plugin running now is older than this page).' : 'Obsidian could not read the file: ' + err);
  }
  if (MODE === 'live' && prov.fileUrl) { try { const r = await fetch(prov.fileUrl(ref)); return r.ok ? await r.arrayBuffer() : null; } catch (e) { return null; } }
  // the preview has no files, but it has the pictures' own small copies, enough to try the picture editor on
  if (MODE === 'snapshot') { const t = prov.thumbInfo(ref); if (t && t.d) { const r = await fetch(t.d); return r.arrayBuffer(); } }
  return null;
}
// a save over the file itself, so its links hold: the plugin keeps the old bytes in .trash first and checks them there,
// then checks the write; only a whole, non-empty result is sent at all. the card shows the new file straight after
async function writeOver(ref, blob) {
  const buf = await blob.arrayBuffer();
  if (!buf.byteLength) { toast('Nothing was saved: the result came out empty, so the file was left alone.'); sfx.nope(); return false; }
  if (window.__VW_TEST__ && window.__VW_TEST_WRITE__) return window.__VW_TEST_WRITE__(ref, buf);
  if (MODE !== 'bridge') { toast('Saving works inside Obsidian.'); sfx.nope(); return false; }
  const m = await pgAsk('writeBinary', { p: pathOf(ref), buf, over: true });
  if (!m || !m.ok) {
    const why = m && m.err || 'no reply';
    toast(/unknown request|no answer|no reply/i.test(why) ? 'Could not save: restart Obsidian once (the plugin running now is older than this page).' : 'Could not save: ' + why);
    sfx.nope(); return false;
  }
  ref.size = m.size || buf.byteLength; ref.m = m.m || Math.floor(Date.now() / 1000);
  refreshSaved(ref);
  toast('Saved ' + ref.name + (m.backup ? '. The old one is in .trash' : '')); sfx.drop();
  return true;
}
// the card of a file just written over shows the new bytes: its cached pictures go, and a picture on the board takes
// the whole file again
function refreshSaved(ref) {
  forgetItem(ref);
  if (prov.forget) prov.forget(ref);
  shareCache.clear();
  const box = [...svBoard.children].find(b => b.__ref === ref);
  if (box) {
    const it = itemOf(ref), img = box.firstElementChild;
    if (img && img.tagName === 'IMG' && it.media === 'image') { box.__full = true; const src = boardImageSrc(it, true); if (typeof src === 'string') img.src = src; else if (src) src.then(u => { if (u) img.src = u; }); }
    // a song or a video card is made again, so its player loads the new file (the old one would keep playing the old bytes)
    else { if (box.__card) svCards.splice(svCards.indexOf(box.__card), 1); box.remove(); addBoardItem(ref); }
  }
  prov.onChange();
}
// a new file beside the original (numbered if its name is taken), into the tree, and onto the board next to it: a grabbed
// frame, or an edit the file's own format cannot take (the editor says so before)
async function writeOut(ref, name, blob) {
  const dir = pathOf(ref.parent), buf = await blob.arrayBuffer();
  if (!buf.byteLength) { toast('Nothing was saved: the result came out empty.'); sfx.nope(); return false; }
  if (window.__VW_TEST__ && window.__VW_TEST_WRITE__) return window.__VW_TEST_WRITE__(ref, buf, name);
  if (MODE !== 'bridge') { toast('Saving works inside Obsidian.'); sfx.nope(); return false; }
  const m = await pgAsk('writeBinary', { p: (dir ? dir + '/' : '') + name, buf });
  if (!m || !m.ok) { toast('Could not save' + (m && m.err ? ': ' + m.err : '')); sfx.nope(); return false; }
  const have = entryAt(m.newPath), nf = have || addLocal(ref.parent, { name: m.name || name, size: buf.byteLength, m: Math.floor(Date.now() / 1000), parent: ref.parent, isDir: false });
  shareCache.clear(); prov.onChange();
  if (!selSet.has(nf)) {
    const p = boardPos.get(ref) || { x: 0, y: 0, w: 120, h: 80 };
    boardPos.set(nf, { x: p.x + p.w + 22, y: p.y, w: p.w, h: p.h, sized: false });
    pgHold = true; closeStackView();
    sel.push(nf); selSet.add(nf);
    for (const w of wheels) if (!w.dying) refreshKeeping(w);
    settleAfterSelection(null); rebuildStack(false); renderSel();
    openStackView(); pgHold = false;
  }
  toast('Saved ' + nf.name + ' beside the original, and it is on the board'); sfx.drop();
  return true;
}
const busy = on => { edBusy.hidden = !on; if (on) edBusy.textContent = typeof on === 'string' ? on : 'Working…'; };
const edNote = t => { pgEd.querySelector('.note').textContent = t || ''; };
const tool = (html) => { edTools.insertAdjacentHTML('beforeend', html); return edTools.lastElementChild; };
// Save is only live when there is something to save; greyed out, it says why
const saveBtn = pgEd.querySelector('[data-e=save]'), saveWhy = pgEd.querySelector('.why');
function canSave(ok, why) { saveBtn.disabled = !ok; saveBtn.title = ok ? 'Save over the file' : (why || ''); saveWhy.textContent = ok ? '' : (why || ''); saveWhy.hidden = ok; }
function openEditor(box) {
  const ref = box.__ref, it = itemOf(ref), kind = it.kind === 'audio' ? 'audio' : it.media === 'video' ? 'video' : it.media === 'image' ? 'image' : null;
  if (!kind || ed) return;
  if (!window.__VENDOR && !window.__VW_PACKS) { toast('The editors are not in this build.'); sfx.nope(); return; }
  closeRename(); closeBoards(); hideTip();     // a card's tooltip must not sit over the panel
  pgEd.querySelector('.nm').textContent = ref.name; edNote(''); edTools.textContent = '';
  for (const el of [...edWork.children]) if (el !== edBusy) el.remove();
  canSave(false, 'Nothing changed yet');
  // (the sound editor's head: the name, Save, the ✕; no notes)
  saveBtn.hidden = false; saveWhy.hidden = true; if (kind !== 'image') saveWhy.textContent = '';
  pgEd.hidden = false; busy('Opening…');
  ed = { kind, ref, box, url: null, save: null, close: null };
  // a file too big to take apart on a phone is said no to, before any of it is read
  const cap = kind === 'audio' ? 60e6 : kind === 'image' ? 40e6 : 200e6;
  if ((ref.size || 0) > cap) { busy(false); edFail('Too big to edit here (' + Math.round(ref.size / 1e6) + ' MB). The ' + kind + ' editor takes up to ' + Math.round(cap / 1e6) + ' MB.'); return; }
  // whatever goes wrong (a plugin that does not know the request, a file that cannot be read or decoded, a library that
  // will not run), the panel says so and its ✕ still works. a read that gets no answer in 20 s is most likely a plugin
  // that has not been restarted since the editors arrived
  const read = window.__VW_TEST__ && window.__VW_TEST_READ__ ? window.__VW_TEST_READ__(ref) : readBytes(ref);
  const timeout = new Promise(res => setTimeout(() => res('timeout'), 20000));
  Promise.race([Promise.all([read, vendorReady()]).then(r => r[0]), timeout]).then(buf => {
    if (ed === null || ed.ref !== ref) return;
    if (buf === 'timeout') return edFail('No answer from Obsidian. Restart Obsidian once to use the editors.');
    if (!buf) return edFail(MODE === 'snapshot' ? 'The editors work inside Obsidian and on the site.' : 'Could not read the file.');
    ed.url = URL.createObjectURL(new Blob([buf], { type: mimeOf(ref.name) }));
    ed.buf = buf;
    if (window.__VW_TEST__ && window.__VW_TEST_THROW__) throw new Error('test: the editor threw');
    (kind === 'image' ? imageEditor : kind === 'audio' ? audioEditor : videoEditor)(ed);
  }).catch(err => {
    if (ed === null || ed.ref !== ref) return;
    console.warn('editor', err); edFail('The editor could not open. ' + (err && err.message || err));
  });
}
// what went wrong, large, in the middle of the panel, with its own Close (the head may sit under a bar on a small screen)
function edFail(msg) {
  busy(false); edNote(''); canSave(false, '');
  for (const el of [...edWork.children]) if (el !== edBusy) el.remove();
  const f = document.createElement('div'); f.className = 'fail';
  const p = document.createElement('p'); p.textContent = msg; f.appendChild(p);
  const b = document.createElement('button'); b.type = 'button'; b.className = 'pill'; b.dataset.e = 'close'; b.textContent = 'Close'; f.appendChild(b);
  edWork.appendChild(f);
}
// a tap outside the panel closes it (a phone has no Esc)
sv.addEventListener('pointerdown', e => { if (ed && !pgEd.hidden && !e.target.closest('.pged, .ops, .pgx')) { e.stopPropagation(); closeEditor(); } }, true);
function closeEditor() {
  if (!ed) return;
  // edits that were not saved would be lost on the way out: asked about first
  if (ed.dirty && ed.save) {
    if (confirm('Save the changes to ' + ed.ref.name + '?')) {
      // (a save that fails says so and the edits still count as unsaved. a song's or a video's save ends in its own export)
      const was = ed; was.dirty = false; was.saveSaid = false;
      Promise.resolve().then(() => was.save()).then(ok => { if (ok) { if (ed === was) closeEditor(); } else if (!was.saveSaid) was.dirty = true; })
        .catch(err => { was.dirty = true; toast('Could not save: ' + (err && err.message || err)); sfx.nope(); });
      return;
    }
    ed.dirty = false;
  }
  try { if (ed.close) ed.close(); } catch (e) { }
  if (ed.url) URL.revokeObjectURL(ed.url);
  ed = null; pgEd.hidden = true; edTools.textContent = ''; busy(false);
  for (const el of [...edWork.children]) if (el !== edBusy) el.remove();
}
// every Save ends in a toast: saved, or what went wrong
pgEd.addEventListener('click', async e => {
  const b = e.target.closest('.head button, .xclose, .fail button'); if (!b || !ed) return;
  if (b.dataset.e === 'close') closeEditor();
  else if (b.dataset.e === 'save' && ed.save && !b.disabled) {
    b.disabled = true; busy("Saving…"); ed.saveSaid = false;
    try { const ok = await ed.save(); if (ok) closeEditor(); else if (ed && ed.saveSaid !== true && document.getElementById('toast').hidden) { toast('Nothing was saved.'); sfx.nope(); } }
    catch (err) { console.warn('save', err); toast('Could not save: ' + (err && err.message || err)); sfx.nope(); }
    if (ed) { busy(false); b.disabled = false; }
  }
});
function mimeOf(name) {
  const e = name.toLowerCase().split('.').pop();
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac',
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska' })[e] || 'application/octet-stream';
}

/* ---------- pictures: crop, rotate, flip, and brightness, contrast, saturation. a png, jpg or webp is saved over
   itself; a gif, bmp, avif or svg cannot be written back as itself here, so it is saved as a png beside ---------- */
function imageEditor(E) {
  if (!vendorRun('cropperCss') || !vendorRun('cropper')) { edFail('The picture editor is not in this build.'); return; }
  const img = document.createElement('img'); img.alt = E.ref.name; img.src = E.url; edWork.appendChild(img);
  const adj = { b: 100, c: 100, s: 100 }, filt = () => 'brightness(' + adj.b + '%) contrast(' + adj.c + '%) saturate(' + adj.s + '%)';
  const apply = () => { const c = edWork.querySelector('.cropper-container'); if (c) c.style.filter = filt(); };
  const [stem, ext] = splitExt(E.ref.name), lower = ext.toLowerCase();
  const self = lower === '.png' || lower === '.jpg' || lower === '.jpeg' || lower === '.webp';
  edNote(self ? 'Saves over the picture' : 'A ' + lower.slice(1) + ' cannot be written back here: it saves as a png beside');
  let cr = null, touched = false;
  const changed = () => { touched = true; E.dirty = true; canSave(true); };
  img.onload = () => {
    cr = new Cropper(img, { viewMode: 1, autoCropArea: 1, background: false, responsive: true, checkOrientation: false, ready() { busy(false); apply(); }, cropend: changed });
  };
  img.onerror = () => edFail('This picture could not be shown.');
  tool('<button type="button" class="pill" data-t="rl" title="Turn left">⟲</button>').onclick = () => { if (cr) { cr.rotate(-90); changed(); } };
  tool('<button type="button" class="pill" data-t="rr" title="Turn right">⟳</button>').onclick = () => { if (cr) { cr.rotate(90); changed(); } };
  let fx = 1, fy = 1;
  tool('<button type="button" class="pill" title="Flip across">↔</button>').onclick = () => { if (cr) { cr.scaleX(fx = -fx); changed(); } };
  tool('<button type="button" class="pill" title="Flip down">↕</button>').onclick = () => { if (cr) { cr.scaleY(fy = -fy); changed(); } };
  tool('<i class="sep"></i>');
  const ratio = tool('<label>Shape <select><option value="0">free</option><option value="1">1:1</option><option value="1.3333">4:3</option><option value="1.5">3:2</option><option value="1.7778">16:9</option><option value="0.5625">9:16</option></select></label>').querySelector('select');
  ratio.onchange = () => { if (cr) { cr.setAspectRatio(+ratio.value || NaN); changed(); } };
  tool('<i class="sep"></i>');
  for (const [k, label] of [['b', 'Light'], ['c', 'Contrast'], ['s', 'Colour']]) {
    const r = tool('<label>' + label + ' <input type="range" min="40" max="160" value="100"></label>').querySelector('input');
    r.oninput = () => { adj[k] = +r.value; apply(); changed(); };
  }
  tool('<button type="button" class="pill" title="Back to how it was">Reset</button>').onclick = () => { if (cr) { cr.reset(); cr.scaleX(fx = 1); cr.scaleY(fy = 1); } adj.b = adj.c = adj.s = 100; for (const r of edTools.querySelectorAll('input[type=range]')) r.value = 100; ratio.value = '0'; if (cr) cr.setAspectRatio(NaN); apply(); touched = false; canSave(false, 'Nothing changed yet'); };
  E.save = async () => {
    if (!cr || !touched) return false;
    const src = cr.getCroppedCanvas({ maxWidth: 8192, maxHeight: 8192, imageSmoothingQuality: 'high' }); if (!src) throw new Error('the picture could not be drawn (a picture from another origin cannot be read back)');
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.filter = filt(); g.drawImage(src, 0, 0);
    const type = lower === '.webp' ? 'image/webp' : lower === '.jpg' || lower === '.jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise(r => c.toBlob(r, type, 0.92)); if (!blob || !blob.size) throw new Error('the picture could not be encoded');
    const ok = await (self ? writeOver(E.ref, blob) : writeOut(E.ref, stem + '.png', blob));
    if (ok) E.dirty = false;
    return ok;
  };
  E.close = () => { if (cr) cr.destroy(); cr = null; };
}

/* ---------- songs: AudioMass (vendor/audiomass/, MIT, as it is), the whole editor in a frame of its own inside the panel:
   its menus, waveform, selection, effects, undo and export. the file is handed to it as a File; its Export / Download
   is caught on the way out and written over the original when the format is the original's, beside it otherwise ---------- */
function audioEditor(E) {
  const js = vendorText('audiomass'), css = vendorText('audiomassCss'), lame = vendorText('lameWorker'), wav = vendorText('wavWorker');
  if (!js || !css) { edFail('The sound editor is not in this build.'); return; }
  const frame = document.createElement('iframe'); frame.className = 'am'; frame.title = 'Sound editor'; frame.setAttribute('allow', 'microphone');
  frame.src = 'about:blank'; edWork.appendChild(frame);
  let am = null;
  const start = () => {
    const iw = frame.contentWindow, doc = frame.contentDocument; if (!iw || !doc || doc.readyState !== 'complete' && !doc.body) return setTimeout(start, 30);
    try {
      doc.documentElement.innerHTML = '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"></head><body><div id="app"></div></body>';
      const st = doc.createElement('style'); st.textContent = css; doc.head.appendChild(st);
      // its workers (the mp3 and wav writers) are files beside its page out on the web; here they run from their text
      const W = window.Worker, workers = { 'lame.js': lame, 'wav.js': wav };
      iw.Worker = function (u) { const t = workers[String(u)]; if (!t) throw new Error('no worker for ' + u); return new W(URL.createObjectURL(new Blob([t], { type: 'text/javascript' }))); };
      // its export makes a link and clicks it: the bytes go to the vault instead
      const click = iw.HTMLAnchorElement.prototype.click;
      iw.HTMLAnchorElement.prototype.click = function () { if (this.download) { const name = this.download; fetch(this.href).then(r => r.blob()).then(b => exported(name, b), err => { toast('Could not take the export: ' + err.message); sfx.nope(); }); return; } return click.call(this); };
      iw.alert = m => toast(String(m));
      const sc = doc.createElement('script'); sc.textContent = js; doc.body.appendChild(sc);
      if (!iw.PKAudioEditor) throw new Error('AudioMass did not start');
      am = iw.PKAudioEditor.init('app');
      // what belongs to it as a site goes: loading files from elsewhere, drafts, Help; its export is the vault's Save
      const gone = /^(Load from Computer|Load Sample File|Load From URL|Save Draft Locally|Open Local Drafts)$/;
      for (const el of doc.querySelectorAll('.pk_hdr .pk_menu_el')) { const t = el.textContent.trim(); if (gone.test(t)) el.remove(); else if (t === 'Export / Download') { const b = el.querySelector('button') || el; b.textContent = 'Save'; } }
      for (const el of doc.querySelectorAll('.pk_hdr .pk_btn')) { const b = el.querySelector(':scope > button'); if (b && b.textContent.trim() === 'Help') el.remove(); }
      // (the name escaped: the editor puts it into its markup as it is, and in here a file name must not be able to run)
      const file = new iw.File([E.buf], esc(E.ref.name), { type: mimeOf(E.ref.name) });
      am.engine.LoadFile({ files: [file] });
      // every edit it makes goes on its undo stack: that is when there is something to save (the head's Save, or the
      // question on the way out)
      am.listenFor('StatePush', () => { if (am) { E.dirty = true; canSave(true); } });
      busy(false);
    } catch (err) { console.warn('audiomass', err); edFail('The sound editor could not start. ' + (err && err.message || err)); }
  };
  const exported = async (name, blob) => {
    const [, ext] = splitExt(E.ref.name), [, ext2] = splitExt(name);
    busy('Saving…');
    try {
      const ok = ext2.toLowerCase() === ext.toLowerCase() ? await writeOver(E.ref, blob) : await writeOut(E.ref, name, blob);
      // (saved: nothing left to ask about on the way out, or a yes wrote it a second time)
      if (ok) { E.dirty = false; closeEditor(); } else E.dirty = true;
    } catch (err) { E.dirty = true; toast('Could not save: ' + (err && err.message || err)); sfx.nope(); }
    if (am) busy(false);
  };
  // (an about:blank frame is usually there as soon as it is on the page; its load event may already have gone by)
  let started = false; const once = () => { if (started) return; started = true; start(); };
  frame.addEventListener('load', once, { once: true }); setTimeout(once, 50);
  // Save writes the sound back in the file's own format: a wav as a wav, an mp3 as an mp3 (192 kbps); anything else
  // cannot be written as itself here, so it goes as a wav beside. the writing happens in its worker; exported() ends it
  const [stem, ext] = splitExt(E.ref.name), lower = ext.toLowerCase();
  E.save = () => {
    if (!am || !am.engine.is_ready) return false;
    const fmt = lower === '.wav' ? 'wav' : lower === '.mp3' ? 'mp3' : null;
    if (!fmt) toast('A ' + lower.slice(1) + ' cannot be written back as itself here: saved as a wav beside it');
    const buf = am.engine.wavesurfer && am.engine.wavesurfer.backend && am.engine.wavesurfer.backend.buffer, stereo = !!(buf && buf.numberOfChannels === 2);
    E.saveSaid = true; busy('Saving…');
    am.engine.DownloadFile(fmt ? E.ref.name : stem + '.wav', fmt || 'wav', 192, false, stereo, 16, false);
    return false;
  };
  E.close = () => { try { if (am && am.engine && am.engine.wavesurfer) am.engine.wavesurfer.pause(); } catch (e) { } frame.remove(); am = null; };
}

/* ---------- videos: Clip (vendor/clip/, MIT, one html file as it is), the whole editor in a frame of its own inside the
   panel: timeline, trim, split, cut, transitions, fades, zoom and pan keyframes, speed, titles, colour cards, undo, and
   an mp4 export (WebCodecs; a webm when that is not there) or a gif. the video is handed to it as a File; its export is
   caught on the way out and written over the original when the format is the original's, beside it otherwise ---------- */
function videoEditor(E) {
  const html = vendorText('clip'), muxer = vendorText('mp4muxer'), gifenc = vendorText('gifenc');
  if (!html) { edFail('The video editor is not in this build.'); return; }
  const frame = document.createElement('iframe'); frame.className = 'am'; frame.title = 'Video editor';
  frame.src = 'about:blank'; edWork.appendChild(frame);
  const [stem, ext] = splitExt(E.ref.name), lower = ext.toLowerCase();
  let iw = null, started = false;
  // the original is never written over with a result that lost its sound or came out suspiciously small: an mp4 with a
  // sound track carries an 'hdlr' box naming 'soun'; a webm or mkv a track of type 2. that is read from the bytes, here
  const hasSound = u8 => {
    const n = u8.length;
    for (let i = 0; i + 4 <= n; i++) {
      if (u8[i] === 0x68 && u8[i + 1] === 0x64 && u8[i + 2] === 0x6c && u8[i + 3] === 0x72) { for (let j = i + 4; j < Math.min(n - 4, i + 28); j++) if (u8[j] === 0x73 && u8[j + 1] === 0x6f && u8[j + 2] === 0x75 && u8[j + 3] === 0x6e) return true; }
      if (u8[i] === 0x83 && u8[i + 1] === 0x81 && u8[i + 2] === 0x02) return true;
    }
    return false;
  };
  const srcSound = hasSound(new Uint8Array(E.buf));
  const exported = async (name, blob) => {
    const [, ext2] = splitExt(name), same = ext2.toLowerCase() === lower;
    busy('Saving…');
    try {
      let beside = !same, out = new Uint8Array(await blob.arrayBuffer());
      if (same && srcSound && !hasSound(out)) {
        if (!confirm('The saved video has no sound, while the original has. Keep the original and save this one beside it?')) { toast('Nothing was saved.'); sfx.nope(); if (iw) busy(false); return; }
        beside = true;
      } else if (same && (out.length < 4096 || out.length < E.buf.byteLength / 50)) {
        if (!confirm('The saved video is much smaller than the original (' + Math.round(out.length / 1e3) + ' KB against ' + Math.round(E.buf.byteLength / 1e3) + ' KB). Keep the original and save this one beside it?')) { toast('Nothing was saved.'); sfx.nope(); if (iw) busy(false); return; }
        beside = true;
      }
      const ok = beside ? await writeOut(E.ref, stem + (same ? ' (edit)' : '') + ext2.toLowerCase(), blob) : await writeOver(E.ref, blob);
      if (ok) { E.dirty = false; closeEditor(); } else E.dirty = true;
    } catch (err) { E.dirty = true; toast('Could not save: ' + (err && err.message || err)); sfx.nope(); }
    if (iw) busy(false);
  };
  // a device that cannot encode sound into an mp4 is said so up front: its Save will go beside the original, silent
  if (srcSound && lower !== '.gif') {
    const say = () => toast('This device cannot encode sound into an mp4: a Save here comes out silent and goes beside the original.');
    if (typeof AudioEncoder === 'undefined') say();
    else AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 }).then(r => { if (!r.supported && ed === E) say(); }, () => { if (ed === E) say(); });
  }
  const start = () => {
    if (started) return; started = true;
    iw = frame.contentWindow; const doc = frame.contentDocument;
    try {
      // the two modules its exports import from the web come from the build instead
      const mod = t => URL.createObjectURL(new Blob([t], { type: 'text/javascript' }));
      let page = html;
      if (muxer) page = page.split('https://cdn.jsdelivr.net/npm/mp4-muxer@5.0.1/build/mp4-muxer.mjs').join(mod(muxer));
      if (gifenc) page = page.split('https://unpkg.com/gifenc@1.0.3/dist/gifenc.esm.js').join(mod(gifenc));
      // its downloads go to the vault; its project store (IndexedDB) has no home in a frame like this
      iw.__vwExport = (name, href) => fetch(href).then(r => r.blob()).then(b => exported(name, b), err => { toast('Could not take the export: ' + err.message); sfx.nope(); });
      page = page.replace('<script>', '<script>HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__vwExport(this.download, this.href); return; } };'
        + 'Object.defineProperty(window, "indexedDB", { value: { open() { throw new Error("no store here"); } } });</script><script>');
      doc.open(); doc.write(page); doc.close();
      if (typeof iw.addFile !== 'function') throw new Error('Clip did not start');
      // what belongs to it as a page goes: adding files from the computer, projects, help; its export is the vault's Save
      for (const id of ['addBtn', 'saveBtn', 'openBtn', 'helpBtn']) { const b = doc.getElementById(id); if (b) b.remove(); }
      const ex = doc.getElementById('exportBtn'); if (ex) ex.textContent = 'Save';
      // (the name escaped: its timeline puts it into its markup as it is, and in here a file name must not be able to run)
      const file = new iw.File([E.buf], esc(E.ref.name), { type: mimeOf(E.ref.name) });
      iw.addFile(file);
      // its undo button comes alive with the first edit: that is when there is something to save
      const undo = doc.getElementById('undoBtn');
      if (undo) new iw.MutationObserver(() => { const d = !undo.disabled; if (d !== !!E.dirty) { E.dirty = d; canSave(d); } }).observe(undo, { attributes: true, attributeFilter: ['disabled'] });
      busy(false);
    } catch (err) { console.warn('clip', err); edFail('The video editor could not start. ' + (err && err.message || err)); }
  };
  frame.addEventListener('load', start, { once: true }); setTimeout(start, 50);
  E.save = () => { if (!iw || typeof iw.exportVideo !== 'function') return false; E.saveSaid = true; busy('Saving…'); iw.exportVideo(); return false; };
  E.close = () => { try { if (iw && typeof iw.pause === 'function') iw.pause(); } catch (e) { } frame.remove(); iw = null; };
}

// a file that leaves the carry keeps its board place and strings for the session (they only show while it is carried), but
// not its speed
function dropGoneVel() { for (const r of [...vel.keys()]) if (!selSet.has(r)) vel.delete(r); }
// the saved boards from anywhere (the bar's Boards button): the board opens, empty if nothing is carried, with the
// boards card up
function openBoardsAnywhere() { if (!svOpen) openStackView(true); if (svOpen) openBoards(); }
window.VWpg = { openBoards: openBoardsAnywhere, boards: () => boardsCache,
  // (tests only: a made-up file in the folder you are in, for the editors to open through __VW_TEST_READ__)
  editor: () => (window.__VW_TEST__ ? ed : null),
  // (tests only: the jobs that are no longer buttons on the panel)
  op: k => { if (!window.__VW_TEST__) return; ({ copy: pgCopy, ren: openRename, dup: pgDuplicate })[k](); },
  testFile: name => { if (!window.__VW_TEST__) return null; const dir = path[path.length - 1], f = addLocal(dir, { name, size: 1000, m: Math.floor(Date.now() / 1000), parent: dir, isDir: false }); shareCache.clear(); prov.onChange(); return f; } };
// a double tap (or double click) on the empty board leaves the playground, the same gesture as opening a file up.
// (Android's back button never reaches the page: Obsidian takes it for its own tabs)
let bgTapAt = 0;
function bgTap() {
  const now = performance.now(), twice = now - bgTapAt < DBL_MS; bgTapAt = twice ? 0 : now;
  if (twice) closeStackView();
  return twice;
}
