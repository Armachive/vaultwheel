/* VaultWheel for Obsidian. The wheel page sits in an iframe inside a view; it asks this plugin for the folder tree,
   a folder's files when that folder is opened, small thumbnails, media to play, moves and opens. Everything comes
   from app.vault, moves go through fileManager.renameFile so links are kept, and nothing is read ahead of time. */
'use strict';
const { Plugin, PluginSettingTab, Setting, ItemView, Notice, Modal, TFile, TFolder, normalizePath, getLinkpath, MarkdownRenderer, Component, Platform } = require('obsidian');

const VIEW = 'vaultwheel-view';
// this device's settings (where the wheel lives, the tablet layout), kept out of data.json since that file syncs. through
// app.saveLocalStorage they are per vault too: the browser's own storage is shared by every vault on a device
const DEVICE = 'vaultwheel-device';
// what an install from before there were settings left in the browser's storage: read once, to carry it over (see loadSettings).
// no public build ever wrote these keys, the first one only read them, so a store build has no read: to it they are just not there
const OLD_KEYS = ['vaultwheel-place', 'vaultwheel-place-2', 'vaultwheel-moved', 'vaultwheel-left-width', 'vaultwheel-tablet-layout'];
const oldKey = k => {
  // #if dev
  try { return localStorage.getItem(k); } catch (e) { /* no storage */ }
  // #endif
  return null;
};
// a module only the desktop app has (null on mobile, which has no node)
const nodeModule = name => { if (!Platform.isDesktopApp || Platform.isMobile) return null; try { return require(name); } catch (e) { return null; } };
// the left sidebar's width: under the first the wheel is too cramped to start in, the second is what it gets then
const LEFT_MIN = 260, LEFT_WIDE = 380;
// the left sidebar's top group, over the wheel, on a computer: these four, the first one showing when the group is first set up,
// and how much of the height it gets when it is new. a phone has no stacked groups, and only All properties stays on its left
const TOP = ['file-properties', 'all-properties', 'backlink', 'outgoing-link'], PROPS = 'all-properties', PROPS_HEIGHT = 27;
const typeOf = l => { const s = l.getViewState ? l.getViewState() : null; return s ? s.type : ''; };
// a wheel that is the only tab of a group in the left sidebar, and the class its group gets for that (see markAlone)
const ALONE_WHEEL = '.mod-left-split .workspace-tabs > .workspace-tab-container > .workspace-leaf:only-child > .workspace-leaf-content[data-type="' + VIEW + '"]', ALONE = 'vaultwheel-alone';
// the class that lets the pointer through the wheel's page while a button pressed out in Obsidian is held (see watchPresses)
const THROUGH = 'vaultwheel-pass';
const THUMB_PX = 360, THUMB_KEEP = 500, THUMB_MAX_PIXELS = 120e6, THUMB_MAX_BYTES = 150 * 1024 * 1024;
const BINARY_MAX = 400 * 1024 * 1024;
// the requests that change something on disk (see handle)
const CHANGES = new Set(['moveMany', 'trashMany', 'copyMany', 'move', 'duplicate', 'rename', 'newFolder', 'newFile', 'writeBinary', 'boardsSave']);
// how much of a video bigger than THUMB_MAX_BYTES is read to take its frame from (its start only, see poster)
const POSTER_HEAD = 64 * 1024 * 1024;
const VIDEO = new Set(['mp4', 'm4v', 'webm', 'mov', 'mkv']);
// what a new empty file is made as text for (no extension counts); anything else is made as an empty binary
const TEXT_EXT = new Set(['', 'md', 'txt', 'rtf', 'canvas', 'excalidraw', 'base', 'json', 'css', 'js', 'ts', 'html', 'htm', 'xml', 'svg', 'sh', 'py', 'lua', 'ini', 'log', 'csv', 'tsv', 'yaml', 'yml']);
// #if dev
// a short sum of a file, to tell a new one from the same one copied over itself
const sumOf = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return s.length + ':' + h; };
// #endif
const sameBytes = (a, b) => {
  const x = new Uint8Array(a), y = new Uint8Array(b);
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
};
// a png's width and height, from its header (null for anything else)
const pngSize = buf => {
  const b = new DataView(buf);
  if (buf.byteLength < 24 || b.getUint32(0) !== 0x89504e47 || b.getUint32(12) !== 0x49484452) return null;
  return [b.getUint32(16), b.getUint32(20)];
};
// a jpeg's width and height, from its frame header (null for anything else). the markers before it are stepped over by
// their lengths, so a small preview jpeg inside the exif block is not mistaken for it
const jpegSize = buf => {
  const b = new DataView(buf), n = buf.byteLength;
  if (n < 4 || b.getUint16(0) !== 0xffd8) return null;
  for (let i = 2; i + 9 < n;) {
    if (b.getUint8(i) !== 0xff) return null;
    const mk = b.getUint8(i + 1);
    if (mk === 0xff) { i++; continue; }
    if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return [b.getUint16(i + 7), b.getUint16(i + 5)];
    if (mk === 0x01 || (mk >= 0xd0 && mk <= 0xd8)) { i += 2; continue; }
    i += 2 + b.getUint16(i + 2);
  }
  return null;
};
const gifSize = buf => {
  const b = new DataView(buf);
  return buf.byteLength >= 10 && b.getUint32(0) === 0x47494638 ? [b.getUint16(6, true), b.getUint16(8, true)] : null;
};
const webpSize = buf => {
  const b = new DataView(buf);
  if (buf.byteLength < 30 || b.getUint32(0) !== 0x52494646 || b.getUint32(8) !== 0x57454250) return null;
  const k = b.getUint32(12);
  if (k === 0x56503820) return [b.getUint16(26, true) & 0x3fff, b.getUint16(28, true) & 0x3fff];            // 'VP8 '
  if (k === 0x5650384c) { const v = b.getUint32(21, true); return [(v & 0x3fff) + 1, ((v >>> 14) & 0x3fff) + 1]; }      // 'VP8L'
  if (k === 0x56503858) return [1 + (b.getUint8(24) | b.getUint8(25) << 8 | b.getUint8(26) << 16), 1 + (b.getUint8(27) | b.getUint8(28) << 8 | b.getUint8(29) << 16)];  // 'VP8X'
  return null;
};
// whether a jpeg's exif says the camera was turned on its side, so that it shows taller than its frame header says
const jpegTurned = buf => {
  const b = new DataView(buf), n = buf.byteLength;
  for (let i = 2; i + 4 < n;) {
    if (b.getUint8(i) !== 0xff) return false;
    const mk = b.getUint8(i + 1), len = b.getUint16(i + 2);
    if (mk === 0xda) return false;
    if (mk === 0xe1 && i + 20 < n && b.getUint32(i + 4) === 0x45786966) {            // 'Exif'
      const t = i + 10, le = b.getUint16(t) === 0x4949, ifd = t + b.getUint32(t + 4, le);
      if (ifd + 2 > n) return false;
      const count = b.getUint16(ifd, le);
      for (let k = 0; k < count && ifd + 14 + k * 12 <= n; k++) if (b.getUint16(ifd + 2 + k * 12, le) === 0x0112) return b.getUint16(ifd + 10 + k * 12, le) >= 5;
      return false;
    }
    i += 2 + len;
  }
  return false;
};
// a picture's width and height as it shows, from its header (null when it cannot be told from these bytes)
const headSize = buf => {
  const s = pngSize(buf) || gifSize(buf) || webpSize(buf); if (s) return s;
  const j = jpegSize(buf); return j && jpegTurned(buf) ? [j[1], j[0]] : j;
};
// how much of a picture is read for its size, and how long a folder's listing waits for the sizes (the rest show as guesses)
const HEAD_BYTES = 128 * 1024, HEAD_MORE = 2 * 1024 * 1024, HEAD_WAIT = 4000;
// how many pictures' sizes are remembered, the oldest going first: a few MB at most, and enough for any folder one goes back to
const SIZE_KEEP = 20000;
const HEADED = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
const IMG = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'svg']);
const MEDIA = new Set(['mp3', 'wav', 'ogg', 'opus', 'flac', 'm4a', 'aac', 'mp4', 'm4v', 'webm', 'mov', 'mkv']);
// songs whose cover art can be read: an id3 tag (mp3, and wav or aac with one), a flac picture block, an m4a covr atom
const ART = new Set(['mp3', 'flac', 'm4a', 'aac', 'wav']);
// the cover picture inside a song file, as its bytes (null when there is none). only the first of each kind is read
function coverOf(buf, ext) {
  const u = new Uint8Array(buf), n = u.length, d = new DataView(buf);
  const str = (i, k) => String.fromCharCode(...u.subarray(i, i + k));
  // id3v2 (at the start of an mp3): frames of APIC (v2.3, v2.4) or PIC (v2.2)
  if (n > 10 && str(0, 3) === 'ID3') {
    const v = u[3], syn = i => (u[i] << 21) | (u[i + 1] << 14) | (u[i + 2] << 7) | u[i + 3], end = Math.min(n, 10 + syn(6));
    let i = 10;
    if (u[5] & 0x40) i += v === 4 ? syn(10) : d.getUint32(10) + 4;      // an extended header is stepped over
    while (i + (v === 2 ? 6 : 10) < end) {
      const id = str(i, v === 2 ? 3 : 4); if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
      const size = v === 2 ? (u[i + 3] << 16) | (u[i + 4] << 8) | u[i + 5] : v === 4 ? syn(i + 4) : d.getUint32(i + 4);
      const at = i + (v === 2 ? 6 : 10);
      if (id === 'APIC' || id === 'PIC') {
        const enc = u[at]; let j = at + 1;
        if (id === 'PIC') j += 3; else { while (j < at + size && u[j]) j++; j++; }      // the format, or the mime type
        j++;                                                                             // the picture type
        if (enc === 1 || enc === 2) { while (j + 1 < at + size && (u[j] || u[j + 1])) j += 2; j += 2; } else { while (j < at + size && u[j]) j++; j++; }
        return j < at + size ? u.subarray(j, at + size) : null;
      }
      i = at + size;
    }
  }
  // flac: metadata blocks after 'fLaC', the picture is type 6
  if (n > 8 && str(0, 4) === 'fLaC') {
    for (let i = 4; i + 4 < n;) {
      const last = u[i] & 0x80, type = u[i] & 0x7f, len = (u[i + 1] << 16) | (u[i + 2] << 8) | u[i + 3], at = i + 4;
      if (type === 6) {
        let j = at + 4; j += 4 + d.getUint32(j); j += 4 + d.getUint32(j); j += 16;
        const k = d.getUint32(j); return u.subarray(j + 4, j + 4 + k);
      }
      if (last) break; i = at + len;
    }
  }
  // m4a: the covr atom holds a data atom (size, 'data', type, locale, then the picture)
  if (ext === 'm4a') for (let i = 4; i + 8 < n; i++) {
    if (u[i] === 0x63 && str(i, 4) === 'covr' && str(i + 8, 4) === 'data') { const size = d.getUint32(i + 4); return size > 16 ? u.subarray(i + 20, i + 4 + size) : null; }
  }
  return null;
}

// what is left of a rendered note: nothing that can run. elements that hold or fetch code go, as do handlers, and any link
// or source but the plain kinds. (the browser ignores spaces and control characters inside a scheme, so they are taken out
// before looking at it: java&#9;script: is still javascript:)
const NOTE_DROP = 'script, iframe, frame, frameset, object, embed, applet, form, link, meta, style, base, animate, animateTransform, animateMotion, set, use';
const NOTE_URL = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'background', 'data', 'ping', 'srcset', 'manifest', 'codebase', 'cite', 'longdesc', 'usemap']);
const NOTE_SAFE = /^(https?:|mailto:|app:|capacitor:|blob:|data:image\/(png|jpe?g|gif|webp|avif|bmp)[;,]|[^:]*$)/;
const cleanNote = el => {
  el.querySelectorAll(NOTE_DROP).forEach(n => n.remove());
  el.querySelectorAll('*').forEach(n => {
    for (const a of [...n.attributes]) {
      const k = a.name.toLowerCase(), v = a.value.replace(/[\u0000- \u007f- ]+/g, '').toLowerCase();
      if (k.startsWith('on') || k === 'srcdoc' || (NOTE_URL.has(k) && !NOTE_SAFE.test(v))) n.removeAttribute(a.name);
    }
  });
};
// the page a store install carries: gzipped, then base64, in VW_PAGE (see tools/release.sh). the browser's own gunzip where
// there is one, a small inflate of our own where there is not (iOS before 16.4, old Android WebViews)
async function unpackPage(b64) {
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (typeof DecompressionStream === 'function') {
    try { return await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); } catch (e) { /* the small one below */ }
  }
  return new TextDecoder().decode(gunzip(bytes));
}
// rfc 1951 inflate behind a gzip header, written for size: the only caller is the line above
function gunzip(u) {
  let at = 10;
  const flg = u[3];
  if (flg & 4) at += 2 + (u[at] | u[at + 1] << 8);
  if (flg & 8) { while (u[at++]); }
  if (flg & 16) { while (u[at++]); }
  if (flg & 2) at += 2;
  // the size it unpacks to is the file's last four bytes
  const n = u.length, size = (u[n - 4] | u[n - 3] << 8 | u[n - 2] << 16 | u[n - 1] << 24) >>> 0, out = new Uint8Array(size);
  let pos = 0, hold = 0, have = 0;
  const bits = c => { while (have < c) { hold |= u[at++] << have; have += 8; } const v = hold & ((1 << c) - 1); hold >>>= c; have -= c; return v; };
  const table = len => {
    const count = new Uint16Array(16), first = new Uint16Array(16), syms = new Uint16Array(len.length);
    for (let i = 0; i < len.length; i++) count[len[i]]++;
    count[0] = 0;
    for (let i = 1; i < 16; i++) first[i] = first[i - 1] + count[i - 1];
    for (let i = 0; i < len.length; i++) if (len[i]) syms[first[len[i]]++] = i;
    return { count, syms };
  };
  const sym = t => {
    let code = 0, base = 0, index = 0;
    for (let l = 1; l < 16; l++) {
      code |= bits(1);
      const c = t.count[l];
      if (code - c < base) return t.syms[index + code - base];
      index += c; base = (base + c) << 1; code <<= 1;
    }
    throw new Error('bad data');
  };
  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  for (let last = 0; !last;) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      hold = 0; have = 0;
      const len = u[at] | u[at + 1] << 8; at += 4;
      out.set(u.subarray(at, at + len), pos); at += len; pos += len;
      continue;
    }
    let lt, dt;
    if (type === 1) {
      lt = table(new Uint8Array(288).fill(8, 0, 144).fill(9, 144, 256).fill(7, 256, 280).fill(8, 280, 288));
      dt = table(new Uint8Array(30).fill(5));
    } else if (type === 2) {
      const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4, cl = new Uint8Array(19);
      for (let i = 0; i < nc; i++) cl[ORDER[i]] = bits(3);
      const ct = table(cl), lens = new Uint8Array(nl + nd);
      for (let i = 0; i < nl + nd;) {
        const s = sym(ct);
        if (s < 16) lens[i++] = s;
        else { const v = s === 16 ? lens[i - 1] : 0; let k = s === 16 ? 3 + bits(2) : s === 17 ? 3 + bits(3) : 11 + bits(7); while (k--) lens[i++] = v; }
      }
      lt = table(lens.subarray(0, nl)); dt = table(lens.subarray(nl));
    } else throw new Error('bad data');
    for (;;) {
      const s = sym(lt);
      if (s < 256) out[pos++] = s;
      else if (s === 256) break;
      else {
        const len = LBASE[s - 257] + bits(LEXT[s - 257]), ds = sym(dt), dist = DBASE[ds] + bits(DEXT[ds]);
        for (let i = 0; i < len; i++, pos++) out[pos] = out[pos - dist];
      }
    }
  }
  return out;
}

// runs first in the page: an error that stops it is told to the view
const PAGE_WATCH = '<script>(function(){var t=function(m){try{parent.postMessage({vw:1,t:"pageError",msg:String(m)},"*")}catch(e){}};addEventListener("error",function(e){t(e.message)});addEventListener("unhandledrejection",function(e){t(e.reason&&e.reason.message||e.reason)})})()<\/script>';

// a modal opened while the wheel has the keyboard remembers the element in the page to give focus back to, and on closing
// asks it the things Obsidian adds to its own windows' nodes. without them Esc on the command palette throws partway through
const frameNodes = f => {
  try {
    const w = f.contentWindow, def = (o, k, d) => { if (!(k in o)) Object.defineProperty(o, k, Object.assign({ configurable: true }, d)); };
    def(w.Node.prototype, 'instanceOf', { writable: true, value(t) { return this instanceof t || (!!w[t.name] && this instanceof w[t.name]); } });
    def(w.Node.prototype, 'win', { get() { return w; } });
    def(w.Node.prototype, 'doc', { get() { return w.document; } });
    def(w.Element.prototype, 'hasClass', { writable: true, value(c) { return this.classList.contains(c); } });
  } catch (e) { /* nothing depends on it but that */ }
};

class WheelView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.navigation = false; }
  getViewType() { return VIEW; }
  getDisplayText() { return 'VaultWheel'; }
  getIcon() { return 'disc'; }
  async onOpen() {
    // (a layout coming in only says so once all of it is ready, and that waits for this page)
    this.plugin.markAlone();
    // the page tells us when you are in the middle of something (carrying, or in the playground), so an update waits
    this.busy = false; this.pendingReload = false;
    this.onMsg = e => {
      if (!this.frame || e.source !== this.frame.contentWindow) return;
      const m = e.data;
      if (m && m.vw && m.t === 'pageError') { if (!this.pageErr) this.pageErr = String(m.msg || ''); return; }
      if (m && m.vw && m.t === 'busy') { this.busy = !!m.v; if (!this.busy && this.pendingReload) this.reload(); return; }
      // a shortcut pressed in the wheel that the wheel has no use for is Obsidian's (ctrl + P, ctrl + comma, every hotkey)
      if (m && m.vw && m.t === 'key' && this.frame) { const w = this.frame.ownerDocument.defaultView; w.dispatchEvent(new w.KeyboardEvent('keydown', { key: m.key, code: m.code, keyCode: m.which, which: m.which, ctrlKey: !!m.ctrl, shiftKey: !!m.shift, altKey: !!m.alt, metaKey: !!m.meta, bubbles: true, cancelable: true })); return; }
      if (m && m.vw && m.t === 'hover') { if (this.plugin.settings.hover) this.takeKeys(); return; }
      if (m && m.vw && m.t === 'leave') { this.giveKeys(!!m.keep); return; }
      if (m && m.vw && m.t === 'themeAsk') { this.plugin.sendThemes(this.frame.contentWindow); return; }
      this.plugin.handle(m, this.frame.contentWindow);
    };
    // when you last pressed a key in Obsidian, so the wheel never takes the keyboard while you are typing in a note
    this.lastKeyAt = 0; this.took = false; this.tookFrom = null;
    this.onKey = () => { this.lastKeyAt = Date.now(); };
    // (a wheel moved to a window of its own talks to that window)
    const listen = w => { this.registerDomEvent(w, 'message', this.onMsg); this.registerDomEvent(w, 'keydown', this.onKey, true); };
    listen(window);
    if (this.containerEl.win && this.containerEl.win !== window) listen(this.containerEl.win);
    this.registerEvent(this.app.workspace.on('window-open', (ww, w) => listen(w)));
    await this.loadPage();
  }
  // (not called load: that is Component's, and over it Obsidian ran this once more on its own, and the view never counted as
  // loaded, so what it registers was never let go when it closed)
  async loadPage() {
    const root = this.contentEl; root.empty(); root.addClass('vaultwheel-host'); this.failEl = null;
    this.frame = null; this.busy = false; this.pendingReload = false; this.pageErr = '';
    // two loads that overlap (an update arriving as the view opens) would each add a page; only the latest one does
    const seq = this.seq = (this.seq || 0) + 1;
    let html;
    try { html = await this.plugin.pageHtml(); }
    catch (e) { if (seq === this.seq) { this.pageUp = Promise.resolve(false); root.createEl('p', { text: 'VaultWheel could not read its page. Try reinstalling the plugin.' }); } return; }
    if (seq !== this.seq) return;
    root.empty();
    const f = root.createEl('iframe');
    // same origin is needed: the page draws the blob links this plugin makes into its canvases and keeps its own storage.
    // that leaves the sandbox little to hold, so what goes in the page is cleaned first (see cleanNote). allow-modals: without
    // it the page's confirm() answers no without asking, and an editor's "save the changes?" lost them
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-modals');
    // (the page's own errors are told to the view, before anything else in it runs, so a page that dies can say why)
    f.srcdoc = html.replace(/<title|<style|<script/i, m => PAGE_WATCH + m);
    this.frame = f;
    // up: the page has finished loading (or never will). someone moving the wheel waits on this before closing the old one
    // (every load: moving the wheel to another window loads its page again)
    f.addEventListener('load', () => { frameNodes(f); if (f.contentWindow) f.contentWindow.postMessage({ vw: 1, t: 'sound', on: this.plugin.settings.sound }, '*'); });
    this.pageUp = new Promise(ok => { f.addEventListener('load', () => ok(true), { once: true }); window.setTimeout(() => ok(false), 30000); });
    this.pageUp.then(() => { if (seq === this.seq) window.setTimeout(() => this.lookAtPage(seq), 3000); });
  }
  // whether the wheel's renderer came up: until it has, its canvas is still the browser's default 300 by 150
  pageDrew() {
    try {
      const f = this.frame, d = f && f.contentDocument, c = d && d.querySelector('#gl');
      return !!c && (c.width !== 300 || c.height !== 150 || (f.clientWidth === 300 && f.clientHeight === 150));
    } catch (e) { return false; }
  }
  // a blank wheel never goes unsaid: a page that did not come up gets a message over it, with a way to try again
  // (looked at again for a while, a slow machine can still get there, and the message goes if it does)
  lookAtPage(seq, tries = 0) {
    if (seq !== this.seq || !this.frame) return;
    const fine = this.pageDrew();
    if (fine) { if (this.failEl) { this.failEl.remove(); this.failEl = null; } return; }
    if (!this.failEl && (this.pageErr || tries >= 3)) {
      const box = this.contentEl.createDiv({ cls: 'vaultwheel-fail' }), gl = /webgl/i.test(this.pageErr);
      box.createEl('p', { text: gl ? 'VaultWheel could not start WebGL here, so the wheel cannot draw. Hardware acceleration may be off (Settings, Appearance).' : 'VaultWheel\'s page did not start.' });
      if (this.pageErr) box.createEl('p', { text: this.pageErr, cls: 'vaultwheel-fail-why' });
      box.createEl('button', { text: 'Try again' }).onclick = () => { box.remove(); this.failEl = null; this.plugin.releaseMedia(); this.loadPage(); };
      this.failEl = box;
    }
    if (tries < 12) window.setTimeout(() => this.lookAtPage(seq, tries + 1), 5000);
  }
  // a new page arrived: swap it in now, or once you are done with what you are doing
  reload() {
    if (this.busy) { this.pendingReload = true; return; }
    this.plugin.releaseMedia();
    this.loadPage().then(() => new Notice('VaultWheel updated'));
  }
  // the pointer moved over the wheel: it takes the keyboard, so the arrows and the wheel's shortcuts work without a click
  // (what it has no use for, ctrl + P and the like, it hands on to Obsidian). not while you are typing in a field (a key in
  // the last second and a half), not while a dialog or menu is open, and not when Obsidian is not the window you are in
  takeKeys() {
    const f = this.frame, doc = f && f.ownerDocument;
    if (!f || !f.contentWindow || !doc.hasFocus()) return;
    const a = doc.activeElement; if (a === f) return;
    const field = a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
    if (field && Date.now() - this.lastKeyAt < 1500) return;
    if (doc.querySelector('.modal-container, .menu')) return;
    this.took = true; this.tookFrom = a && a !== doc.body ? a : null;
    f.focus(); f.contentWindow.focus();
  }
  // the pointer left: the keyboard goes back where it was (a note keeps its cursor), unless you clicked in the wheel
  giveKeys(keep) {
    const f = this.frame, from = this.tookFrom;
    if (!this.took) return;
    this.took = false; this.tookFrom = null;
    if (keep || !f || f.ownerDocument.activeElement !== f) return;
    if (from && from.isConnected) from.focus({ preventScroll: true }); else f.blur();
  }
  onResize() { this.plugin.noteHeight(this.leaf); }
  async onClose() {
    this.seq = (this.seq || 0) + 1;
    // the thumbnails are shared by every open view (a restored layout can hold two), so they go with the last one
    if (!this.app.workspace.getLeavesOfType(VIEW).some(l => l.view !== this && l.view instanceof WheelView)) this.plugin.releaseMedia();
    this.frame = null;
  }
}

// the wheel's two Obsidian themes. Retroma's color scheme is held at triadic flipped, everything else follows Style Settings
const VW_OBSIDIAN_THEMES = [
  { key: 'retroma', dir: 'Retroma', prefix: 'retroma-obsidian-theme@@', mode: 'light', pin: 'rtm-cs-triadic-colors-flipped', pinOver: 'rtm-cs-' },
  { key: 'willemstad', dir: 'Willemstad', prefix: 'V1-Willemstad', mode: 'dark' }
];
// one question for a whole batch; a destructive one gets the red button
class ConfirmBatch extends Modal {
  constructor(app, text, cta, warn, done) { super(app); this.text = text; this.cta = cta; this.warn = warn; this.done = done; this.answered = false; }
  onOpen() {
    this.contentEl.createEl('p', { text: this.text });
    const row = this.contentEl.createDiv({ cls: 'modal-button-container' });
    row.createEl('button', { text: this.cta, cls: this.warn ? 'mod-warning' : 'mod-cta' }).onclick = () => { this.answered = true; this.done(true); this.close(); };
    row.createEl('button', { text: 'Cancel' }).onclick = () => this.close();
  }
  onClose() { this.contentEl.empty(); if (!this.answered) this.done(false); }
}
// the settings tab. where the wheel lives and the tablet layout are this device's own; the rest syncs with data.json
class WheelSettings extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const p = this.plugin, el = this.containerEl, d = p.device;
    el.empty();
    new Setting(el).setName('Where the wheel lives').setDesc('On this device. In a tab nothing else moves. The left sidebar choices give the wheel that sidebar and move its other tabs to the right one; choosing a tab or the right sidebar puts them back. On a computer, under Properties keeps File properties, All properties, Backlinks and Outgoing links in a group above the wheel. One you close there stays closed until you choose this again.')
      .addDropdown(c => c.addOptions({ tab: 'In a tab', left: 'Left sidebar, alone', 'left-props': 'Left sidebar, under Properties', right: 'Right sidebar' })
        .setValue(d.home === 'left' ? (d.props ? 'left-props' : 'left') : d.home)
        .onChange(v => p.chooseHome(v).catch(e => { console.error('VaultWheel: moving the wheel', e); new Notice('The wheel could not move there.'); })));
    if (Platform.isMobile) new Setting(el).setName('Tablet layout on a phone').setDesc('On this device. Holds Obsidian in its tablet layout on a phone screen: tabs, splits and the ribbon. This is not an Obsidian feature and a future version of Obsidian may stop it working.')
      .addToggle(c => c.setValue(!!d.tablet).onChange(v => p.setTablet(v)));
    // (data.json syncs to phones too, where this has no effect: they have no stacked groups)
    if (!Platform.isMobile) {
      new Setting(el).setName('Right sidebar arrangement').setDesc('Outline shows in the top group, the other tabs staying with it, and a file you choose stays open in a group below it, at about half the height. Set up once: after that the tabs and heights are yours, and if you close the file it stays closed until this changes. Turned off, nothing moves back.')
        .addToggle(c => c.setValue(!!p.settings.rightArrange).onChange(v => p.saveRight('rightArrange', v).then(() => this.display()).catch(e => console.error('VaultWheel: arranging the right sidebar', e))));
      if (p.settings.rightArrange) {
        // (carried out when you leave the field, not at each letter)
        const field = (name, desc, k, hint) => new Setting(el).setName(name).setDesc(desc).addText(c => {
          c.setPlaceholder(hint).setValue(p.settings[k] || '');
          c.inputEl.addEventListener('change', () => p.saveRight(k, c.getValue().trim()).catch(e => console.error('VaultWheel: arranging the right sidebar', e)));
        });
        field('File to keep open', 'Its path in the vault.', 'rightFile', 'Folder/Index.base');
        field('View of a base', 'For a .base file, the name of the view to show. Empty, it opens as it does in Obsidian.', 'rightView', 'View name');
      }
    }
    new Setting(el).setName('Hover takes the keyboard').setDesc('The wheel takes the keyboard while the pointer is over it, so its keys work without a click, and gives it back when the pointer leaves. Off, click the wheel first.')
      .addToggle(c => c.setValue(p.settings.hover).onChange(v => p.saveSetting('hover', v)));
    new Setting(el).setName('Sound effects').setDesc('Small sounds as the wheel turns and cards move. Songs and videos you play are not affected.')
      .addToggle(c => c.setValue(p.settings.sound).onChange(v => p.saveSetting('sound', v)));
    // #if dev
    new Setting(el).setName('Reload on update').setDesc('For development. When main.js or vaultwheel.html in the plugin folder changes, loads it without restarting Obsidian.')
      .addToggle(c => c.setValue(p.settings.reload).onChange(v => p.saveSetting('reload', v)));
    // #endif
  }
}
const countOf = (app, paths) => {
  const n = paths.length, dirs = paths.filter(p => app.vault.getAbstractFileByPath(normalizePath(p)) instanceof TFolder).length;
  return n + (dirs ? (n === 1 ? ' folder' : ' items') : (n === 1 ? ' file' : ' files'));
};
// a name the vault cannot show: a hidden name (Obsidian does not index names starting with a dot), a path or a drive
// separator, or nothing at all
const badName = name => !name || /[\\/:]/.test(name) || name.startsWith('.');
// a name inside a folder, as a vault path (the vault's root is '/' or nothing)
const inFolder = (dir, name) => normalizePath((dir.path && dir.path !== '/' ? dir.path + '/' : '') + name);
// a folder that also goes in a batch, if this path is inside one: what is inside it comes along
const holderIn = (dirs, np) => dirs.filter(d => d !== np && np.startsWith(d + '/')).sort((a, b) => a.length - b.length)[0];

module.exports = class VaultWheel extends Plugin {
  async onload() {
    // (nothing moved and nothing forced until the settings are read)
    this.settings = { hover: true, reload: false, sound: false, rightArrange: false, rightFile: '', rightView: '' }; this.device = { home: 'tab' };
    this.blobs = new Set(); this.thumbs = new Map(); this.thumbQ = { low: [], high: [], poster: [], busy: 0, posterBusy: false };
    // the playground's confirmed moves, file's new path -> the folder it came from, so an undo that puts exactly those
    // back can go without asking again (and nothing else can skip the question)
    // (an entry is used once, lapses after ten minutes, and goes when that file is renamed or deleted)
    this.undoable = new Map();
    this.pressWins = new Set(); this.watchPresses(window);
    for (const w of (this.app.workspace.floatingSplit && this.app.workspace.floatingSplit.children) || []) if (w.win) this.watchPresses(w.win);
    this.registerEvent(this.app.workspace.on('window-open', (ww, w) => this.watchPresses(w)));
    this.registerView(VIEW, leaf => new WheelView(leaf, this));
    this.addRibbonIcon('disc', 'Open VaultWheel', () => this.open());
    this.addSettingTab(new WheelSettings(this.app, this));
    this.addCommand({ id: 'open', name: 'Open the wheel', callback: () => this.open() });
    this.addCommand({ id: 'to-left-sidebar', name: 'Put the wheel in the left sidebar', callback: () => this.toSidebar('left', true) });
    this.addCommand({ id: 'to-right-sidebar', name: 'Put the wheel in the right sidebar', callback: () => this.toSidebar('right', true) });
    this.addCommand({ id: 'give-left-back', name: 'Give the left sidebar back', callback: () => this.giveLeftBack() });
    if (Platform.isMobile) this.addCommand({ id: 'tablet-layout', name: 'Tablet layout on this phone (on or off)', callback: () => {
      const on = !this.device.tablet;
      this.setTablet(on); new Notice('Tablet layout on this phone: ' + (on ? 'on' : 'off'));
    } });
    await this.loadSettings();
    if (Platform.isMobile && this.device.tablet) this.tabletLayout(true);
    // #if dev
    // updates (only with the setting on): a new vaultwheel.html or main.js in the plugin folder is noticed within seconds
    // and swapped in. it has to look the same on two checks in a row, so a file still arriving is not read
    // (the read of main.js is not waited for: it can wait, Obsidian's startup can't. a window nobody is looking at doesn't look)
    if (this.settings.reload) this.watchUpdates();
    this.registerInterval(window.setInterval(() => { if (this.settings.reload && this.watched && !document.hidden) this.checkPage(); }, 4000));
    // #endif
    // the wheel's Obsidian themes follow the theme files and Style Settings: looked at again when Obsidian's css changes
    // and every half minute (Style Settings' file changes from another device too), worked out again only when one changed
    this.app.workspace.onLayoutReady(() => window.setTimeout(() => { if (!this.gone) this.refreshThemes(); }, 3000));
    this.app.workspace.onLayoutReady(() => this.keepPlace().catch(e => console.error('VaultWheel: keeping its place', e)));
    this.registerEvent(this.app.workspace.on('css-change', () => this.refreshThemes()));
    // (with no wheel open, or nobody looking, there is nothing to keep up to date: one that opens asks, and gets what is known)
    this.registerInterval(window.setInterval(() => { if (!document.hidden && this.app.workspace.getLeavesOfType(VIEW).length) this.refreshThemes(); }, 30000));
    // changes to the vault from anywhere (a note made in Obsidian, a sync, another plugin) go to any open view, so it
    // shows them without a reload. from when the vault has loaded, so its first indexing is not sent as a flood of creates
    this.app.workspace.onLayoutReady(() => {
      const tell = (kind, f, old) => {
        const msg = { vw: 1, t: 'vaultChange', kind, p: f.path, old: old || null, isDir: f instanceof TFolder,
          size: f instanceof TFile ? f.stat.size || 0 : 0, m: f instanceof TFile ? Math.floor((f.stat.mtime || 0) / 1000) : Math.floor(Date.now() / 1000) };
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) { const v = leaf.view; if (v instanceof WheelView && v.frame && v.frame.contentWindow) v.frame.contentWindow.postMessage(msg, '*'); }
      };
      this.registerEvent(this.app.vault.on('create', f => tell('create', f)));
      this.registerEvent(this.app.vault.on('delete', f => { this.undoable.delete(f.path); tell('delete', f); }));
      this.registerEvent(this.app.vault.on('rename', (f, old) => { this.undoable.delete(old); this.undoable.delete(f.path); tell('rename', f, old); }));
      // an edited picture must be made again, so its thumbnails (both sizes) go
      this.registerEvent(this.app.vault.on('modify', f => { for (const t of [THUMB_PX, 1280]) { const k = f.path + '|' + t, v = this.thumbs.get(k); if (v) this.dropThumb(k, v); } tell('modify', f); }));
    });
  }
  // the settings, read once at the start. a new install moves nothing and forces nothing. an install from before there were
  // settings is known by what it left behind and carries on as it was: its place, the tablet layout, hover and reload on.
  // data.json counts as a sign of that only without a settings key: with one, another device already went through this, and
  // this device is new
  async loadSettings() {
    const data = await this.loadData(), had = data && data.settings;
    let dev = null; try { dev = this.app.loadLocalStorage(DEVICE); } catch (e) { /* no storage */ }
    if (!dev) {
      const old = OLD_KEYS.some(k => oldKey(k) !== null) || (!had && (data !== null || await this.app.vault.adapter.exists(normalizePath(this.manifest.dir + '/boards.json'))));
      dev = old ? this.oldDevice() : { home: 'tab', props: false, closed: false, tablet: false };
      this.device = dev; this.saveDevice();
    }
    // (a device from before the top group held four remembered where its one panel came from)
    if (dev.propsWas) { dev.topWas = Object.assign({ [PROPS]: dev.propsWas }, dev.topWas); delete dev.propsWas; }
    this.device = dev;
    this.settings = Object.assign(dev.legacy ? { hover: true, reload: true, sound: true } : { hover: true, reload: false, sound: false }, { rightArrange: false, rightFile: '', rightView: '' }, had);
    // a new install says so in data.json at once, so a device it syncs to is not taken for an old one. an old one waits for
    // its next save: every device writing the same file at the same moment is what makes sync conflict copies
    if (!had && !dev.legacy) await this.writeData();
  }
  // what the old keys come to. the place as stored ('none': you closed it). the build before last wrote 'none' whenever a saved
  // workspace replaced the layout, so a 'none' from before it (no second key) is not believed, once. a phone or tablet with no
  // place started in the left sidebar. on a computer closing the wheel always led back to a tab
  oldDevice() {
    let place = oldKey('vaultwheel-place');
    if (place === 'none' && !oldKey('vaultwheel-place-2')) place = 'left';
    if (!place && Platform.isMobile) place = 'left';
    const none = place === 'none';
    return { home: place === 'left' || place === 'right' ? place : none && Platform.isMobile ? 'left' : 'tab', props: true, closed: none && Platform.isMobile,
      tablet: oldKey('vaultwheel-tablet-layout') !== 'off', leftWidth: +oldKey('vaultwheel-left-width') || 0, moved: !!oldKey('vaultwheel-moved'), legacy: true };
  }
  saveDevice() { try { this.app.saveLocalStorage(DEVICE, this.device); } catch (e) { /* no storage */ } }
  // data.json holds the page's own settings and, under a key of their own, these. the page saves its part whole, so every
  // write goes through here, one at a time, and neither loses the other's. page: what the page wants saved
  writeData(page) {
    const job = async () => this.saveData(Object.assign({}, page || (await this.loadData()) || {}, { settings: this.settings }));
    const run = (this.dataQ || Promise.resolve()).then(job, job);
    this.dataQ = run.catch(() => { });
    return run;
  }
  async saveSetting(k, v) {
    this.settings[k] = v;
    // #if dev
    if (k === 'reload' && v) await this.watchUpdates();
    // #endif
    if (k === 'sound') this.tellSound();
    await this.writeData();
  }
  tellSound() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) { const v = leaf.view; if (v instanceof WheelView && v.frame && v.frame.contentWindow) v.frame.contentWindow.postMessage({ vw: 1, t: 'sound', on: this.settings.sound }, '*'); }
  }
  // data.json changed from outside (a sync)
  async onExternalSettingsChange() {
    const data = await this.loadData();
    if (!data || !data.settings) return;
    // #if dev
    if (data.settings.reload && !this.settings.reload) await this.watchUpdates();
    // #endif
    Object.assign(this.settings, data.settings);
    this.tellSound();
    if (this.settled) this.arrangeRight(false).catch(e => console.error('VaultWheel: arranging the right sidebar', e));
  }
  // the right sidebar's setting changed here: saved, and carried out now. turned on, it is set up as if for the first time
  async saveRight(k, v) {
    await this.saveSetting(k, v);
    if (k === 'rightArrange') { this.device.rightKey = undefined; this.device.rightGone = false; this.saveDevice(); }
    await this.arrangeRight(false, true);
  }
  setTablet(on) { this.device.tablet = on; this.saveDevice(); this.tabletLayout(on); }
  // the setting: the wheel goes there now, if it is open or the place is a sidebar. a choice here ends an old install's ways
  async chooseHome(v) {
    const d = this.device; d.legacy = false; d.closed = false; d.topPlaced = false; d.topGone = []; this.topStuck = null;
    if (v === 'tab') {
      d.home = 'tab'; this.saveDevice();
      if (this.placeOfWheel() === 'left' || this.placeOfWheel() === 'right') await this.giveLeftBack(); else await this.putBack();
      return;
    }
    d.home = v === 'right' ? 'right' : 'left'; d.props = v === 'left-props'; this.saveDevice();
    await this.toSidebar(d.home, true);
    if (d.home === 'right') await this.putBack();
  }
  // the tabs that moved out of the left sidebar for the wheel go back there, each closed only once its copy is open
  async putBack() {
    const wk = this.app.workspace, d = this.device, was = d.topWas || {};
    // (a top group panel goes back to where it was before the left sidebar choice brought it over, if it did)
    const types = (d.movedRight || []).filter(t => !TOP.includes(t) || !was[t] || was[t] === 'left');
    if ((!types.length && !Object.keys(was).length && !d.rightShut) || this.placing || !wk.getLeftLeaf) return;
    const move = async (l, make) => {
      let to = null;
      try {
        const s = l.getViewState();
        to = make.call(wk, false);
        await to.setViewState(Object.assign({}, s, { active: false }));
        if (to.getViewState().type !== s.type) throw new Error('it came out as ' + to.getViewState().type);
        l.detach();
      } catch (e) { if (to) { try { to.detach(); } catch (e2) { /* it stays empty */ } } }
    };
    this.placing = true;
    try {
      for (const t of types) { const l = wk.getLeavesOfType(t).find(x => x.getRoot() === wk.rightSplit); if (l) await move(l, wk.getLeftLeaf); }
      // (the wheel leaving emptied the left sidebar, and Obsidian closes an empty one: open again, or the tabs that came back are hidden)
      if (types.length && d.home !== 'left' && wk.leftSplit.collapsed && wk.leftSplit.expand) wk.leftSplit.expand();
      for (const t of TOP) {
        // (one made for the group goes, even if the wheel alone in the sidebar sent it right)
        const l = (was[t] === 'right' || was[t] === 'none') && wk.getLeavesOfType(t).find(x => x.getRoot() === wk.leftSplit || (was[t] === 'none' && x.getRoot() === wk.rightSplit));
        if (l && was[t] === 'none') l.detach();
        else if (l) await move(l, wk.getRightLeaf);
      }
      // (a right sidebar opened to show the tabs closes again, unless the wheel lives in it now)
      if (d.rightShut && d.home !== 'right' && wk.rightSplit.collapse) { wk.rightSplit.collapse(); d.rightShut = false; }
      d.movedRight = []; d.topWas = undefined; this.saveDevice();
    } finally { this.placing = false; }
  }
  sendThemes(win) { if (this.themes && win) win.postMessage({ vw: 1, t: 'themeTokens', themes: this.themes }, '*'); }
  async refreshThemes() {
    if (this.themesBusy || this.gone) return;
    this.themesBusy = true;
    try {
      const a = this.app.vault.adapter, cfg = this.app.vault.configDir, tokens = normalizePath(this.manifest.dir + '/theme-tokens.json');
      const settings = normalizePath(cfg + '/plugins/obsidian-style-settings/data.json');
      const stat = async p => { const s = await a.stat(normalizePath(p)); return s ? s.mtime + ':' + s.size : ''; };
      const stamps = [];
      for (const t of VW_OBSIDIAN_THEMES) stamps.push(await stat(cfg + '/themes/' + t.dir + '/theme.css'));
      // neither theme installed (most vaults): the wheel's two keep the colours they were built with, and nothing is read or written
      if (!stamps.some(Boolean)) return;
      const body = getComputedStyle(document.body), accent = ['--accent-h', '--accent-s', '--accent-l'].map(n => n + ':' + body.getPropertyValue(n).trim() + ';').join('');
      const stamp = 'v2|' + accent + (await stat(settings)) + (await stat(cfg + '/appearance.json')) + '|' + stamps.join('|');
      if (this.themes && this.themesStamp === stamp) return;
      let saved = null;
      try { saved = JSON.parse(await a.read(tokens)); } catch (e) { /* not made yet */ }
      let themes = saved && saved.stamp === stamp ? saved.themes : null;
      if (!themes) {
        // (Style Settings is optional: without it a theme is read as it comes)
        let ss = {}; try { ss = JSON.parse(await a.read(settings)) || {}; } catch (e) { /* none */ }
        let fonts = '';
        try { fonts = JSON.parse(await a.read(normalizePath(cfg + '/appearance.json'))).interfaceFontFamily || ''; } catch (e) { /* the default */ }
        themes = {};
        for (let i = 0; i < VW_OBSIDIAN_THEMES.length; i++) {
          const t = VW_OBSIDIAN_THEMES[i]; if (!stamps[i]) continue;
          const r = await this.resolveTheme(t, await a.read(normalizePath(cfg + '/themes/' + t.dir + '/theme.css')), ss, accent, fonts);
          if (r) themes[t.key] = r;
        }
        // the file saves working them out again next time. only the desktop app writes it, only with something real in it,
        // and only with something new: every device writing the same file is what makes sync conflict copies. a phone with
        // no match works them out itself and uses them from memory
        if (Platform.isDesktopApp && Object.keys(themes).length && !(saved && JSON.stringify(saved.themes) === JSON.stringify(themes))) await a.write(tokens, JSON.stringify({ stamp, themes }));
      }
      this.themes = themes; this.themesStamp = stamp;
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) { const v = leaf.view; if (v instanceof WheelView && v.frame) this.sendThemes(v.frame.contentWindow); }
    } catch (e) { /* the wheel keeps the colours it was built with */ }
    finally { this.themesBusy = false; }
  }
  // one theme worked out by the browser itself: a hidden page with Obsidian's own stylesheets, the theme's css and the body
  // classes and variables Style Settings would give it, so this works whichever theme Obsidian has on right now
  async resolveTheme(t, css, ss, accent, fonts) {
    const cl = ['theme-' + t.mode]; let vars = accent;
    for (const k of Object.keys(ss)) {
      if (!k.startsWith(t.prefix)) continue;
      const [, id, side] = k.split('@@'), v = ss[k];
      if (side && side !== t.mode) continue;
      if (v === true) cl.push(id);
      else if (typeof v === 'string' && /^(rtm-|ssopt-)/.test(v)) cl.push(v);
      else if (v !== false) vars += '--' + id + ':' + v + ';';
    }
    // (these go into markup below, so nothing in a settings file can end the attribute or the style it sits in)
    const classes = (t.pin ? cl.filter(c => !c.startsWith(t.pinOver)).concat(t.pin) : cl).filter(c => /^[\w-]+$/.test(c)).join(' ');
    vars = vars.replace(/</g, '');
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => '<link rel="stylesheet" href="' + l.href + '">').join('');
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    // (only stylesheets are wanted from it: nothing in it runs)
    f.setAttribute('sandbox', 'allow-same-origin');
    f.className = 'vaultwheel-probe';
    try {
      await new Promise((ok, no) => {
        f.onload = ok; window.setTimeout(() => no(new Error('timed out')), 20000);
        f.srcdoc = '<!doctype html><html><head>' + links + '<style>' + css.replace(/<\/style/gi, '<\\/style') + '</style><style>body{' + vars + '}</style></head><body class="' + classes + '"><div class="app-container"><button>x</button><i></i></div></body></html>';
        document.body.appendChild(f);
      });
      const d = f.contentDocument, w = f.contentWindow, probe = d.querySelector('i'), cs = w.getComputedStyle(d.body);
      // a variable as a plain color (the first of these that the theme sets)
      const col = (...names) => { for (const n of names) { if (!cs.getPropertyValue('--' + n).trim()) continue; probe.style.color = 'var(--' + n + ')'; return w.getComputedStyle(probe).color; } return ''; };
      const b = w.getComputedStyle(d.querySelector('button'));
      // the bevel only when the theme's button has one: its inset shadow pointing into the top left is the light, the other the shade
      const bevel = {};
      for (const m of b.boxShadow.matchAll(/((?:oklch|rgba?)\([^)]*\))\s+(-?[\d.]+)px\s+-?[\d.]+px[^,]*?inset/g)) bevel[parseFloat(m[2]) > 0 ? 'hi' : 'lo'] = m[1];
      const both = bevel.hi && bevel.lo;
      // Obsidian's --font-interface holds '??' where it fills in the font you chose in Appearance
      const face = (cs.getPropertyValue('--font-interface').trim() || getComputedStyle(document.body).getPropertyValue('--font-interface').trim()).replace(/'\?\?'\s*,?\s*/g, '');
      const chosen = fonts.split(',').map(f => f.trim()).filter(Boolean).map(f => '"' + f.replace(/"/g, '') + '"').join(', ');
      const light = t.mode === 'light';
      const r = { mode: t.mode,
        paper: col('rtm-btn-bg-normal', 'interactive-normal'), primary: col('rtm-bg-primary', 'background-primary-alt'),
        stage: col('rtm-titlebar-bg', 'background-primary'), tube: col('rtm-bg-secondary', 'background-primary'), tube2: col('rtm-bg-secondary', 'background-primary-alt'),
        border: parseFloat(b.borderTopWidth) > 0 && b.borderTopStyle === 'solid' ? b.borderTopColor : col('background-modifier-border'),
        hi: both ? bevel.hi : col('interactive-hover'), lo: both ? bevel.lo : col('background-primary'),
        text: light ? col('text-muted') : col('text-normal'), muted: light ? col('text-normal') : col('text-muted'),
        accent: col('text-accent', 'color-base-70'), accent2: col('rtm-titlebar-bg', 'color-accent'), over: col('rtm-btn-bg-active', 'interactive-hover'),
        select: col('rtm-secondary-accent', 'text-accent', 'color-accent'), font: [chosen, face].filter(Boolean).join(', ') };
      return Object.values(r).every(Boolean) ? r : null;
    } finally { f.remove(); }
  }
  // #if dev
  // what the files look like now, so a change from here on can be told
  async watchUpdates() {
    this.pageStamp = await this.stampOf(); this.seenStamp = this.pageStamp;
    this.mainStamp = await this.stampOf('main.js'); this.mainSeen = this.mainStamp;
    try { this.mainSum = sumOf(await this.app.vault.adapter.read(normalizePath(this.manifest.dir + '/main.js'))); } catch (e) { this.mainSum = ''; }
    this.watched = true;
  }
  async stampOf(name = 'vaultwheel.html') {
    try { const s = await this.app.vault.adapter.stat(normalizePath(this.manifest.dir + '/' + name)); return s ? s.mtime + ':' + s.size : ''; }
    catch (e) { return ''; }
  }
  // a new main.js only runs once Obsidian loads the plugin again, so the plugin does that itself, the way Obsidian's own
  // reload does (off, its manifests read again, on). the open view stays and comes back with the new plugin and its page.
  // like the page, the file has to look the same on two checks in a row, and it waits while you are carrying something.
  // an empty or cut off file (a sync partway) is left alone until it changes again, and the same file copied over
  // itself (every deploy) does nothing. true: the page's own check waits, the new plugin brings the new page with it
  async checkMain() {
    const pl = this.app.plugins, id = this.manifest.id, a = this.app.vault.adapter, ms = await this.stampOf('main.js');
    if (this.reloading) return true;
    if (!ms || ms === this.mainStamp || !pl || typeof pl.disablePlugin !== 'function') { this.mainSeen = ms; return false; }
    if (ms !== this.mainSeen) { this.mainSeen = ms; return true; }
    if (ms === this.mainBad) return false;
    if (this.app.workspace.getLeavesOfType(VIEW).some(l => l.view instanceof WheelView && l.view.busy)) return true;
    let code;
    try {
      code = await a.read(normalizePath(this.manifest.dir + '/main.js'));
      // (whole: its last line has arrived. the name is cut in two here so that this line does not count)
      if (!/module\.exports/.test(code) || !code.includes('// end of ' + 'main.js')) throw new Error('not whole');
    } catch (e) { this.mainBad = ms; return false; }
    if (sumOf(code) === this.mainSum) { this.mainStamp = ms; return false; }
    // (a manifest still arriving is looked at again on the next check)
    try { if (JSON.parse(await a.read(normalizePath(this.manifest.dir + '/manifest.json'))).id !== id) return false; } catch (e) { return false; }
    // (turned off by hand while this looked: it stays off)
    if (pl.plugins && pl.plugins[id] !== this) return true;
    this.mainStamp = ms; this.reloading = true;
    try {
      await pl.disablePlugin(id); if (pl.loadManifests) await pl.loadManifests();
      if (!await pl.enablePlugin(id)) throw new Error('it did not load');
      new Notice('VaultWheel updated');
    } catch (e) {
      console.error('VaultWheel: could not load the new main.js', e);
      this.tabletLayout(false); new Notice('VaultWheel could not load its new version. Restart Obsidian once.');
    }
    return true;
  }
  async checkPage() {
    if (await this.checkMain()) return;
    const st = await this.stampOf();
    if (!st || st === this.pageStamp) { this.seenStamp = st; return; }
    if (st !== this.seenStamp) { this.seenStamp = st; return; }
    this.pageStamp = st;
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) if (leaf.view instanceof WheelView) leaf.view.reload();
  }
  // #endif
  onunload() {
    this.gone = true; this.markAlone();
    for (const w of this.pressWins) { try { w.document.body.classList.remove(THROUGH); } catch (e) { /* a window already closed */ } }
    // (loading itself again the new plugin takes the tablet layout over as it is, so the screen does not flash the phone's)
    if (!this.reloading) this.tabletLayout(false);
    else if (this.tabletWatch) { this.tabletWatch.disconnect(); this.tabletWatch = null; }
    this.releaseMedia();
  }
  // Obsidian takes its tablet layout (tabs, splits, the ribbon) only when the screen is at least 600 px both ways, so a
  // folding phone has it open and loses it closed. everything in Obsidian asks Platform and the body's class, so holding
  // those at tablet gives the layout at any size; Obsidian's own check on a screen change then has no effect
  tabletLayout(on) {
    if (!Platform.isMobile) return;
    const body = document.body;
    if (this.tabletWatch) { this.tabletWatch.disconnect(); this.tabletWatch = null; }
    if (on) {
      // (Platform is only meant to be read, so a version of Obsidian that does not let this happen just keeps its own layout)
      try { for (const [k, v] of [['isTablet', true], ['isPhone', false]]) Object.defineProperty(Platform, k, { configurable: true, enumerable: true, get: () => v, set: () => { } }); }
      catch (e) { return; }
      const hold = () => { if (body.hasClass('is-phone') || !body.hasClass('is-tablet')) { body.removeClass('is-phone'); body.addClass('is-tablet'); } };
      this.tabletWatch = new MutationObserver(hold); this.tabletWatch.observe(body, { attributes: true, attributeFilter: ['class'] });
      hold(); this.tabletHeld = true;
    } else if (this.tabletHeld) {
      // back to what the screen says
      this.tabletHeld = false;
      const big = window.matchMedia('(min-width: 600px) and (min-height: 600px)').matches;
      try { for (const [k, v] of [['isTablet', big], ['isPhone', !big]]) Object.defineProperty(Platform, k, { configurable: true, enumerable: true, writable: true, value: v }); } catch (e) { /* as it was */ }
      body.toggleClass('is-tablet', big); body.toggleClass('is-phone', !big);
    } else return;
    this.app.workspace.trigger('resize'); window.dispatchEvent(new Event('resize'));
  }
  // alone in the left sidebar the wheel has the whole height, so styles.css takes its tab strip away by this class on its group.
  // looked at on every layout change whatever else is going on (layoutChanged stops while the wheel is being moved), and gone with the plugin
  markAlone() {
    const groups = new Set();
    if (!this.gone) for (const el of document.querySelectorAll(ALONE_WHEEL)) groups.add(el.closest('.workspace-tabs'));
    for (const g of document.querySelectorAll('.' + ALONE)) if (!groups.has(g)) g.classList.remove(ALONE);
    for (const g of groups) g.classList.add(ALONE);
  }
  // a press out in Obsidian does not keep the pointer: over the wheel's page the moves and the release go to the page, so a drag of
  // Obsidian's (the canvas pans with the right or middle button) never hears the release and stays on the pointer. while one of those
  // two, pressed out here, is held, the page lets the pointer through (styles.css). a press in the page never comes here, and any move
  // with nothing held ends it, so the wheel cannot be left out of reach
  watchPresses(win) {
    if (this.pressWins.has(win)) return;
    this.pressWins.add(win);
    let held = false;
    const through = on => { held = on; win.document.body.classList.toggle(THROUGH, on); };
    // (mousedown too: a button added to one already held fires no pointerdown)
    const press = e => { if (e.button === 1 || e.button === 2) through(true); };
    // (it goes after the release's own event: on Windows the context menu comes straight after the mouseup, and must not land in the page)
    const release = e => { if (!held || e.buttons) return; held = false; win.setTimeout(() => { if (!held) through(false); }, 0); };
    const move = e => { if (held && !e.buttons) through(false); };
    const end = () => through(false);
    for (const t of ['pointerdown', 'mousedown']) this.registerDomEvent(win, t, press, true);
    for (const t of ['pointerup', 'mouseup']) this.registerDomEvent(win, t, release, true);
    this.registerDomEvent(win, 'pointermove', move, true);
    this.registerDomEvent(win, 'pointercancel', end, true);
    // (not in the capture phase: there it would hear every element losing focus as well)
    this.registerDomEvent(win, 'blur', end);
  }
  // a new wheel in a leaf, whole: its view open and its page loaded. false if not, and the leaf is left for the caller
  async wheelInto(leaf, state) {
    await leaf.setViewState(Object.assign({ type: VIEW }, state));
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    const v = leaf.view;
    return !!(v && v.getViewType && v.getViewType() === VIEW && v.frame && await v.pageUp !== false);
  }
  // the wheel in a sidebar, showing. one wheel only: one left anywhere else moves over, and it closes only once the new one
  // has really loaded (if that one fails the old one stays, and says so). in the left sidebar it has only the top group above
  // it, see clearLeft and topTabs. fresh: a whole new layout came in
  async toSidebar(side, reveal, fresh) {
    const wk = this.app.workspace, split = side === 'right' ? wk.rightSplit : wk.leftSplit, make = side === 'right' ? wk.getRightLeaf : wk.getLeftLeaf;
    if (!make || !split || this.placing) return;
    this.placing = true;
    try {
      const all = wk.getLeavesOfType(VIEW);
      let leaf = all.find(l => l.getRoot() === split), made = false;
      if (!leaf) {
        // (with a top group there the wheel gets a group of its own, or it would be one more tab up there)
        leaf = (side === 'left' && this.underTop()) || make.call(wk, false); if (!leaf) return;
        made = true;
        if (!await this.wheelInto(leaf, { active: false }) && all.length) {
          leaf.detach(); new Notice('VaultWheel could not open there, so it stayed where it was.');
          return;
        }
      }
      for (const l of all) if (l !== leaf) l.detach();
      if (side === 'left') { await this.clearLeft(leaf, reveal); if (this.device.props) await this.topTabs(leaf, fresh); }
      if (leaf.parent && leaf.parent.selectTab) leaf.parent.selectTab(leaf);
      // (a sidebar the layout lost, or one asked for: open, with room. one you collapsed yourself stays collapsed at startup)
      if (reveal || made) this.roomIn(split, side);
      if (reveal) await wk.revealLeaf(leaf);
      else if (!split.collapsed && leaf.loadIfDeferred) await leaf.loadIfDeferred();
      this.store(side); this.noteLeaves();
    } finally { this.placing = false; }
  }
  // the sidebar open and wide enough to use: as wide as you last left it on this device, otherwise a width the wheel works at
  roomIn(split, side) {
    if (split.collapsed && split.expand) {
      // (a right sidebar opened for the wheel closes again when the wheel leaves it, see putBack)
      if (side === 'right' && !this.device.legacy) { this.device.rightShut = true; this.saveDevice(); }
      split.expand();
    }
    if (side !== 'left' || Platform.isMobile || !split.setSize) return;
    const w = this.device.leftWidth || 0;
    const want = w >= LEFT_MIN ? w : split.size < LEFT_MIN ? LEFT_WIDE : split.size;
    if (want !== split.size) { split.setSize(want); if (this.app.workspace.requestSaveLayout) this.app.workspace.requestSaveLayout(); }
  }
  // the left sidebar holds the wheel and its top group: everything else there goes to the right sidebar with its state.
  // nothing is ever lost: a view is only closed here once its copy is open there, and one that will not move stays (and is
  // not tried again). a mobile drawer has no stacked groups: one All properties stays there as a tab
  besideWheel(wheel) {
    const wk = this.app.workspace, others = [], d = this.device, keep = !d.props ? [] : Platform.isMobile ? [PROPS] : TOP;
    const top = d.props && !Platform.isMobile ? this.topGroup(wheel) : null, here = new Set(top ? top.children.map(typeOf) : []);
    if (wk.iterateAllLeaves && wk.getRightLeaf) wk.iterateAllLeaves(l => {
      if (l === wheel || l.getRoot() !== wk.leftSplit || (this.stuck && this.stuck.has(l))) return;
      const t = typeOf(l);
      if (keep.includes(t) && (l.parent === top || !here.has(t))) { here.add(t); return; }
      others.push(l);
    });
    return others;
  }
  // the group above the wheel that holds any of the four (null: none)
  topGroup(wheel) {
    const groups = this.app.workspace.leftSplit.children || [], at = groups.indexOf(wheel.parent);
    for (let i = 0; i < at; i++) if ((groups[i].children || []).some(l => TOP.includes(typeOf(l)))) return groups[i];
    return null;
  }
  // one of the four on the left that is not in the group (dragged below the wheel, say): topTabs takes it up
  topOut(wheel) {
    const wk = this.app.workspace;
    if (!this.device.props || Platform.isMobile) return false;
    // (an old install's wheel found here with its home still a tab has no group yet: it comes now, not at the next start)
    if (!this.device.topPlaced && wk.createLeafBySplit && wk.createLeafInParent) return true;
    const top = this.topGroup(wheel);
    return TOP.some(t => wk.getLeavesOfType(t).some(l => l.getRoot() === wk.leftSplit && l.parent !== top && !(this.stuck && this.stuck.has(l))));
  }
  // one that has left the sidebar since the last look was closed or dragged away by you, and it stays that way (see topTabs)
  noteTop() {
    const wk = this.app.workspace, d = this.device, was = this.topSeen;
    if (!was || !d.props || Platform.isMobile) return;
    const now = new Set(TOP.filter(t => wk.getLeavesOfType(t).some(l => l.getRoot() === wk.leftSplit)));
    const gone = [...new Set((d.topGone || []).concat([...was].filter(t => !now.has(t))))].filter(t => !now.has(t));
    this.topSeen = now;
    if (gone.join() !== (d.topGone || []).join()) { d.topGone = gone; this.saveDevice(); }
  }
  // the group's height as you left it, for when the wheel comes back without it: closed and opened, or a layout that lost it
  noteHeight(wheel) {
    const d = this.device;
    if (!d.props || Platform.isMobile || d.home !== 'left' || !wheel.parent) return;
    const top = this.topGroup(wheel), h = top && top.dimension;
    if (h > 0 && h < 90 && Math.abs(h - (d.topHeight || 0)) >= 0.5) { d.topHeight = h; this.saveDevice(); }
  }
  // making a leaf makes it the active one, and arranging tabs should not change which that is
  backTo(was) {
    const wk = this.app.workspace;
    if (was && wk.setActiveLeaf && was !== wk.activeLeaf) { try { wk.setActiveLeaf(was, { focus: false }); } catch (e) { /* that tab has gone */ } }
  }
  // where a new wheel goes when the top group is there and the wheel is not (a plugin reload, a saved workspace): a group of its
  // own below it, leaving the top group's height alone
  underTop() {
    const wk = this.app.workspace;
    if (!this.device.props || Platform.isMobile || !wk.createLeafBySplit) return null;
    const top = (wk.leftSplit.children || []).find(g => (g.children || []).some(l => TOP.includes(typeOf(l))));
    if (!top) return null;
    const h = top.dimension > 0 && top.dimension < 90 ? top.dimension : this.device.topHeight || PROPS_HEIGHT, was = wk.getMostRecentLeaf ? wk.getMostRecentLeaf() : null;
    const leaf = wk.createLeafBySplit(top.children[top.currentTab] || top.children[0], 'horizontal', false);
    if (top.setDimension) top.setDimension(h);
    if (leaf.parent.setDimension) leaf.parent.setDimension(100 - h);
    this.backTo(was);
    return leaf;
  }
  // the four in a group of their own above the wheel. the first time (this home was just chosen, or a whole new layout came in
  // with no such group) each comes from wherever it is with its state, is closed there only once it is open here, and file
  // properties shows. from then on the group is yours: what shows, the order and the height stay as you left them, through a
  // restart too, and one you closed or dragged off stays so until you choose this home again. all that still happens is that
  // one left on the left outside the group goes up, and one a lost layout dropped comes back. a view that cannot open (its
  // core plugin is off) is skipped quietly. a linked pane in the main area is not taken from its note
  async topTabs(wheel, fresh) {
    const wk = this.app.workspace, d = this.device;
    if (Platform.isMobile || !wk.createLeafBySplit || !wk.createLeafInParent) return;
    const left = t => wk.getLeavesOfType(t).filter(l => l.getRoot() === wk.leftSplit), was = wk.getMostRecentLeaf ? wk.getMostRecentLeaf() : null;
    let top = this.topGroup(wheel);
    const first = !d.topPlaced || (!!fresh && !top), gone = first ? [] : d.topGone || [], wanted = d.topWant || [], skipped = [];
    // (a group below the wheel is made again above it, keeping its height and what it showed)
    const stray = top ? null : TOP.map(t => left(t).find(l => l.parent !== wheel.parent)).find(Boolean), holder = top || (stray && stray.parent) || null;
    const kept = holder && holder.dimension, showing = holder && holder.children[holder.currentTab], showType = showing && TOP.includes(typeOf(showing)) ? typeOf(showing) : null;
    let changed = false, missing = false;
    for (const t of TOP) {
      const all = wk.getLeavesOfType(t);
      if (top && all.some(l => l.parent === top)) continue;
      // (one skipped before because its core plugin was off comes up now, from where Obsidian opened it)
      const from = left(t)[0] || (first || wanted.includes(t) ? all.find(l => l.getRoot() === wk.rightSplit) || all.find(l => !l.group) : null);
      if (!from && !first && (gone.includes(t) || all.length)) continue;
      if (!this.canOpen(t) || (this.topStuck && this.topStuck.has(t))) { missing = true; skipped.push(t); continue; }
      let to = null;
      try {
        const s = from ? from.getViewState() : { type: t, state: {} };
        to = top ? wk.createLeafInParent(top, top.children.filter(l => TOP.includes(typeOf(l)) && TOP.indexOf(typeOf(l)) < TOP.indexOf(t)).length) : wk.createLeafBySplit(wheel, 'horizontal', true);
        if (to.setDimension) to.setDimension(null);
        await to.setViewState(Object.assign({}, s, { active: false }));
        if (typeOf(to) !== t) throw new Error('it came out as ' + typeOf(to));
        if (!top) {
          top = to.parent;
          const h = kept > 0 && kept < 90 ? kept : d.topHeight || PROPS_HEIGHT;
          if (top.setDimension) top.setDimension(h);
          if (wheel.parent.setDimension) wheel.parent.setDimension(100 - h);
        }
        // (remembered so the setting can put it back. an old install's stays where it went, as it always did)
        if (!d.legacy && !(d.topWas && d.topWas[t])) (d.topWas = d.topWas || {})[t] = !from ? 'none' : from.getRoot() === wk.rightSplit && !(d.movedRight || []).includes(t) ? 'right' : 'left';
        if (from) from.detach();
        changed = true;
      } catch (e) {
        missing = true; (this.topStuck = this.topStuck || new Set()).add(t);
        if (from) (this.stuck = this.stuck || new WeakSet()).add(from);
        if (to) { try { to.detach(); } catch (e2) { /* it stays empty */ } }
      }
    }
    if (top && top.selectTab && (first || changed)) {
      const want = first ? TOP[0] : showType, l = (want && top.children.find(x => typeOf(x) === want)) || (showing && top.children.includes(showing) && showing) || top.children[0];
      if (l) top.selectTab(l);
    }
    // (one that is not there yet at startup gets one more try when it has settled, see settle. after that it is skipped)
    this.propsFailed = missing && !this.settled;
    if (first && !this.propsFailed) { d.topPlaced = true; d.topGone = []; }
    const again = skipped.join() !== wanted.join(); d.topWant = skipped;
    if (first || changed || again) this.saveDevice();
    this.topSeen = new Set(TOP.filter(t => left(t).length));
    this.backTo(was);
    if (changed && wk.requestSaveLayout) wk.requestSaveLayout();
  }
  // whether a view can open at all: a core plugin that is off has none, and a leaf set to it would only say so
  canOpen(type) { const v = this.app.viewRegistry; return !v || !v.getViewCreatorByType || !!v.getViewCreatorByType(type); }
  // the leaf in the right sidebar that shows this file
  rightPane(file) {
    const wk = this.app.workspace, v = this.app.viewRegistry, type = v && v.getTypeByExtension ? v.getTypeByExtension(file.extension) : null;
    let pane = null;
    if (wk.iterateAllLeaves) wk.iterateAllLeaves(l => { if (pane || l.getRoot() !== wk.rightSplit) return; const s = l.getViewState(); if (s && s.state && s.state.file === file.path && (!type || s.type === type)) pane = l; });
    return pane;
  }
  // the right sidebar's arrangement, if it is on, on a computer: outline showing in the top group, the other tabs staying with
  // it, and the chosen file in a group of its own below. as with the top group this is set up once (the setting changed, or a
  // whole new layout came in without the file): from then on what shows, the order and the heights are yours, through a restart
  // too, and a pane you closed stays closed until the setting changes. a file not there (yet) is skipped quietly
  async arrangeRight(fresh, reveal) {
    const s = this.settings, wk = this.app.workspace, d = this.device;
    if (!s.rightArrange || Platform.isMobile || this.placing || !wk.rightSplit || !wk.createLeafBySplit || !wk.createLeafInParent || !wk.getRightLeaf) return;
    const path = s.rightFile ? normalizePath(s.rightFile) : '', file = path ? this.fileAt(path) : null, pane = file ? this.rightPane(file) : null, key = path + '|' + (s.rightView || '');
    // (another file or view chosen only changes the pane: what shows above it is left alone)
    const setUp = d.rightKey === undefined || (!!fresh && !!file && !pane), first = setUp || d.rightKey !== key;
    if (!first && (pane || !file || d.rightGone)) return;
    const was = wk.getMostRecentLeaf ? wk.getMostRecentLeaf() : null;
    this.placing = true;
    try {
      if (setUp) await this.outlineShows();
      if (file) await this.filePane(file, pane, first);
      if (first) { d.rightKey = key; d.rightPath = path; d.rightGone = false; this.saveDevice(); }
      this.rightHad = !!(file && this.rightPane(file));
      if (reveal && wk.rightSplit.collapsed && wk.rightSplit.expand) wk.rightSplit.expand();
      this.backTo(was);
      if (wk.requestSaveLayout) wk.requestSaveLayout();
    } finally { this.placing = false; }
  }
  // outline in the right sidebar's top group, showing. (a wheel living in that group stays the one showing)
  async outlineShows() {
    const wk = this.app.workspace, all = wk.getLeavesOfType('outline'), top = (wk.rightSplit.children || [])[0] || null, wheel = wk.getLeavesOfType(VIEW).find(l => l.parent === top);
    let l = top ? all.find(x => x.parent === top) : null;
    if (!l && this.canOpen('outline')) {
      const from = all.find(x => x.getRoot() === wk.rightSplit) || all.find(x => !x.group);
      let to = null;
      try {
        const st = from ? from.getViewState() : { type: 'outline', state: {} };
        to = top ? wk.createLeafInParent(top, 0) : wk.getRightLeaf(false);
        if (to.setDimension) to.setDimension(null);
        await to.setViewState(Object.assign({}, st, { active: false }));
        if (typeOf(to) !== 'outline') throw new Error('it came out as ' + typeOf(to));
        if (from) from.detach();
        l = to;
      } catch (e) { if (to) { try { to.detach(); } catch (e2) { /* it stays empty */ } } }
    }
    const show = wheel || l;
    if (show && show.parent && show.parent.selectTab) show.parent.selectTab(show);
  }
  // the chosen file in a group of its own, the last in the right sidebar, at about half the height. one already alone in a lower
  // group is kept with its height, and only shown the chosen view. so is the file chosen before this one, which just shows this one
  async filePane(file, pane, first) {
    const wk = this.app.workspace, v = this.app.viewRegistry, d = this.device, view = this.settings.rightView;
    if (v && v.getTypeByExtension && !v.getTypeByExtension(file.extension)) return;
    const groups = wk.rightSplit.children || [], alone = l => !!l && l.parent.children.length === 1 && groups.indexOf(l.parent) > 0;
    if (alone(pane)) {
      const st = pane.getViewState();
      if (first && view && (st.state || {}).viewName !== view) await pane.setViewState(Object.assign({}, st, { state: Object.assign({}, st.state, { viewName: view }), active: false }));
      return;
    }
    const before = !pane && first && d.rightPath && d.rightPath !== file.path ? this.fileAt(d.rightPath) : null, old = before && this.rightPane(before);
    if (alone(old)) { await old.openFile(file, { active: false, state: view ? { viewName: view } : {} }); return; }
    const last = groups[groups.length - 1], dims = groups.map(g => g.dimension > 0 ? g.dimension : 100 / groups.length), sum = dims.reduce((a, b) => a + b, 0);
    let to = null;
    try {
      to = last && last.children && last.children.length ? wk.createLeafBySplit(last.children[last.currentTab] || last.children[0], 'horizontal', false) : wk.getRightLeaf(false);
      await to.openFile(file, { active: false, state: Object.assign({}, pane ? pane.getViewState().state : {}, view ? { viewName: view } : {}) });
      if ((to.getViewState().state || {}).file !== file.path) throw new Error('it did not open');
      groups.forEach((g, i) => { if (g !== to.parent && g.setDimension) g.setDimension(dims[i] * 50 / sum); });
      if (groups.length && to.parent.setDimension) to.parent.setDimension(50);
      if (pane) pane.detach();
    } catch (e) { if (to) { try { to.detach(); } catch (e2) { /* it stays empty */ } } }
  }
  async clearLeft(wheel, reveal) {
    const wk = this.app.workspace, d = this.device, went = [];
    let moved = 0;
    for (const l of this.besideWheel(wheel)) {
      let to = null;
      try {
        const s = l.getViewState();
        if (!s || !s.type) throw new Error('no state');
        // (an empty tab holds nothing, and the same view already on the right with the same state would only be a double)
        const same = t => JSON.stringify(t.getViewState().state || {}) === JSON.stringify(s.state || {});
        if (s.type === 'empty' || wk.getLeavesOfType(s.type).some(t => t !== l && t.getRoot() === wk.rightSplit && same(t))) { l.detach(); continue; }
        to = wk.getRightLeaf(false);
        await to.setViewState(Object.assign({}, s, { active: false }));
        if (to.getViewState().type !== s.type) throw new Error('it came out as ' + to.getViewState().type);
        l.detach(); moved++; went.push(s.type);
      } catch (e) {
        if (to) { try { to.detach(); } catch (e2) { /* it stays empty */ } }
        (this.stuck = this.stuck || new WeakSet()).add(l);
      }
    }
    // (the tabs have moved: when it was asked for, and the first time ever, they are not left hidden in a closed sidebar)
    if (!moved) return;
    const seen = !!d.moved; d.moved = true;
    // (remembered so the setting can put them back. an old install's tabs stay where they went, as they always did)
    if (!d.legacy) d.movedRight = [...new Set((d.movedRight || []).concat(went))];
    if ((reveal || !seen) && wk.rightSplit.collapsed && wk.rightSplit.expand) { d.rightShut = !d.legacy; wk.rightSplit.expand(); }
    this.saveDevice();
    if (reveal && !d.legacy) new Notice('The left sidebar\'s other tabs moved to the right. VaultWheel\'s settings can put them back.');
  }
  // where the wheel lives on this device is kept by this plugin too (not synced, each device has its own): a sidebar it was
  // put in holds through a restart even when Obsidian's saved layout loses it. in a tab it is left to Obsidian's layout
  placeOfWheel() {
    const wk = this.app.workspace, leaf = wk.getLeavesOfType(VIEW)[0]; if (!leaf) return 'none';
    const root = leaf.getRoot(); return root === wk.leftSplit ? 'left' : root === wk.rightSplit ? 'right' : 'main';
  }
  store(place) { const d = this.device; d.closed = place === 'none'; if (!d.closed) d.home = place === 'main' ? 'tab' : place; this.saveDevice(); }
  stored() { const d = this.device; return d.closed ? 'none' : d.home === 'tab' ? 'main' : d.home; }
  // the leaves other than the wheel, to tell you closing the wheel (the rest of the layout is still there) from a whole new
  // layout coming in, a saved workspace say (none of them is)
  noteLeaves() {
    const wk = this.app.workspace, now = new Set();
    if (wk.iterateAllLeaves) wk.iterateAllLeaves(l => { if (!l.view || !l.view.getViewType || l.view.getViewType() !== VIEW) now.add(l); });
    const before = this.leavesSeen; this.leavesSeen = now;
    this.hadWheel = this.placeOfWheel() !== 'none';
    return before || new Set();
  }
  async keepPlace() {
    // the layout is listened to from the start, but only believed once startup is over: settle
    this.registerEvent(this.app.workspace.on('layout-change', () => { this.markAlone(); this.layoutChanged(); }));
    this.registerEvent(this.app.workspace.on('quit', () => { this.leaving = true; }));
    this.registerDomEvent(window, 'beforeunload', () => { this.leaving = true; });
    this.markAlone();
    const place = this.stored();
    this.noteLeaves();
    try { if (place === 'left' || place === 'right') await this.toSidebar(place, false); await this.arrangeRight(false); }
    finally { window.setTimeout(() => this.settle(), 5000); }
  }
  // other plugins and Obsidian's own sidebar views finish arriving after the layout is ready, so once more when they have
  settle() {
    if (this.settled || this.gone) return;
    this.settled = true; this.topStuck = null;
    this.layoutChanged();
    const left = this.propsFailed && this.placeOfWheel() === 'left' ? this.toSidebar('left', false) : null;
    Promise.resolve(left).then(() => this.arrangeRight(false)).catch(e => console.error('VaultWheel: keeping the left sidebar', e));
  }
  // nothing here is written while starting up, reloading or quitting, or while the wheel is being moved by this plugin. a
  // close is only remembered as one when the rest of the layout is still there; a new layout coming in loses the wheel by
  // accident, so it goes back where it was
  layoutChanged() {
    if (!this.settled || this.leaving || this.reloading || this.placing || this.gone) return;
    const had = this.hadWheel, before = this.noteLeaves(), fresh = before.size > 0 && ![...before].some(l => this.leavesSeen.has(l));
    // (the right sidebar waits for the wheel: one thing moves views at a time)
    Promise.resolve(this.wheelChanged(had, before, fresh)).then(() => this.rightChanged(fresh)).catch(e => console.error('VaultWheel: keeping its place', e));
  }
  wheelChanged(had, before, fresh) {
    const d = this.device;
    // in a tab the wheel is a view like any other: wherever you drag it, Obsidian's layout keeps it and nothing here looks.
    // (an old install followed it into the sidebars, and still does)
    if (d.home === 'tab' && !d.legacy) return null;
    const wk = this.app.workspace, now = this.placeOfWheel();
    if (now !== 'none') {
      // (dragged into the left sidebar from the right: that would clear a sidebar nobody asked to clear, so this lets go instead)
      if (now === 'left' && d.home !== 'left' && !d.legacy) { this.store('main'); return null; }
      this.store(now);
      if (now === 'left') {
        const split = wk.leftSplit, wheel = wk.getLeavesOfType(VIEW)[0];
        if (split.size >= LEFT_MIN && !split.collapsed && split.size !== d.leftWidth) { d.leftWidth = split.size; this.saveDevice(); }
        if (!fresh) this.noteTop();
        if (fresh || this.besideWheel(wheel).length || this.topOut(wheel)) return this.toSidebar('left', false, fresh);
      }
      return null;
    }
    const place = this.stored();
    if (place === 'none') return null;
    if (had && [...before].some(l => this.leavesSeen.has(l))) { this.store('none'); return null; }
    return place === 'left' || place === 'right' ? this.toSidebar(place, false, fresh) : null;
  }
  // the pane of the chosen file gone since the last look: closed by you, it stays closed. a new layout gets the arrangement
  rightChanged(fresh) {
    const s = this.settings, d = this.device;
    if (!s.rightArrange || Platform.isMobile) return null;
    const file = s.rightFile ? this.fileAt(normalizePath(s.rightFile)) : null;
    if (file && this.rightPane(file)) { this.rightHad = true; return null; }
    if (fresh) return this.arrangeRight(true);
    if (this.rightHad) { this.rightHad = false; d.rightGone = true; this.saveDevice(); }
    return null;
  }
  // the undo of the left sidebar: the wheel out to a tab in the main area, the place forgotten. the tabs that moved to the
  // right stay there, where you can drag them
  async giveLeftBack() {
    const wk = this.app.workspace, all = wk.getLeavesOfType(VIEW);
    if (this.placing) return;
    this.placing = true;
    try {
      const leaf = wk.getLeaf('tab');
      if (!await this.wheelInto(leaf, { active: true }) && all.length) { leaf.detach(); new Notice('VaultWheel could not open a tab.'); return; }
      for (const l of all) l.detach();
      this.device.topPlaced = false; this.device.topGone = [];
      this.store('main'); this.noteLeaves();
      await wk.revealLeaf(leaf);
    } finally { this.placing = false; }
    if (!this.device.legacy) await this.putBack();
  }
  // the wheel opens where it lives: a tab, unless a sidebar was chosen. one left anywhere else comes to the front
  // (an old install: a phone or tablet always went to the left sidebar, a computer to a tab)
  async open() {
    const d = this.device, side = d.legacy ? (Platform.isMobile ? 'left' : null) : d.home === 'tab' ? null : d.home;
    if (side) return this.toSidebar(side, true);
    const [leaf, ...extra] = this.app.workspace.getLeavesOfType(VIEW);
    for (const l of extra) l.detach();
    const target = leaf || this.app.workspace.getLeaf('tab');
    if (!leaf) await target.setViewState({ type: VIEW, active: true });
    await this.app.workspace.revealLeaf(target);
  }
  // the page: the copy a release build embeds in this file (VW_PAGE, see tools/release.sh), since the community store installs
  // only main.js, manifest.json and styles.css
  async pageHtml() {
    // #if dev
    // (in development a page next to this file comes first: a deploy puts it there and updates swap in)
    try { return await this.app.vault.adapter.read(normalizePath(this.manifest.dir + '/vaultwheel.html')); }
    catch (e) { if (typeof VW_PAGE !== 'string') throw e; }
    // #endif
    return unpackPage(VW_PAGE);
  }
  // the thumbnails made for a page are blob links; they go with the page (a new page asks for its own)
  // (jobs still queued for the old page are dropped, so they do not make thumbnails nobody will ask for)
  releaseMedia() {
    for (const u of this.blobs) URL.revokeObjectURL(u); this.blobs.clear(); this.thumbs.clear();
    // a dropped job still has a request waiting on it, so each is answered with nothing
    for (const q of [this.thumbQ.low, this.thumbQ.high, this.thumbQ.poster]) { for (const j of q) j.settle(null); q.length = 0; }
  }
  // a confirmed move, kept so its undo can go without asking. at most 200 at a time, the oldest going first
  rememberUndo(newPath, from) {
    this.undoable.set(newPath, { from, at: Date.now() });
    while (this.undoable.size > 200) this.undoable.delete(this.undoable.keys().next().value);
  }
  undoOk(p, to) {
    const u = this.undoable.get(normalizePath(p));
    if (u && Date.now() - u.at > 10 * 60 * 1000) { this.undoable.delete(normalizePath(p)); return false; }
    return !!u && u.from === to;
  }

  // the tree: folders only, with file counts and the newest change in each
  tree(folder) {
    // t: this folder's own files counted by extension, so its colour bars can be drawn before it is opened
    const node = { n: folder.name || this.app.vault.getName(), f: 0, m: 0, t: {}, c: [] };
    for (const ch of folder.children) {
      if (ch instanceof TFolder) node.c.push(this.tree(ch));
      else if (ch instanceof TFile) {
        node.f++; node.m = Math.max(node.m, Math.floor((ch.stat.mtime || 0) / 1000));
        const k = ch.name.toLowerCase().endsWith('.excalidraw.md') ? 'excalidraw.md' : ch.extension.toLowerCase();
        node.t[k] = (node.t[k] || 0) + 1;
      }
    }
    node.m = Math.max(node.m, ...node.c.map(c => c.m));
    return node;
  }
  folderAt(p) { const f = p ? this.app.vault.getAbstractFileByPath(normalizePath(p)) : this.app.vault.getRoot(); return f instanceof TFolder ? f : null; }
  fileAt(p) { const f = this.app.vault.getAbstractFileByPath(normalizePath(p)); return f instanceof TFile ? f : null; }
  // the desktop app with the vault on a real disk: where it is and which system this is (null on mobile)
  desktopInfo() {
    const ad = this.app.vault.adapter;
    if (!Platform.isDesktopApp || Platform.isMobile || typeof ad.getFullPath !== 'function' || typeof ad.getBasePath !== 'function' || typeof process === 'undefined') return null;
    return { base: ad.getBasePath(), os: process.platform };
  }
  // a file opened with an app other than Obsidian. Windows shows its own "Open with" chooser; a Mac has no such chooser,
  // so the file is shown in Finder (its Open With is a right click away); Linux opens it in its default app. a folder
  // opens in the system's file manager. answers with an error, or null once the app was started
  async openWith(full, isDir) {
    const electron = nodeModule('electron'), shell = electron && electron.shell;
    if (isDir && shell) { const err = await shell.openPath(full); return err || null; }
    if (process.platform === 'darwin' && shell) { shell.showItemInFolder(full); return null; }
    const cp = nodeModule('child_process'); if (!cp) return 'only on desktop';
    const { spawn } = cp;
    const [cmd, args, verbatim] = process.platform === 'win32' ? (isDir ? ['explorer', [full], false] : ['rundll32', ['shell32.dll,OpenAs_RunDLL', full], true])
      : process.platform === 'darwin' ? ['open', isDir ? [full] : ['-R', full], false] : ['xdg-open', [full], false];
    // (rundll32 takes the rest of its command line as the path, so it gets the path as it is, unquoted)
    return new Promise(res => {
      try {
        const c = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: verbatim });
        c.on('error', e => res(String(e && e.message || e)));
        c.on('spawn', () => { c.unref(); res(null); });
      } catch (e) { res(String(e && e.message || e)); }
    });
  }

  // what changes the disk goes one request at a time, each with its question, so the name one has just looked at is still
  // free when it acts, whichever wheel or window asked. the rest (thumbnails, lists) does not wait
  handle(m, win) {
    if (!m || !m.vw || !win) return;
    if (!CHANGES.has(m.t)) return this.answer(m, win);
    const run = (this.changeQ || Promise.resolve()).then(() => this.answer(m, win));
    this.changeQ = run.catch(() => { });
    return run;
  }
  async answer(m, win) {
    const reply = data => win.postMessage(Object.assign({ vw: 1, id: m.id }, data), '*');
    try {
      // (on desktop the page is also told where the vault sits on disk and which system this is, for its copy path and
      // open with; on mobile it gets nothing, and hides open with)
      if (m.t === 'tree') return reply({ root: this.app.vault.getName(), tree: this.tree(this.app.vault.getRoot()), desktop: this.desktopInfo() });
      if (m.t === 'openWith') {
        const f = this.app.vault.getAbstractFileByPath(normalizePath(m.p)); if (!f || !f.parent) return reply({ ok: false, err: 'not found' });
        if (!this.desktopInfo()) return reply({ ok: false, err: 'only on desktop' });
        const err = await this.openWith(this.app.vault.adapter.getFullPath(f.path), f instanceof TFolder);
        return reply(err ? { ok: false, err } : { ok: true });
      }
      if (m.t === 'files') {
        const f = this.folderAt(m.p); if (!f) return reply({ ok: false, err: 'not found', files: [] });
        const files = f.children.filter(c => c instanceof TFile), sizes = await this.pictureSizes(files);
        return reply({ files: files.map(c => { const r = [c.name, c.stat.size || 0, Math.floor((c.stat.mtime || 0) / 1000)], z = sizes.get(c); if (z) r.push(z[0], z[1]); return r; }) });
      }
      if (m.t === 'thumb') {
        const f = this.fileAt(m.p);
        // a video's card gets a frame from it, made here (see poster)
        // (frame: says this plugin makes them, so the page can tell an older one still running, see videoFrame there)
        if (f && VIDEO.has(f.extension.toLowerCase())) return reply({ url: await this.thumbQueued(f, 0, 'poster'), frame: true });
        if (!f || !IMG.has(f.extension.toLowerCase())) return reply({ url: null, frame: true });
        // a gif goes over as itself so it can play; an svg too (it is drawn at any size). other pictures as a jpeg,
        // small unless the page asks for a sharper one (px) for a card shown large
        const ext = f.extension.toLowerCase();
        // (as a blob link of the whole file, which keeps a gif moving: an app:// link is another origin to the page, and a
        // picture from one taints the card's canvas, which the graphics card then refuses, so the card showed nothing)
        if (ext === 'gif' || ext === 'svg') return reply({ url: await this.thumbQueued(f, 0, 'raw') });
        return reply({ url: await this.thumbQueued(f, Math.min(2048, Math.max(64, +m.px || THUMB_PX))) });
      }
      // a song's own cover art (mp3, flac, m4a), for its card and its tile; none: url null
      if (m.t === 'art') {
        const f = this.fileAt(m.p); if (!f || !ART.has(f.extension.toLowerCase())) return reply({ url: null });
        return reply({ url: await this.thumbQueued(f, THUMB_PX, true) });
      }
      if (m.t === 'media') {
        // songs and videos to play, and pictures at full size for the board
        const f = this.fileAt(m.p), ext = f && f.extension.toLowerCase(); if (!f || !(MEDIA.has(ext) || IMG.has(ext))) return reply({ url: null });
        const url = this.app.vault.getResourcePath(f);
        return reply({ url });
      }
      // settings the page keeps (a folder's pinned scale, and later others): the plugin's data.json in .obsidian, so a sync
      // carries them to every device. the plugin's own settings sit beside them, and the page never sees or writes those
      if (m.t === 'prefs') { const { settings, ...prefs } = (await this.loadData()) || {}; return reply({ prefs }); }
      if (m.t === 'savePrefs') {
        if (!m.prefs || typeof m.prefs !== 'object' || Array.isArray(m.prefs)) return reply({ ok: false, err: 'prefs must be an object' });
        await this.writeData(m.prefs); return reply({ ok: true });
      }
      // #if dev
      // what the owner's own build keeps in files beside the page (see tools/build.sh). a store build has it all in the page
      if (m.t === 'pack') {
        if (m.name !== 'gifs' && m.name !== 'vendor') return reply({ ok: false, err: 'no such file' });
        return reply({ ok: true, text: await this.app.vault.adapter.read(normalizePath(this.manifest.dir + '/vaultwheel-' + m.name + '.json')) });
      }
      // #endif
      // an excalidraw drawing as svg markup, made by the excalidraw plugin itself, for the playground to show it (as a
      // picture: the page should put it in an <img> from a blob, never into its own markup)
      if (m.t === 'excalidraw') {
        const f = this.fileAt(m.p); if (!f) return reply({ ok: false, err: 'not found' });
        const ex = this.app.plugins && this.app.plugins.plugins['obsidian-excalidraw-plugin'];
        if (!ex || !ex.ea) return reply({ ok: false, err: 'the Excalidraw plugin is not on' });
        const ea = typeof ex.ea.getAPI === 'function' ? ex.ea.getAPI() : ex.ea;
        if (ea.reset) ea.reset();
        const svg = await ea.createSVG(f.path, true);
        return reply(svg && svg.outerHTML ? { ok: true, svg: svg.outerHTML } : { ok: false, err: 'it could not be drawn' });
      }
      // the playground's saved boards, in boards.json in this plugin's folder (kept apart from data.json so a board save
      // never races the folder settings)
      if (m.t === 'boards') {
        const at = normalizePath(this.manifest.dir + '/boards.json');
        if (!(await this.app.vault.adapter.exists(at))) return reply({ boards: {} });
        try { return reply({ boards: JSON.parse(await this.app.vault.adapter.read(at)) || {} }); } catch (e) { return reply({ boards: {}, err: 'boards.json could not be read' }); }
      }
      if (m.t === 'boardsSave') {
        const b = m.boards; if (!b || typeof b !== 'object') return reply({ ok: false, err: 'no boards' });
        const text = JSON.stringify(b); if (text.length > 8 * 1024 * 1024) return reply({ ok: false, err: 'the boards are too big to save' });
        const a = this.app.vault.adapter, at = normalizePath(this.manifest.dir + '/boards.json'), fs = nodeModule('fs');
        // (on a computer written beside it and swapped in whole, so a crash mid write does not lose the saved boards)
        if (fs && a.getFullPath) { await a.write(at + '.new', text); await fs.promises.rename(a.getFullPath(at + '.new'), a.getFullPath(at)); }
        else await a.write(at, text);
        return reply({ ok: true });
      }
      // a note rendered the way Obsidian reads it, as markup for a read only view in the playground. it is cleaned first,
      // since the page shares Obsidian's origin (see cleanNote)
      if (m.t === 'renderMd') {
        const f = this.fileAt(m.p); if (!f) return reply({ ok: false, err: 'not found' });
        if ((f.stat.size || 0) > 512 * 1024) return reply({ ok: false, err: 'too big to show here' });
        const el = document.createElement('div'), comp = new Component(); comp.load();
        try {
          await MarkdownRenderer.render(this.app, await this.app.vault.cachedRead(f), el, f.path, comp);
          cleanNote(el);
          return reply({ ok: true, html: el.innerHTML });
        } finally { comp.unload(); }
      }
      // a link clicked in a note shown in the playground: never followed inside the page, which would replace it. a web link
      // goes to the browser, a link to a note that exists opens it in a tab, anything else stays put
      if (m.t === 'openLink') {
        const href = String(m.href || '').trim(), from = String(m.from || '');
        if (/^(https?|mailto):/i.test(href)) { window.open(href); return reply({ ok: true }); }
        if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return reply({ ok: false, err: 'that link is not opened from here' });
        if (!this.app.metadataCache.getFirstLinkpathDest(getLinkpath(href), from)) return reply({ ok: false, err: 'that note does not exist' });
        await this.app.workspace.openLinkText(href, from, 'tab');
        return reply({ ok: true });
      }
      // a note's text, for the playground to show it in place (read only; a big file is left to Obsidian)
      if (m.t === 'read') {
        const f = this.fileAt(m.p); if (!f) return reply({ ok: false, err: 'not found' });
        if ((f.stat.size || 0) > 512 * 1024) return reply({ ok: false, err: 'too big to show here' });
        return reply({ ok: true, text: await this.app.vault.cachedRead(f) });
      }
      if (m.t === 'open') {
        const f = this.fileAt(m.p); if (!f) return reply({ ok: false });
        // a new tab every time, so the wheel stays where it is
        await this.app.workspace.getLeaf('tab').openFile(f);
        return reply({ ok: true });
      }
      // the playground's batches: one confirmation in Obsidian for all of them, then each file on its own, with a reply
      // per file so the page keeps the ones that did not go. moves keep links (fileManager); trash goes to the vault's .trash
      if (m.t === 'moveMany' || m.t === 'trashMany') {
        const paths = Array.isArray(m.paths || m.from) ? (m.paths || m.from).map(String) : [];
        const dst = m.t === 'moveMany' ? this.folderAt(m.to) : null;
        if (!paths.length) return reply({ results: [] });
        if (m.t === 'moveMany' && !dst) return reply({ results: paths.map(p => ({ p, ok: false, err: 'folder not found' })) });
        const what = countOf(this.app, paths), dstPath = dst ? (dst.path === '/' ? '' : dst.path) : '';
        // an undo puts files back where they were without asking again, but only a batch that exactly reverses moves this
        // plugin made after a yes; any other quiet batch is asked like the rest
        const quiet = m.t === 'moveMany' && m.quiet && paths.every(p => this.undoOk(p, dstPath));
        const ok = quiet ? true : await new Promise(res => new ConfirmBatch(this.app, m.t === 'moveMany' ? 'Move ' + what + ' into "' + (dst.path || '/') + '"?' : 'Move ' + what + ' to .trash?',
          m.t === 'moveMany' ? 'Move' : 'Move to .trash', m.t === 'trashMany', res).open());
        if (!ok) return reply({ cancelled: true, results: paths.map(p => ({ p, ok: false, err: 'cancelled' })) });
        // a file inside a folder that is in the same batch goes with its folder, so folders are handled first and the
        // file takes its folder's answer (and its new place, if the folder moved)
        const norm = paths.map(p => normalizePath(p));
        const dirs = norm.filter(p => this.app.vault.getAbstractFileByPath(p) instanceof TFolder);
        const holderOf = np => holderIn(dirs, np);
        const byPath = new Map();
        for (let i = 0; i < paths.length; i++) {
          const p = paths[i], np = norm[i];
          if (holderOf(np)) continue;
          const src = this.app.vault.getAbstractFileByPath(np);
          if (!src) { byPath.set(np, { p, ok: false, err: 'not found' }); continue; }
          if (!src.parent) { byPath.set(np, { p, ok: false, err: 'the vault itself cannot be moved' }); continue; }
          try {
            if (m.t === 'trashMany') { await this.app.vault.trash(src, false); byPath.set(np, { p, ok: true }); continue; }
            if (src.parent === dst) { byPath.set(np, { p, ok: true, newPath: src.path }); continue; }
            if (src instanceof TFolder && (dstPath + '/').startsWith(src.path + '/')) { byPath.set(np, { p, ok: false, err: 'a folder cannot go inside itself' }); continue; }
            const target = inFolder(dst, src.name), from = src.parent.path === '/' ? '' : src.parent.path;
            if (await this.taken(target)) { byPath.set(np, { p, ok: false, err: 'something with that name is already there' }); continue; }
            await this.moveTo(src, target);
            if (quiet) this.undoable.delete(np); else this.rememberUndo(target, from);
            byPath.set(np, { p, ok: true, newPath: target });
          } catch (e) { byPath.set(np, { p, ok: false, err: String(e && e.message || e) }); }
        }
        const results = paths.map((p, i) => {
          const holder = holderOf(norm[i]);
          if (!holder) return byPath.get(norm[i]);
          const h = byPath.get(holder) || { ok: false, err: 'not found' };
          if (!h.ok) return { p, ok: false, err: h.err };
          return { p, ok: true, newPath: m.t === 'moveMany' && h.newPath ? normalizePath(h.newPath + norm[i].slice(holder.length)) : undefined };
        });
        const done = results.filter(r => r.ok).length;
        new Notice((m.t === 'moveMany' ? 'Moved ' : 'Moved to .trash: ') + done + ' of ' + results.length);
        return reply({ results });
      }
      // copy here: copies of the playground's ticked files in another folder, after one question. a copy keeps its name
      // unless that is taken there, then it is numbered like a duplicate. nothing is overwritten
      if (m.t === 'copyMany') {
        const paths = Array.isArray(m.from) ? m.from.map(String) : [], dst = this.folderAt(m.to);
        if (!paths.length) return reply({ results: [] });
        if (!dst) return reply({ results: paths.map(p => ({ p, ok: false, err: 'folder not found' })) });
        const ok = await new Promise(res => new ConfirmBatch(this.app, 'Copy ' + countOf(this.app, paths) + ' into "' + (dst.path || '/') + '"?', 'Copy', false, res).open());
        if (!ok) return reply({ cancelled: true, results: paths.map(p => ({ p, ok: false, err: 'cancelled' })) });
        // a file inside a folder that is also being copied comes along in that copy, so it gets no copy of its own
        const norm = paths.map(p => normalizePath(p));
        const dirs = norm.filter(p => this.app.vault.getAbstractFileByPath(p) instanceof TFolder);
        const holderOf = np => holderIn(dirs, np);
        const byPath = new Map();
        for (let i = 0; i < paths.length; i++) {
          const p = paths[i];
          if (holderOf(norm[i])) continue;
          const src = this.app.vault.getAbstractFileByPath(norm[i]);
          if (!src) { byPath.set(norm[i], { p, ok: false, err: 'not found' }); continue; }
          if (!src.parent) { byPath.set(norm[i], { p, ok: false, err: 'the vault itself cannot be copied' }); continue; }
          if (src instanceof TFolder && ((dst.path === '/' ? '' : dst.path) + '/').startsWith(src.path + '/')) { byPath.set(norm[i], { p, ok: false, err: 'a folder cannot be copied inside itself' }); continue; }
          const ext = src instanceof TFile && src.extension ? '.' + src.extension : '', stem = src instanceof TFile ? src.basename : src.name;
          let name = src.name; for (let j = 1; await this.taken(inFolder(dst, name)); j++) name = stem + (j === 1 ? ' copy' : ' copy ' + j) + ext;
          try { await this.copyIn(src, inFolder(dst, name)); byPath.set(norm[i], { p, ok: true, newPath: inFolder(dst, name), name }); }
          catch (e) { byPath.set(norm[i], { p, ok: false, err: String(e && e.message || e) }); }
        }
        const results = paths.map((p, i) => {
          const holder = holderOf(norm[i]);
          if (!holder) return byPath.get(norm[i]);
          const h = byPath.get(holder) || { ok: false, err: 'not found' };
          if (!h.ok) return { p, ok: false, err: h.err };
          return { p, ok: true, newPath: normalizePath(h.newPath + norm[i].slice(holder.length)), name: norm[i].split('/').pop() };
        });
        new Notice('Copied ' + results.filter(r => r.ok).length + ' of ' + results.length);
        return reply({ results });
      }
      // the everyday file explorer jobs, on one file or folder at a time. a name is checked before anything changes; a clash
      // is refused (rename) or numbered (new folder, duplicate). none of these overwrite anything, so they need no question
      if (m.t === 'rename') {
        const f = this.app.vault.getAbstractFileByPath(normalizePath(m.p)), name = String(m.name || '').trim();
        if (!f || !f.parent) return reply({ ok: false, err: 'not found' });
        if (badName(name)) return reply({ ok: false, err: name.startsWith('.') ? 'a name starting with a dot would hide it' : 'that name cannot be used' });
        const parent = f.parent.path !== '/' ? f.parent.path + '/' : '';
        const target = normalizePath(parent + name);
        if (target === f.path) return reply({ ok: true, newPath: f.path });
        // (the adapter also sees what the vault does not index, so a clash with a hidden file is caught too; a change of
        // case only is the same file on a case-blind disk, so it is let through)
        if (this.app.vault.getAbstractFileByPath(target) || (target.toLowerCase() !== f.path.toLowerCase() && await this.app.vault.adapter.exists(target))) return reply({ ok: false, err: 'something with that name is already there' });
        await this.moveTo(f, target);
        return reply({ ok: true, newPath: target });
      }
      if (m.t === 'newFolder') {
        const dir = this.folderAt(m.p); if (!dir) return reply({ ok: false, err: 'folder not found' });
        const base = String(m.name || 'New folder').trim().replace(/[\\/:]/g, '-').replace(/^\.+/, '') || 'New folder';
        const at = n => inFolder(dir, n);
        let name = base; for (let i = 2; await this.taken(at(name)); i++) name = base + ' ' + i;
        await this.app.vault.createFolder(at(name));
        return reply({ ok: true, path: at(name), name });
      }
      // a new empty file, by the name typed on its card (its extension makes its type). like a new folder it is numbered
      // if the name turns out to be taken (something the page does not see, a hidden file), so nothing is overwritten
      if (m.t === 'newFile') {
        const dir = this.folderAt(m.p); if (!dir) return reply({ ok: false, err: 'folder not found' });
        const base = String(m.name || '').trim();
        if (badName(base)) return reply({ ok: false, err: base.startsWith('.') ? 'a name starting with a dot would hide it' : 'that name cannot be used' });
        const at = n => inFolder(dir, n);
        const dot = base.lastIndexOf('.'), stem = dot > 0 ? base.slice(0, dot) : base, ext = dot > 0 ? base.slice(dot) : '';
        let name = base; for (let i = 2; await this.taken(at(name)); i++) name = stem + ' ' + i + ext;
        if (TEXT_EXT.has(ext.slice(1).toLowerCase())) await this.app.vault.create(at(name), '');
        else await this.app.vault.createBinary(at(name), new ArrayBuffer(0));
        return reply({ ok: true, path: at(name), name });
      }
      // the playground's editors: a file's bytes (the page cannot fetch an app:// link, another origin to it) and a new file
      // beside it. an ArrayBuffer goes over as it is, with no base64 to encode. nothing is ever overwritten: a name that is
      // taken gets a number, as a copy does, and hidden folders are refused
      if (m.t === 'readBinary') {
        const f = this.fileAt(m.p); if (!f) return reply({ ok: false, err: 'not found' });
        if ((f.stat.size || 0) > BINARY_MAX) return reply({ ok: false, err: 'too big' });
        return reply({ ok: true, buf: await this.app.vault.readBinary(f) });
      }
      if (m.t === 'writeBinary') {
        if (!(m.buf instanceof ArrayBuffer) && !ArrayBuffer.isView(m.buf)) return reply({ ok: false, err: 'no data' });
        const buf = m.buf instanceof ArrayBuffer ? m.buf : m.buf.buffer.slice(m.buf.byteOffset, m.buf.byteOffset + m.buf.byteLength);
        if (buf.byteLength > BINARY_MAX) return reply({ ok: false, err: 'too big' });
        const want = normalizePath(String(m.p || '')), cut = want.lastIndexOf('/'), base = want.slice(cut + 1);
        if (!base || want.split('/').some(s => s.startsWith('.') || s === '..')) return reply({ ok: false, err: 'bad path' });
        // an edit saved over the file itself (so its links hold). the old bytes go to .trash first, and are read back and
        // compared there, before anything is written; a file that changed on disk meanwhile is left alone, so nothing arrives
        // and goes unkept. the write is checked after, and the old copy is named either way
        if (m.over) {
          if (!buf.byteLength) return reply({ ok: false, err: 'nothing to save (the result was empty)' });
          const f = this.fileAt(want); if (!f) return reply({ ok: false, err: 'not found' });
          const a = this.app.vault.adapter; let backup = null;
          try {
            if (!(await a.exists('.trash'))) await a.mkdir('.trash');
            const dot = f.name.lastIndexOf('.'), stem = dot > 0 ? f.name.slice(0, dot) : f.name, ext = dot > 0 ? f.name.slice(dot) : '';
            backup = '.trash/' + stem + ' (before edit)' + ext;
            for (let i = 2; await a.exists(backup); i++) backup = '.trash/' + stem + ' (before edit ' + i + ')' + ext;
            const was = await a.stat(f.path), old = await this.app.vault.readBinary(f);
            await a.writeBinary(backup, old);
            if (!sameBytes(await a.readBinary(backup), old)) throw new Error('the copy in .trash is not whole');
            const now = await a.stat(f.path);
            if (!was || !now || was.mtime !== now.mtime || was.size !== now.size || this.fileAt(want) !== f) throw new Error('the file changed on disk while saving, save again');
          } catch (e) { return reply({ ok: false, err: 'could not keep a copy of the original first, so nothing was changed: ' + (e && e.message || e) }); }
          try { await this.app.vault.modifyBinary(f, buf); }
          catch (e) { return reply({ ok: false, err: 'the write failed: ' + (e && e.message || e) + '. The original is at ' + backup }); }
          const st = await a.stat(f.path);
          if (!st || st.size !== buf.byteLength) return reply({ ok: false, err: 'the file did not land whole. The original is at ' + backup });
          return reply({ ok: true, path: f.path, name: f.name, size: st.size, m: Math.floor((st.mtime || Date.now()) / 1000), backup });
        }
        const into = this.folderAt(cut < 0 ? '' : want.slice(0, cut)); if (!into) return reply({ ok: false, err: 'folder not found' });
        const dir = cut < 0 ? '' : want.slice(0, cut + 1), dot = base.lastIndexOf('.'), stem = dot > 0 ? base.slice(0, dot) : base, ext = dot > 0 ? base.slice(dot) : '';
        let name = base; for (let i = 2; await this.taken(normalizePath(dir + name)); i++) name = stem + ' ' + i + ext;
        const made = await this.app.vault.createBinary(normalizePath(dir + name), buf);
        return reply({ ok: true, newPath: made.path, name: made.name });
      }
      // a duplicate goes next to the original; a paste after ctrl + C names another folder (to), where the copy keeps its
      // own name unless that is taken there
      if (m.t === 'duplicate') {
        const f = this.app.vault.getAbstractFileByPath(normalizePath(m.p)); if (!f || !f.parent) return reply({ ok: false, err: 'not found' });
        const into = m.to != null ? this.folderAt(String(m.to)) : f.parent; if (!into) return reply({ ok: false, err: 'folder not found' });
        if (f instanceof TFolder && ((into.path === '/' ? '' : into.path) + '/').startsWith(f.path + '/')) return reply({ ok: false, err: 'a folder cannot be copied inside itself' });
        const ext = f instanceof TFile && f.extension ? '.' + f.extension : '', stem = f instanceof TFile ? f.basename : f.name;
        const taken = n => this.taken(inFolder(into, n));
        let name = into !== f.parent && !await taken(f.name) ? f.name : stem + ' copy' + ext;
        for (let i = 2; await taken(name); i++) name = stem + ' copy ' + i + ext;
        const target = inFolder(into, name);
        await this.copyIn(f, target);
        return reply({ ok: true, newPath: target, name });
      }
      if (m.t === 'move') {
        const src = this.app.vault.getAbstractFileByPath(normalizePath(m.from));
        const dst = this.folderAt(m.to);
        if (!src || !dst) return reply({ ok: false, err: 'not found' });
        if (!src.parent) return reply({ ok: false, err: 'the vault itself cannot be moved' });
        const dstPath = dst.path === '/' ? '' : dst.path;
        if (src.parent === dst) return reply({ ok: true });
        if (src instanceof TFolder && (dstPath + '/').startsWith(src.path + '/')) return reply({ ok: false, err: 'a folder cannot go inside itself' });
        const target = inFolder(dst, src.name);
        if (await this.taken(target)) return reply({ ok: false, err: 'something with that name is already there' });
        // (one question, answered by a button or by closing it, which is a no)
        const ok = await new Promise(res => new ConfirmBatch(this.app, 'Move "' + src.path + '" into "' + (dst.path || '/') + '"?', 'Move', false, res).open());
        if (!ok) return reply({ ok: false, err: 'cancelled' });
        await this.moveTo(src, target);
        new Notice('Moved ' + src.name);
        return reply({ ok: true });
      }
      // a request this plugin does not know (a newer page reaching an older plugin, or the other way round) still gets an
      // answer, so the page does not wait on it
      return reply({ ok: false, err: 'unknown request' });
    } catch (e) {
      return reply({ ok: false, err: String(e && e.message || e) });
    }
  }
  // a move that keeps links. while Obsidian is at work on the links of a move of its own it says done before anything has moved,
  // and any failure goes elsewhere, so the answer waits to see this one happen
  async moveTo(f, target) {
    await this.app.fileManager.renameFile(f, target);
    for (let i = 0; i < 600 && f.path !== target; i++) await new Promise(r => window.setTimeout(r, 50));
    if (f.path !== target) throw new Error('Obsidian did not finish the move');
  }
  // whether a path is taken, in the vault or on disk (the adapter also sees what the vault does not index, a hidden file say)
  async taken(path) { return !!this.app.vault.getAbstractFileByPath(path) || await this.app.vault.adapter.exists(path); }
  // a copy, of a file or a whole folder with what the vault does not index (a dot file) in it, as a move carries it. on a
  // computer it is made under a hidden name beside where it goes and renamed into place once whole, so a failure, a quit or a
  // crash half way never leaves a short file under the real name, or half a folder
  async copyIn(src, to) {
    const a = this.app.vault.adapter;
    if (Platform.isDesktopApp && !Platform.isMobile) {
      const tmp = to.slice(0, to.lastIndexOf('/') + 1) + '.vwcopy-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try {
        await a.copy(src.path, tmp);
        if (src instanceof TFile) { const st = await a.stat(tmp), now = await a.stat(src.path); if (!st || !now || st.size !== now.size) throw new Error('the copy did not come out whole'); }
        // (on Windows a virus scanner can hold a new file for a moment; a name that is taken is not tried again)
        for (let i = 0; ; i++) {
          try { await a.rename(tmp, to); break; }
          catch (e) { if (i >= 10 || /exists/i.test(String(e && e.message))) throw e; await new Promise(r => window.setTimeout(r, 200)); }
        }
      } catch (e) {
        // (only what this copy made, under the name it made up)
        try { if (src instanceof TFile) await a.remove(tmp); else await a.rmdir(tmp, true); } catch (e2) { /* nothing made yet */ }
        throw e;
      }
      // (Obsidian hears of a name it did not make from the disk, a moment later, and on Linux not at all in a folder under one
      // it renamed, so it is told. the page may ask about it straight after)
      if (!this.app.vault.getAbstractFileByPath(to) && a.update) await a.update(to);
      for (let i = 0; i < 100 && !this.app.vault.getAbstractFileByPath(to); i++) await new Promise(r => window.setTimeout(r, 20));
      return;
    }
    // a phone copies as it can: file by file, and what could not be finished goes to .trash
    if (src instanceof TFile) { await this.app.vault.copy(src, to); return; }
    await this.app.vault.createFolder(to);
    try { await this.copyInside(src.path, to); }
    catch (e) { try { await a.trashLocal(to); } catch (e2) { /* it says so below */ } throw e; }
  }
  async copyInside(from, to) {
    const a = this.app.vault.adapter, all = await a.list(from), inTo = p => normalizePath(to + '/' + p.slice(p.lastIndexOf('/') + 1));
    for (const p of all.files) await a.copy(p, inTo(p));
    for (const p of all.folders) { await a.mkdir(inTo(p)); await this.copyInside(p, inTo(p)); }
  }
  // thumbnails are made three at a time, the small ones before the sharp ones, in the order the page asks (it asks for
  // the cards on screen first, then the ones near them). each is kept for the page's life, keyed by the file's change
  // time, so it is made once. one that cannot be made (a picture the browser cannot decode) goes over as the file itself
  // two sizes only (the page's small and sharp tiers), at most THUMB_KEEP kept: the one used longest ago goes, and its blob
  // link with it, as does the old one when a file changes. a picture too big to decode safely (a 30000 px png would take
  // gigabytes) goes over as the file itself
  // (art: a song's cover instead of a picture, made with the small ones; a song with no cover answers null)
  thumbQueued(f, px, art) {
    // the folder the page asked about last is the one you are looking at (see pumpThumbs)
    this.thumbQ.dir = f.parent;
    const tier = art === 'raw' || art === 'poster' ? art : art ? 'art' : px > THUMB_PX ? 1280 : THUMB_PX, key = f.path + '|' + tier, have = this.thumbs.get(key);
    if (have && have.mtime === f.stat.mtime) { this.thumbs.delete(key); this.thumbs.set(key, have); return have.job; }
    if (have) this.dropThumb(key, have);
    const entry = { mtime: f.stat.mtime, done: false };
    const make = art === 'raw' ? () => this.raw(f).catch(() => null) : art === 'poster' ? () => this.poster(f).catch(() => null) : art ? () => this.art(f).catch(() => null) : () => this.thumb(f, tier).catch(() => this.app.vault.getResourcePath(f));
    const q = tier === 'poster' ? this.thumbQ.poster : tier === 1280 ? this.thumbQ.high : this.thumbQ.low;
    entry.job = new Promise(res => q.push({ settle: res, dir: f.parent, run: () => make().then(res) }));
    entry.job.then(() => { entry.done = true; });
    this.thumbs.set(key, entry);
    // (a job still being made is never the one to go, its page is waiting on it)
    for (const [k, v] of this.thumbs) { if (this.thumbs.size <= THUMB_KEEP) break; if (v.done) this.dropThumb(k, v); }
    this.pumpThumbs();
    return entry.job;
  }
  dropThumb(key, v) {
    this.thumbs.delete(key);
    v.job.then(u => { if (typeof u === 'string' && this.blobs.has(u)) { URL.revokeObjectURL(u); this.blobs.delete(u); } });
  }
  pumpThumbs() {
    const q = this.thumbQ;
    // the folder asked about last goes first, small then sharp, so one you left with thumbnails still queued does not hold
    // up the one you opened. the rest follow in the order they were asked
    const mine = list => { const i = list.findIndex(j => j.dir === q.dir); return i < 0 ? null : list.splice(i, 1)[0]; };
    while (q.busy < 3 && (q.low.length || q.high.length)) {
      const run = mine(q.low) || mine(q.high) || (q.low.length ? q.low : q.high).shift(); q.busy++;
      run.run().then(() => { q.busy--; this.pumpThumbs(); });
    }
    // video frames one at a time, beside the pictures: each holds its file (or a big part of it) while it is made
    if (!q.posterBusy && q.poster.length) {
      const run = mine(q.poster) || q.poster.shift(); q.posterBusy = true;
      run.run().then(() => { q.posterBusy = false; this.pumpThumbs(); });
    }
  }
  // the pictures' sizes for a folder's listing, so the page lays them out right from the start. only the start of each
  // file is read, which takes node's file system: on mobile there is none, a whole file for each picture of a folder is
  // too much to read for a listing, and the page learns the sizes as the pictures come instead
  async pictureSizes(files) {
    const out = new Map(), ad = this.app.vault.adapter, fs = nodeModule('fs');
    if (!fs || !fs.promises || typeof ad.getFullPath !== 'function') return out;
    const mem = this.sizeMem || (this.sizeMem = new Map()), todo = [], until = Date.now() + HEAD_WAIT;
    for (const f of files) {
      if (!HEADED.has(f.extension.toLowerCase())) continue;
      const k = f.stat.mtime + ':' + f.stat.size, o = mem.get(f.path);
      if (o && o.k === k) out.set(f, o.z); else todo.push(f);
    }
    const one = async f => {
      const fh = await fs.promises.open(ad.getFullPath(f.path), 'r');
      try {
        const read = async n => { const b = new Uint8Array(Math.min(n, f.stat.size || n)), r = await fh.read(b, 0, b.length, 0); return b.buffer.slice(0, r.bytesRead); };
        let z = headSize(await read(HEAD_BYTES));
        // (a big exif block or colour profile can push a jpeg's frame header past the first read)
        if (!z && (f.stat.size || 0) > HEAD_BYTES && /^jpe?g$/i.test(f.extension)) z = headSize(await read(HEAD_MORE));
        if (z && z[0] > 0 && z[1] > 0) {
          out.set(f, z); mem.delete(f.path); mem.set(f.path, { k: f.stat.mtime + ':' + f.stat.size, z });
          while (mem.size > SIZE_KEEP) mem.delete(mem.keys().next().value);
        }
      } finally { await fh.close(); }
    };
    const worker = async () => { while (todo.length && Date.now() < until) { const f = todo.pop(); try { await one(f); } catch (e) { } } };
    await Promise.all(Array.from({ length: 12 }, worker));
    return out;
  }
  async thumb(f, px = THUMB_PX) { return this.shrink(await this.app.vault.readBinary(f), px); }
  // a gif or an svg as itself, from the page's own origin
  async raw(f) {
    const type = f.extension.toLowerCase() === 'svg' ? 'image/svg+xml' : 'image/gif';
    const url = URL.createObjectURL(new Blob([await this.app.vault.readBinary(f)], { type })); this.blobs.add(url);
    return url;
  }
  // a video's frame for its card, a second in (a tenth of the way into a short one), as a jpeg blob link. it is taken here
  // from the file's own bytes: the app:// link the page plays from is another origin to the page, so a frame taken there
  // could not be drawn into a card (and asked for with cors it did not load at all), and no video card ever got one
  // a video bigger than THUMB_MAX_BYTES is read only from its start, where the file can be read in part (desktop). that
  // holds a frame a second in when the video's index is at the front; one with it at the end keeps its plain card, as
  // does a big one where the file can only be read whole. the video's own blob goes as soon as the frame is taken
  async poster(f) {
    let bytes = null;
    if ((f.stat.size || 0) <= THUMB_MAX_BYTES) bytes = await this.app.vault.readBinary(f);
    else {
      const fs = nodeModule('fs'), ad = this.app.vault.adapter;
      if (!fs || !fs.promises || typeof ad.getFullPath !== 'function') return null;
      const fh = await fs.promises.open(ad.getFullPath(f.path), 'r');
      try { const b = new Uint8Array(POSTER_HEAD), r = await fh.read(b, 0, POSTER_HEAD, 0); bytes = b.subarray(0, r.bytesRead); }
      finally { await fh.close(); }
    }
    const src = URL.createObjectURL(new Blob([bytes])); bytes = null;
    const v = document.createElement('video');
    try {
      const c = await new Promise((res, rej) => {
        // (a video that never gets to its frame gives up after 10 s, so it does not hold up the frames queued behind it)
        const t = setTimeout(() => rej(new Error('no frame in time')), 10000);
        v.muted = true; v.preload = 'metadata'; v.playsInline = true;
        v.addEventListener('loadedmetadata', () => { v.currentTime = Math.min(1, (isFinite(v.duration) && v.duration || 2) * 0.1); }, { once: true });
        v.addEventListener('seeked', () => {
          clearTimeout(t);
          // kept no bigger than a card needs
          const s = Math.min(1, 960 / Math.max(v.videoWidth || 16, v.videoHeight || 9)), c = document.createElement('canvas');
          c.width = Math.max(16, Math.round((v.videoWidth || 16) * s)); c.height = Math.max(9, Math.round((v.videoHeight || 9) * s));
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); res(c);
        }, { once: true });
        v.addEventListener('error', () => { clearTimeout(t); rej(new Error('it cannot be played here')); }, { once: true });
        v.src = src;
      });
      const out = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
      if (!out) return null;
      const url = URL.createObjectURL(out); this.blobs.add(url);
      return url;
    } finally { v.removeAttribute('src'); v.load(); URL.revokeObjectURL(src); }
  }
  // a song's cover art, cut down like a small thumbnail; null when the song has none
  async art(f) {
    const pic = coverOf(await this.app.vault.readBinary(f), f.extension.toLowerCase());
    return pic ? this.shrink(pic.buffer.slice(pic.byteOffset, pic.byteOffset + pic.byteLength), THUMB_PX) : null;
  }
  // a jpeg of the picture, made from the file's bytes and handed over as a blob link (no base64 to encode and pass)
  // a picture too big to decode safely (a 30000 px png takes gigabytes) is left as the file: what counts is its pixels,
  // read from the png header, not its size on disk (a 63 MB png of a few thousand pixels is fine)
  async shrink(buf, px) {
    const dims = pngSize(buf);
    if (dims && dims[0] * dims[1] > THUMB_MAX_PIXELS) throw new Error('too many pixels to decode here');
    if (!dims && buf.byteLength > THUMB_MAX_BYTES) throw new Error('too big to decode here');
    // a png or a jpeg already no bigger than px goes over as itself: decoding it only to make the same picture again
    // costs time and some of its quality (the 1200 px pictures saved from the web, asked for at 1280)
    const sz = dims || jpegSize(buf);
    if (sz && Math.max(sz[0], sz[1]) <= px) { const url = URL.createObjectURL(new Blob([buf], { type: dims ? 'image/png' : 'image/jpeg' })); this.blobs.add(url); return url; }
    // a png's size is known from its header, so the browser can scale it while it decodes and never holds the full bitmap
    const blob = new Blob([buf]), s0 = dims ? Math.min(1, px / Math.max(dims[0], dims[1])) : 1;
    let bmp;
    if (dims && s0 < 1) {
      try { bmp = await createImageBitmap(blob, { resizeWidth: Math.max(1, Math.round(dims[0] * s0)), resizeHeight: Math.max(1, Math.round(dims[1] * s0)), resizeQuality: 'high' }); }
      catch (e) { bmp = null; }
    }
    // a jpeg's size comes from its frame header. only its width is given, so a photo the camera turned (exif) comes out
    // taller than px, never squashed, and the canvas below brings it to size as before
    const jd = !dims && sz;
    if (!bmp && jd && Math.max(jd[0], jd[1]) > px) {
      try { bmp = await createImageBitmap(blob, { resizeWidth: Math.min(px, jd[0]), resizeQuality: 'high' }); } catch (e) { bmp = null; }
    }
    if (!bmp) bmp = await createImageBitmap(blob);
    const s = Math.min(1, px / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
    const out = await new Promise(res => c.toBlob(res, 'image/jpeg', px > THUMB_PX ? 0.9 : 0.82));
    if (!out) throw new Error('no jpeg');
    const url = URL.createObjectURL(out); this.blobs.add(url);
    return url;
  }
};
// end of main.js
