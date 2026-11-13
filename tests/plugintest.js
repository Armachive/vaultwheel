// the plugin itself (plugin/main.js) in node with Obsidian faked, as far as main.js uses it, and the fake's plugin manager
// loading it the way Obsidian 1.14 does. main.js comes in on stdin:
//   RTEST_NODE=1 sh tools/rtest.sh plugin/main.js tests/plugintest.js
const main0 = require('fs').readFileSync(0, 'utf8');
const out = []; const T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
const DIR = '.obsidian/plugins/vaultwheel', ID = 'vaultwheel';
const tick = () => new Promise(r => setImmediate(r));
// (the owner's state unless said otherwise: a data.json from before the settings. fresh: a new install, with nothing there)
function world(mobile, desktop, fresh) {
  const w = { files: new Map(), times: new Map(), writes: [], notices: [], calls: [], intervals: new Set(), leaves: [], classes: new Set(mobile ? ['is-phone'] : []), classLog: [], watchers: [], clock: 1000, dev: {}, dataWrites: 0 };
  w.domEvents = [];
  w.put = (p, text) => { w.files.set(p, text); w.times.set(p, ++w.clock); };
  w.put(DIR + '/main.js', main0); w.put(DIR + '/manifest.json', JSON.stringify({ id: ID })); w.put(DIR + '/vaultwheel.html', '<page>');
  if (!fresh) w.put(DIR + '/data.json', '{"dirs":{}}');
  const adapter = {
    stat: async p => w.files.has(p) ? { mtime: w.times.get(p), size: w.files.get(p).length } : null,
    read: async p => { if (!w.files.has(p)) throw new Error('no ' + p); return w.files.get(p); },
    write: async (p, t) => { w.writes.push(p); w.put(p, t); },
    exists: async p => w.files.has(p)
  };
  class Plugin {
    constructor(app, manifest) { this.app = app; this.manifest = manifest; this.ends = []; this.mine = []; }
    registerInterval(i) { this.mine.push(i); w.intervals.add(i); return i; }
    registerEvent() { } registerDomEvent(el, t, f, o) { w.domEvents.push({ el, t, f, o, owner: this }); } registerView(t, f) { this.factory = f; } addRibbonIcon() { } addCommand(c) { (this.commands = this.commands || {})[c.id] = c; } addSettingTab(t) { this.tab = t; }
    async loadData() { return w.files.has(DIR + '/data.json') ? JSON.parse(w.files.get(DIR + '/data.json')) : null; }
    async saveData(d) { w.dataWrites++; w.put(DIR + '/data.json', JSON.stringify(d)); }
    unload() { this.onunload(); for (const i of this.mine) w.intervals.delete(i); w.domEvents = w.domEvents.filter(x => x.owner !== this); }
  }
  class ItemView { constructor() { } load() { throw new Error('a view does not override load: it is Obsidian\'s'); } } class Modal { } class Component { } class TFile { } class TFolder { } class PluginSettingTab { } class Setting { }
  class Notice { constructor(t) { w.notices.push(t); } }
  const Platform = { isMobile: !!mobile, isDesktopApp: !!desktop, isTablet: false, isPhone: !!mobile };
  w.Platform = Platform;
  const obsidian = { Plugin, PluginSettingTab, Setting, ItemView, Modal, Component, TFile, TFolder, Notice, Platform, MarkdownRenderer: {}, getLinkpath: p => p, normalizePath: p => p.replace(/\/+/g, '/') };
  const body = { classList: { toggle: (c, on) => { if (on) w.classes.add(c); else w.classes.delete(c); }, remove: c => { w.classes.delete(c); } }, hasClass: c => w.classes.has(c), addClass: c => { w.classes.add(c); w.classLog.push('+' + c); }, removeClass: c => { w.classes.delete(c); w.classLog.push('-' + c); }, toggleClass: (c, on) => { if (on) body.addClass(c); else body.removeClass(c); } };
  const G = { document: { body }, setInterval: f => ({ f }), setTimeout: (f, ms) => { if (w.timers) w.timers.push(f); return 0; }, addEventListener() { }, removeEventListener() { }, matchMedia: () => ({ matches: false }), dispatchEvent() { } };
  const app = {
    loadLocalStorage: k => (k in w.dev ? JSON.parse(w.dev[k]) : null), saveLocalStorage: (k, v) => { w.dev[k] = JSON.stringify(v); },
    vault: { adapter, configDir: '.obsidian', on() { } },
    workspace: { onLayoutReady(f) { f(); }, on() { }, trigger() { }, getLeavesOfType: () => w.leaves.map(v => ({ view: v })) }
  };
  const load = (code) => {
    const m = { exports: {} };
    new Function('require', 'module', 'exports', 'window', 'document', 'localStorage', 'MutationObserver', 'Event', 'getComputedStyle', code)(
      n => n === 'obsidian' ? obsidian : require(n), m, m.exports, G, { body, querySelectorAll: s => (w.dom ? w.dom().filter(e => e.closest(s) === e) : []) }, { getItem: k => (w.store && k in w.store ? w.store[k] : null), setItem(k, v) { if (w.store) w.store[k] = String(v); } },
      class { constructor(f) { this.on = true; w.watchers.push(this); } observe() { } disconnect() { this.on = false; } },
      class { }, () => ({ getPropertyValue: () => '1' }));
    return m.exports;
  };
  w.exports = () => load(w.files.get(DIR + '/main.js'));
  app.plugins = {
    plugins: {}, manifests: {},
    async disablePlugin(id) { w.calls.push('disable'); const p = this.plugins[id]; if (p) { p.unload(); delete this.plugins[id]; } },
    async loadManifests() { w.calls.push('manifests'); this.manifests[ID] = JSON.parse(w.files.get(DIR + '/manifest.json')); },
    async enablePlugin(id) {
      w.calls.push('enable');
      if (w.enableFails) return false;
      const P = w.exports(), n = new P(app, { id, dir: DIR }); this.plugins[id] = n; await n.onload(); return true;
    }
  };
  w.app = app; w.obsidian = obsidian; w.current = () => app.plugins.plugins[ID];
  // (the watcher's first look at main.js is not waited for by onload: a tick lets it finish)
  w.start = () => app.plugins.enablePlugin(ID).then(tick).then(() => { w.calls.length = 0; });
  w.check = async () => { await w.current().checkPage(); await tick(); };
  return w;
}
(async () => { try {
  // the theme tokens file
  {
    const w = world(false, true), cfg = '.obsidian/';
    w.put(cfg + 'plugins/obsidian-style-settings/data.json', '{}'); w.put(cfg + 'appearance.json', '{}');
    w.put(cfg + 'themes/Retroma/theme.css', 'a'); w.put(cfg + 'themes/Willemstad/theme.css', 'b');
    await w.start(); const p = w.current(), tok = DIR + '/theme-tokens.json';
    let val = 'one'; p.resolveTheme = async t => ({ v: val, k: t.key });
    await p.refreshThemes();
    T('the desktop app writes theme-tokens.json', w.writes.filter(x => x === tok).length === 1, JSON.stringify(w.writes));
    w.put(cfg + 'appearance.json', '{ }'); await p.refreshThemes();
    T('and not again when the themes come out the same', w.writes.filter(x => x === tok).length === 1 && p.themes.retroma.v === 'one', JSON.stringify(w.writes));
    val = 'two'; w.put(cfg + 'appearance.json', '{  }'); await p.refreshThemes();
    T('and again when they changed', w.writes.filter(x => x === tok).length === 2 && p.themes.retroma.v === 'two', JSON.stringify(w.writes));
  }
  // a stranger's vault: neither of those themes, or a theme with no Style Settings, or one that gives nothing
  {
    const w = world(false, true), cfg = '.obsidian/', tok = DIR + '/theme-tokens.json';
    await w.start(); const p = w.current(); let looked = 0; p.resolveTheme = async () => { looked++; return null; };
    await p.refreshThemes();
    T('no theme installed: nothing is read or written, and the wheel keeps its own colours', !looked && !w.writes.length && !p.themes, JSON.stringify(w.writes));
    w.put(cfg + 'themes/Retroma/theme.css', 'a'); await p.refreshThemes();
    T('a theme that gives nothing real: no theme-tokens.json', looked === 1 && !w.files.has(tok), JSON.stringify(w.writes));
    p.resolveTheme = async (t, css, ss) => ({ k: t.key, ss: Object.keys(ss).length }); w.put(cfg + 'themes/Retroma/theme.css', 'aa'); await p.refreshThemes();
    T('no Style Settings needed, and only the theme that is there is worked out', p.themes.retroma && p.themes.retroma.ss === 0 && !p.themes.willemstad && w.files.has(tok), JSON.stringify(p.themes));
  }
  for (const [name, mob] of [['a phone', true], ['the mobile app on a big screen', false]]) {
    const w = world(mob, false), cfg = '.obsidian/';
    w.put(cfg + 'plugins/obsidian-style-settings/data.json', '{}'); w.put(cfg + 'appearance.json', '{}');
    w.put(cfg + 'themes/Retroma/theme.css', 'a'); w.put(cfg + 'themes/Willemstad/theme.css', 'b');
    await w.start(); const p = w.current(); p.resolveTheme = async t => ({ v: 'phone', k: t.key });
    await p.refreshThemes();
    T(name + ' never writes it and still uses its own tokens', !w.writes.length && p.themes.retroma.v === 'phone', JSON.stringify(w.writes));
  }
  // the plugin loading itself again
  {
    const w = world(false, true), M = DIR + '/main.js', touch = t => w.put(M, t);
    w.put(DIR + '/data.json', '{"dirs":{},"settings":{"reload":true}}');
    await w.start(); const first = w.current();
    await w.check(); await w.check();
    T('with nothing new nothing happens', !w.calls.length && w.current() === first, w.calls.join());
    touch(main0);
    await w.check(); await w.check(); await w.check();
    T('the same file copied over itself does nothing', !w.calls.length && w.current() === first, w.calls.join());
    touch(main0 + '\n// new 1'); await w.check();
    T('a new file waits for a second look', !w.calls.length, w.calls.join());
    touch(main0 + '\n// new 2'); await w.check();
    T('a file still changing keeps waiting', !w.calls.length, w.calls.join());
    await w.check();
    T('once it holds still: off, manifests, on', w.calls.join() === 'disable,manifests,enable' && w.current() !== first, w.calls.join());
    T('the new plugin is the new file', w.current().mainSum !== first.mainSum && w.current().reloading === undefined, '');
    T('it says so once', w.notices.filter(n => /updated/.test(n)).length === 1, JSON.stringify(w.notices));
    T('the old plugin left no timers behind', w.intervals.size === w.current().mine.length, w.intervals.size + ' of ' + w.current().mine.length);
    w.calls.length = 0; for (let i = 0; i < 4; i++) await w.check();
    T('and it does not load itself again', !w.calls.length, w.calls.join());
    for (const [name, bad] of [['an empty file', ''], ['a cut off file', main0.slice(0, Math.floor(main0.length / 2))]]) {
      touch(bad); const before = w.current(); await w.check(); await w.check(); await w.check();
      T(name + ' is left alone', !w.calls.length && w.current() === before, w.calls.join());
    }
    touch(main0 + '\n// new 3'); await w.check(); await w.check();
    T('and the whole file then loads', w.calls.join() === 'disable,manifests,enable', w.calls.join());
    w.calls.length = 0; const good = w.files.get(DIR + '/manifest.json');
    w.put(DIR + '/manifest.json', '{"id":"vaul'); touch(main0 + '\n// new 4'); await w.check(); await w.check();
    T('a manifest still arriving holds it back', !w.calls.length, w.calls.join());
    w.put(DIR + '/manifest.json', good); await w.check();
    T('until it is whole', w.calls.join() === 'disable,manifests,enable', w.calls.join());
    // carrying something
    w.calls.length = 0; const v = w.current().factory({}); v.busy = true; w.leaves = [v];
    touch(main0 + '\n// new 5'); await w.check(); await w.check(); await w.check();
    T('it waits while you are carrying something', !w.calls.length, w.calls.join());
    v.busy = false; await w.check();
    T('and goes once you let go', w.calls.join() === 'disable,manifests,enable', w.calls.join());
    w.leaves = [];
    // the page coming too: only one swap, with the new plugin
    w.calls.length = 0; touch(main0 + '\n// new 6'); w.put(DIR + '/vaultwheel.html', '<new page>');
    await w.check(); await w.check();
    T('a new page with it waits for the new plugin', w.calls.join() === 'disable,manifests,enable' && w.current().pageStamp === w.current().seenStamp, w.calls.join());
    // turned off by hand as it looks
    const off = w.current(); touch(main0 + '\n// new 7'); await off.checkPage(); w.calls.length = 0;
    await w.app.plugins.disablePlugin(ID); w.calls.length = 0; await off.checkPage();
    T('a plugin turned off by hand stays off', !w.calls.length && !w.current(), w.calls.join());
  }
  // a new file: the page's newFile message, on a fake vault
  {
    const w = world(false, true); w.app.vault.getName = () => 'V'; await w.start();
    const root = new w.obsidian.TFolder(); root.path = '/';
    const sub = new w.obsidian.TFolder(); sub.path = 'Sub';
    const made = [], there = new Set(['taken.md', 'Sub/taken.md', 'nums.png', 'nums 2.png']), hidden = new Set(['ghost.md']);
    Object.assign(w.app.vault, {
      getRoot: () => root,
      getAbstractFileByPath: p => p === 'Sub' ? sub : there.has(p) ? {} : null,
      create: async (p, text) => { if (there.has(p) || hidden.has(p)) throw new Error('File already exists.'); if (p.includes('?')) throw new Error('bad characters'); made.push(['text', p, text]); there.add(p); return {}; },
      createBinary: async (p, buf) => { if (there.has(p) || hidden.has(p)) throw new Error('File already exists.'); made.push(['bin', p, buf.byteLength]); there.add(p); return {}; }
    });
    w.app.vault.adapter.exists = async p => there.has(p) || hidden.has(p);
    const ask = (p, name) => new Promise(res => w.current().handle({ vw: 1, id: 1, t: 'newFile', p, name }, { postMessage: m => res(m) }));
    let r = await ask('', 'a.md');
    T('a text file is made empty, as text', r.ok && r.name === 'a.md' && r.path === 'a.md' && JSON.stringify(made.pop()) === '["text","a.md",""]', JSON.stringify(r));
    r = await ask('Sub', 'b.png');
    T('a picture\'s name is made as an empty binary, in the folder asked', r.ok && r.path === 'Sub/b.png' && JSON.stringify(made.pop()) === '["bin","Sub/b.png",0]', JSON.stringify(r));
    r = await ask('', 'plain');
    T('no extension is allowed, and is text', r.ok && r.name === 'plain' && made.pop()[0] === 'text', JSON.stringify(r));
    r = await ask('', 'S.MD');
    T('an extension in capitals counts', r.ok && made.pop()[0] === 'text', JSON.stringify(r));
    r = await ask('', 'taken.md');
    T('a taken name gets a number and nothing is overwritten', r.ok && r.name === 'taken 2.md' && made.pop()[1] === 'taken 2.md', JSON.stringify(r));
    r = await ask('', 'ghost.md');
    T('so does one taken by a hidden file', r.ok && r.name === 'ghost 2.md' && made.pop()[1] === 'ghost 2.md', JSON.stringify(r));
    r = await ask('', 'nums.png');
    T('the number goes before the extension and counts on', r.ok && r.name === 'nums 3.png', JSON.stringify(r)); made.pop();
    for (const bad of ['a/b.md', 'a\\b.md', 'a:b.md', '.hid', '', '   ']) { r = await ask('', bad); T('refused: ' + JSON.stringify(bad), r.ok === false && !!r.err && !made.length, JSON.stringify(r)); }
    r = await ask('Nope', 'x.md');
    T('a folder that is not there is refused', r.ok === false && /folder/.test(r.err) && !made.length, JSON.stringify(r));
    r = await ask('', 'bad?.md');
    T('a name the disk will not take comes back with the reason', r.ok === false && /bad characters/.test(r.err), JSON.stringify(r));
  }
  // the sidebars are Obsidian's: whatever an older version left in this device's storage or in data.json (where the wheel lived, the
  // sidebars' arrangement), a start, a layout change and a reload open, close and move nothing, on a computer or a phone
  for (const mobile of [false, true]) for (const home of ['left', 'left-props', 'right']) {
    const w = world(mobile, !mobile), acts = []; let fire = () => { };
    w.dev['vaultwheel-device'] = JSON.stringify({ home: home === 'right' ? 'right' : 'left', props: home === 'left-props', closed: false, tablet: true, legacy: true, drawer: ['file-explorer'], movedRight: ['search'] });
    w.put(DIR + '/data.json', JSON.stringify({ dirs: {}, settings: { hover: false, rightArrange: true, rightFile: 'a.base', rightView: 'v' } }));
    const leaf = (type, side) => ({ type, side, getRoot: () => side, getViewState: () => ({ type }), view: { getViewType: () => type }, setViewState: async s => acts.push('set ' + s.type), detach: () => acts.push('detach ' + type) });
    const leaves = [leaf('file-explorer', 'left'), leaf('search', 'left'), leaf('outline', 'right'), leaf('markdown', 'main')];
    const make = n => () => { acts.push('new leaf ' + n); return leaf('empty', n); };
    Object.assign(w.app.workspace, { leftSplit: { children: [], expand: () => acts.push('expand') }, rightSplit: { children: [], expand: () => acts.push('expand') }, getLeftLeaf: make('left'), getRightLeaf: make('right'), getLeaf: make('main'),
      createLeafBySplit: make('split'), createLeafInParent: make('parent'), getLeavesOfType: t => leaves.filter(l => l.type === t), iterateAllLeaves: f => leaves.forEach(f), on: (e, f) => { if (e === 'layout-change') fire = f; } });
    await w.start(); fire(); await tick();
    await w.app.plugins.disablePlugin(ID); await w.app.plugins.enablePlugin(ID); fire(); await tick();
    const p = w.current();
    T((mobile ? 'phone' : 'computer') + ', an old ' + home + ' record and old sidebar settings: nothing is opened, closed or moved', !acts.length && !w.classes.has('is-tablet'), acts.join());
    T((mobile ? 'phone' : 'computer') + ', ' + home + ': the old keys are not taken up, the three settings are', p.settings.hover === false && !('rightArrange' in p.settings) && !p.device, JSON.stringify(p.settings));
  }
  // the requests that change files, on a small disk behind the fake vault. blind: a disk that finds a name in any case, as
  // on Windows and macOS. phone: a vault.copy that goes over what is there, as a phone's does
  const diskWorld = async (opt = {}) => {
    const w = world(!!opt.phone, !opt.phone), O = w.obsidian, disk = new Map(), idx = new Map(), bytes = s => Buffer.from(s);
    const later = () => new Promise(r => setImmediate(r));
    const find = p => { if (disk.has(p) || !opt.blind) return p; for (const k of disk.keys()) if (k.toLowerCase() === p.toLowerCase()) return k; return p; };
    const hidden = p => p.split('/').some(s => s.startsWith('.'));
    const base = p => p.slice(p.lastIndexOf('/') + 1);
    const mk = (p, dir) => {
      const f = dir ? new O.TFolder() : new O.TFile(), up = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '/';
      f.path = p; f.name = base(p); if (dir) f.children = []; else { const d = f.name.lastIndexOf('.'); f.basename = d > 0 ? f.name.slice(0, d) : f.name; f.extension = d > 0 ? f.name.slice(d + 1) : ''; f.stat = { size: 0, mtime: 1 }; }
      f.parent = idx.get(up) || null; if (f.parent) f.parent.children.push(f); idx.set(p, f); return f;
    };
    const root = new O.TFolder(); root.path = '/'; root.name = ''; root.children = []; idx.set('/', root);
    const unindex = f => { if (f.children) [...f.children].forEach(unindex); if (f.parent) f.parent.children.splice(f.parent.children.indexOf(f), 1); idx.delete(f.path); };
    const put = (p, data) => {
      const up = p.split('/').slice(0, -1); for (let i = 1; i <= up.length; i++) { const d = up.slice(0, i).join('/'); if (!disk.has(d)) { disk.set(d, null); if (!hidden(d)) mk(d, true); } }
      disk.set(p, data === null ? null : bytes(data)); if (!hidden(p) && !idx.has(p)) mk(p, data === null);
    };
    const under = p => [...disk.keys()].filter(k => k === p || k.startsWith(p + '/'));
    const a = {
      exists: async p => { await later(); return disk.has(find(p)); },
      stat: async p => { await later(); const k = find(p); return disk.has(k) ? { size: disk.get(k) ? disk.get(k).length : 0, mtime: w.times.get(k) || 1 } : null; },
      read: async p => { await later(); if (!disk.has(find(p))) throw new Error('no ' + p); return disk.get(find(p)).toString(); },
      readBinary: async p => { await later(); const b = disk.get(find(p)); if (!b) throw new Error('no ' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); },
      write: async (p, t) => { await later(); put(p, t); },
      writeBinary: async (p, b) => { await later(); put(p, Buffer.from(b)); },
      mkdir: async p => { await later(); put(p, null); },
      list: async p => { await later(); const kids = [...disk.keys()].filter(k => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/')); return { files: kids.filter(k => disk.get(k) !== null), folders: kids.filter(k => disk.get(k) === null) }; },
      copy: async (x, y) => {
        await later();
        if (opt.failCopy && opt.failCopy(x)) throw new Error('no space left on the disk');
        const kx = find(x); if (!disk.has(kx)) throw new Error('ENOENT');
        for (const k of under(kx)) { const t = y + k.slice(kx.length); if (!opt.phone && disk.has(find(t))) throw new Error('EEXIST'); if (opt.short && disk.get(k)) { put(t, disk.get(k).subarray(0, 1)); opt.short = false; } else put(t, disk.get(k)); }
      },
      rename: async (x, y) => {
        await later();
        const kx = find(x); if (!disk.has(kx)) throw new Error('ENOENT');
        if (disk.has(find(y)) && find(y) !== kx) throw new Error('Destination file already exists!');
        for (const k of under(kx)) { const v = disk.get(k); disk.delete(k); const n = y + k.slice(kx.length); disk.set(n, v); const f = idx.get(k); if (f) { idx.delete(k); f.path = n; f.name = base(n); idx.set(n, f); } else if (!hidden(n) && !opt.deaf) mk(n, v === null); }
        const f = idx.get(y); if (f && f.parent) { const up = y.includes('/') ? y.slice(0, y.lastIndexOf('/')) : '/'; if ((f.parent.path || '/') !== up) { f.parent.children.splice(f.parent.children.indexOf(f), 1); f.parent = idx.get(up); f.parent.children.push(f); } }
      },
      update: async p => { await later(); for (const k of under(p)) if (!idx.has(k)) mk(k, disk.get(k) === null); },
      remove: async p => { await later(); disk.delete(find(p)); },
      rmdir: async p => { await later(); for (const k of under(find(p))) disk.delete(k); },
      trashLocal: async p => { await later(); const k = find(p); for (const c of under(k)) { const v = disk.get(c); disk.delete(c); disk.set('.trash/' + base(k) + c.slice(k.length), v); } disk.set('.trash', null); const f = idx.get(k); if (f) unindex(f); }
    };
    Object.assign(w.app.vault, {
      adapter: a, getName: () => 'V', getRoot: () => root, getAbstractFileByPath: p => idx.get(p) || null,
      readBinary: f => a.readBinary(f.path), modifyBinary: (f, b) => a.writeBinary(f.path, b),
      create: async (p, t) => { if (await a.exists(p)) throw new Error('File already exists.'); await a.write(p, t); return idx.get(p); },
      createBinary: async (p, b) => { if (await a.exists(p)) throw new Error('File already exists.'); await a.writeBinary(p, b); return idx.get(p); },
      createFolder: async p => { if (await a.exists(p)) throw new Error('Folder already exists.'); await a.mkdir(p); return idx.get(p); },
      copy: async (f, y) => { await a.copy(f.path, y); return idx.get(y); }, trash: (f) => a.trashLocal(f.path)
    });
    w.app.fileManager = { renameFile: (f, t) => a.rename(f.path, t) };
    O.Modal.prototype.open = function () { this.answered = true; this.done(true); this.onClose = () => { }; };
    await w.start();
    w.disk = disk; w.put2 = put; w.text = p => disk.has(p) && disk.get(p) ? disk.get(p).toString() : null; w.a = a;
    w.say = m => new Promise(res => w.current().handle(Object.assign({ vw: 1, id: 1 }, m), { postMessage: res }));
    return w;
  };
  // a copy never goes over what is there: a hidden name the vault does not index, or a name that differs in case on a disk
  // that cannot tell them apart
  {
    let d = await diskWorld({ phone: true, blind: true });
    d.put2('X/A.md', 'from X'); d.put2('Y/a.md', 'lower a in Y');
    let r = await d.say({ t: 'copyMany', from: ['X/A.md'], to: 'Y' });
    T('copy here on a phone: a name that differs in case is not copied over', d.text('Y/a.md') === 'lower a in Y' && r.results[0].ok && r.results[0].name === 'A copy.md' && d.text('Y/A copy.md') === 'from X', JSON.stringify(r));
    d = await diskWorld({ phone: true });
    d.put2('X/.hid', 'from X'); d.put2('X/n.md', 'from X'); d.put2('Y/.hid', 'hidden in Y'); d.put2('Y/n.md', 'n in Y');
    r = await d.say({ t: 'copyMany', from: ['X/n.md'], to: 'Y' });
    T('and what is there stays', d.text('Y/n.md') === 'n in Y' && d.text('Y/n copy.md') === 'from X', JSON.stringify(r));
  }
  // requests at the same moment (two wheels, two windows) go one at a time
  {
    const d = await diskWorld();
    d.put2('X/n.bin', 'there first');
    const buf = s => Buffer.from(s).buffer.slice(Buffer.from(s).byteOffset, Buffer.from(s).byteOffset + s.length), two = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b.buffer; };
    const rs = await Promise.all(['one', 'two', 'three'].map(s => d.say({ t: 'writeBinary', p: 'X/new.bin', buf: two(s) })));
    const names = rs.map(r => r.name), texts = names.map(n => d.text('X/' + n));
    T('three saves beside a file at once: three files, none over another', new Set(names).size === 3 && texts.join() === 'one,two,three', JSON.stringify(rs) + texts);
    const ns = await Promise.all([1, 2, 3].map(() => d.say({ t: 'newFile', p: 'X', name: 'n.bin' })));
    T('three new files of one name at once are numbered', new Set(ns.map(r => r.name)).size === 3 && d.text('X/n.bin') === 'there first', JSON.stringify(ns));
    const order = []; const f0 = d.app.fileManager.renameFile; let held; d.app.fileManager.renameFile = (f, t) => new Promise(res => { order.push('start ' + t); held = () => f0(f, t).then(res); });
    const m1 = d.say({ t: 'moveMany', from: ['X/n.bin'], to: '' }), r1 = d.say({ t: 'rename', p: 'X/new.bin', name: 'z.bin' }); d.say({ t: 'thumb', p: 'none' });
    await tick(); await tick(); await tick(); await tick();
    const looked = order.length; await tick();
    T('a rename waits for the move before it', looked === 1, order.join());
    d.app.fileManager.renameFile = f0; held(); await m1; await r1;
  }
  // an editor's save over a file: only with the old bytes in .trash, read back
  {
    const d = await diskWorld(), ab = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b.buffer; }, a = d.a, wb = a.writeBinary;
    d.put2('X/p.png', 'the old bytes');
    a.writeBinary = (p, b) => wb(p, p.startsWith('.trash/') ? new ArrayBuffer(b.byteLength) : b);
    let r = await d.say({ t: 'writeBinary', p: 'X/p.png', over: true, buf: ab('new') }); a.writeBinary = wb;
    T('a copy in .trash of the right size and the wrong bytes stops the save', !r.ok && d.text('X/p.png') === 'the old bytes', JSON.stringify(r));
    a.writeBinary = (p, b) => wb(p, p.startsWith('.trash/') ? b.slice(0, 2) : b);
    r = await d.say({ t: 'writeBinary', p: 'X/p.png', over: true, buf: ab('new') }); a.writeBinary = wb;
    T('so does a short one', !r.ok && d.text('X/p.png') === 'the old bytes', JSON.stringify(r));
    const rb = d.app.vault.readBinary; let once = 0;
    d.app.vault.readBinary = async f => { const b = await rb(f); if (!once++) { d.put2('X/p.png', 'came from a sync'); d.w_times = 1; } return b; };
    const st = a.stat; let n = 0; a.stat = async p => { const s = await st(p); if (s && p === 'X/p.png') s.mtime = once ? 2 : 1; return s; };
    r = await d.say({ t: 'writeBinary', p: 'X/p.png', over: true, buf: ab('new') }); d.app.vault.readBinary = rb; a.stat = st;
    T('a file changed on disk during the save is left as it is', !r.ok && d.text('X/p.png') === 'came from a sync', JSON.stringify(r));
    r = await d.say({ t: 'writeBinary', p: 'X/p.png', over: true, buf: ab('new') });
    T('a clean save lands, with the old bytes kept', r.ok && d.text('X/p.png') === 'new' && d.text(r.backup) === 'came from a sync', JSON.stringify(r));
  }
  // a copy comes out whole or not at all, dot files and all
  {
    for (const phone of [false, true]) {
      const on = phone ? 'on a phone: ' : 'on a computer: ';
      let d = await diskWorld({ phone });
      d.put2('Y', null); d.put2('F/a.md', 'a'); d.put2('F/.hid', 'hidden'); d.put2('F/sub/b.md', 'b'); d.put2('F/sub/.git/x', 'x');
      let r = await d.say({ t: 'duplicate', p: 'F', to: 'Y' });
      T(on + 'a folder copy takes its dot files too', r.ok && d.text('Y/F/a.md') === 'a' && d.text('Y/F/.hid') === 'hidden' && d.text('Y/F/sub/b.md') === 'b' && d.text('Y/F/sub/.git/x') === 'x', JSON.stringify(r) + JSON.stringify([...d.disk.keys()]));
      T(on + 'and the temporary name is gone', ![...d.disk.keys()].some(k => k.includes('.vwcopy')), JSON.stringify([...d.disk.keys()]));
      let n = 0; d = await diskWorld({ phone, failCopy: () => phone && ++n === 2 });
      d.put2('Y', null); d.put2('F/a.md', 'a'); d.put2('F/b.md', 'b'); d.put2('F/c.md', 'c');
      if (!phone) { const c0 = d.a.copy; d.a.copy = async (x, y) => { await c0(x, y); d.a.copy = c0; throw new Error('no space left on the disk'); }; }
      r = await d.say({ t: 'duplicate', p: 'F', to: 'Y' });
      const left = [...d.disk.keys()].filter(k => k.startsWith('Y/F') || k.startsWith('Y/.vw'));
      T(on + 'a folder copy that fails half way says so and leaves nothing half made', !r.ok && !left.length && d.text('F/c.md') === 'c', JSON.stringify(r) + JSON.stringify(left));
    }
    { // (a folder Obsidian no longer hears, as on Linux under a folder it renamed: it is told of the copy)
      const d = await diskWorld({ deaf: true }); d.put2('Y', null); d.put2('X/a.md', 'mine'); d.put2('F/b.md', 'b');
      const r = await d.say({ t: 'duplicate', p: 'X/a.md', to: 'Y' }), r2 = await d.say({ t: 'duplicate', p: 'F', to: 'Y' });
      T('Obsidian is told of a copy it does not hear of', r.ok && r2.ok && !!d.app.vault.getAbstractFileByPath('Y/a.md') && !!d.app.vault.getAbstractFileByPath('Y/F/b.md'), JSON.stringify([r, r2]));
    }
    { // (a name taken in the last instant is refused, and the temporary one goes)
      const d = await diskWorld(); d.put2('Y', null); d.put2('X/a.md', 'mine');
      const c0 = d.a.copy; d.a.copy = async (x, y) => { await c0(x, y); d.a.copy = c0; d.put2('Y/a.md', 'arrived meanwhile'); };
      const r = await d.say({ t: 'duplicate', p: 'X/a.md', to: 'Y' });
      T('a name taken while the copy ran is left alone', !r.ok && d.text('Y/a.md') === 'arrived meanwhile' && ![...d.disk.keys()].some(k => k.includes('.vwcopy')), JSON.stringify(r) + JSON.stringify([...d.disk.keys()]));
    }
    const d = await diskWorld({ short: true });
    d.put2('Y', null); d.put2('X/a.md', 'abcdef');
    const r = await d.say({ t: 'duplicate', p: 'X/a.md', to: 'Y' });
    T('a copy that comes out short is not kept', !r.ok && !d.disk.has('Y/a.md') && ![...d.disk.keys()].some(k => k.includes('.vwcopy')), JSON.stringify(r) + JSON.stringify([...d.disk.keys()]));
  }
  // a move looks on disk for a name too, and the answer waits to see it happen
  {
    const d = await diskWorld({ blind: true });
    d.put2('X/A.md', 'from X'); d.put2('Y/a.md', 'lower a in Y');
    let r = await d.say({ t: 'moveMany', from: ['X/A.md'], to: 'Y' });
    T('a move onto a name differing in case is refused, by name', !r.results[0].ok && /already there/.test(r.results[0].err) && d.text('Y/a.md') === 'lower a in Y' && d.text('X/A.md') === 'from X', JSON.stringify(r));
    const fm = d.app.fileManager, f0 = fm.renameFile; let later = null, said = null;
    d.put2('Z', null);
    fm.renameFile = (f, t) => { later = () => f0(f, t); fm.renameFile = f0; return Promise.resolve(); };
    const G0 = d.obsidian; const m = d.say({ t: 'rename', p: 'X/A.md', name: 'A2.md' }).then(x => { said = x; });
    for (let i = 0; i < 6; i++) await tick();
    T('Obsidian saying done before it moved anything is not taken for done', said === null && d.text('X/A.md') === 'from X', JSON.stringify(said));
  }
  // the class that takes the wheel's tab strip away (markAlone): a small stand-in for Obsidian's elements, in the same shape, with
  // enough of querySelectorAll and closest for the selector main.js really uses
  {
    const VW = 'vaultwheel-view', ALONE = '.vaultwheel-alone';
    const el = (cls, kids = [], type) => {
      const e = { cls: new Set(cls.split(' ')), type, kids: [], up: null, classList: { add: c => e.cls.add(c), remove: c => e.cls.delete(c), contains: c => e.cls.has(c) } };
      e.closest = s => { for (let x = e; x; x = x.up) if (fits(x, s)) return x; return null; };
      for (const k of kids) { k.up = e; e.kids.push(k); }
      return e;
    };
    const simple = (e, part) => [...part.matchAll(/\.([\w-]+)|\[data-type="([\w-]+)"\]|:(only-child)/g)].every(m => m[1] ? e.cls.has(m[1]) : m[2] ? e.type === m[2] : e.up && e.up.kids.length === 1);
    // right to left. a ' ' looks at every parent, and only one chain has to work
    const chain = (e, parts) => {
      if (!e || !simple(e, parts[parts.length - 1])) return false;
      const rest = parts.slice(0, -1); if (!rest.length) return true;
      if (rest[rest.length - 1] === '>') return chain(e.up, rest.slice(0, -1));
      for (let x = e.up; x; x = x.up) if (chain(x, rest)) return true;
      return false;
    };
    const fits = (e, s) => chain(e, s.trim().split(/\s+/));
    const leafEl = type => el('workspace-leaf', [el('workspace-leaf-content', [], type)]);
    const group = (...types) => el('workspace-tabs', [el('workspace-tab-header-container'), el('workspace-tab-container', types.map(leafEl))]);
    const split = (n, ...groups) => el('workspace-split ' + n, groups);
    const box = g => g.kids[1];
    const start = async (doc, opts = {}) => {
      const w = world(false, true, true); let fire = () => { };
      w.dom = () => { const all = [], walk = e => { all.push(e); e.kids.forEach(walk); }; walk(doc()); return all; };
      w.app.workspace.on = (e, f) => { if (e === 'layout-change') fire = f; };
      if (opts.code) w.put(DIR + '/main.js', opts.code);
      await w.start();
      const marked = () => w.dom().filter(e => fits(e, ALONE));
      return { w, marked, fire: () => fire(), plugin: () => w.current() };
    };
    let left = group(VW), page = el('workspace', [split('mod-left-split', left), split('mod-root', group('markdown')), split('mod-right-split', group('outline'))]);
    const r = await start(() => page);
    const only = g => r.marked().length === 1 && r.marked()[0] === g;
    T('alone in the left sidebar: its group has the class from the start', only(left));
    // a second tab joins, it goes; the tab leaves, it comes back
    { const why = 'running';
      const tab = leafEl('tag'); tab.up = box(left); box(left).kids.push(tab); r.fire();
      T('while ' + why + ': a second tab takes the class away', !r.marked().length, r.marked().length + '');
      box(left).kids.pop(); r.fire();
      T('while ' + why + ': and that tab leaving brings it back', only(left));
    }
    // the wheel moves away, to the right and to a tab: nothing is left marked, and the right sidebar's own group is never marked
    const leftS = page.kids[0], rightS = page.kids[2], rootS = page.kids[1];
    const [wheelLeaf] = box(left).kids.splice(0, 1); wheelLeaf.up = null;
    const rg = group(); box(rg).kids.push(wheelLeaf); wheelLeaf.up = box(rg); rg.up = rightS; rightS.kids.push(rg); r.fire();
    T('the wheel moved to the right sidebar: no class, there or on the group it left', !r.marked().length, r.marked().length + '');
    rightS.kids.pop(); const mg = group(); box(mg).kids.push(wheelLeaf); wheelLeaf.up = box(mg); mg.up = rootS; rootS.kids.push(mg); r.fire();
    T('and in a tab of its own in the main area: none', !r.marked().length, r.marked().length + '');
    // the top group over it: the class goes on the wheel's group and nowhere else
    rootS.kids.pop(); const top = group('file-properties', 'all-properties'), wg = group(); box(wg).kids.push(wheelLeaf); wheelLeaf.up = box(wg);
    for (const g of [top, wg]) { g.up = leftS; } leftS.kids = [top, wg]; r.fire();
    T('under a top group: only the wheel\'s group has it', only(wg));
    // a saved workspace: every element is new
    const before = wg; page = el('workspace', [split('mod-left-split', group('file-explorer', 'search')), split('mod-root', group('markdown')), split('mod-right-split', group('outline'))]); r.fire();
    T('a saved workspace with no wheel coming in: nothing marked', !r.marked().length, r.marked().length + '');
    left = group(VW); page = el('workspace', [split('mod-left-split', left), split('mod-root', group('markdown'))]); r.fire();
    T('one with the wheel alone on the left: the new group has it', only(left) && left !== before);
    // the plugin going and coming back
    await r.w.app.plugins.disablePlugin(ID);
    T('the plugin off: no class is left anywhere', !r.marked().length && !left.cls.has('vaultwheel-alone'), r.marked().length + '');
    await r.w.app.plugins.enablePlugin(ID); await tick();
    T('the plugin back: its group has it again', only(left));
    // (the view asks too: a layout coming in tells nobody until all of it is ready, which waits for the page)
    const asked = r.plugin(); let looked = 0; const m0 = asked.markAlone; asked.markAlone = function () { looked++; return m0.call(this); };
    const v = asked.factory({}); v.loadPage = async () => { }; v.registerDomEvent = () => { }; v.registerEvent = () => { }; v.containerEl = {}; v.app = asked.app;
    await v.onOpen();
    T('a wheel opening looks at once', looked === 1, String(looked));
    // a phone's sidebar list of views, open over the wheel: a press in the page puts it away, and a view anywhere else is left alone
    const list = { tabOptionsCollapsed: false, setTabOptionsCollapsed(on) { this.tabOptionsCollapsed = on; } }, src = {};
    v.leaf = { parent: list }; v.frame = { contentWindow: src }; asked.handle = () => { throw new Error('a press is not a request'); };
    v.onMsg({ source: src, data: { vw: 1, t: 'press' } });
    T('a press in the wheel puts the sidebar\'s list of views away', list.tabOptionsCollapsed === true);
    v.onMsg({ source: src, data: { vw: 1, t: 'press' } });
    T('and does nothing with it put away', list.tabOptionsCollapsed === true);
    v.leaf = { parent: { children: [] } }; v.onMsg({ source: src, data: { vw: 1, t: 'press' } });
    T('in a tab or a computer\'s sidebar a press is nothing', true);
    await r.w.app.plugins.disablePlugin(ID);
    T('turned off again: gone', !r.marked().length, r.marked().length + '');
  }
  // the page lets the pointer through while the right or middle button, pressed out in Obsidian, is held: the logic, on a fake window.
  // what it is for, a canvas pan released over the wheel, can only be seen in real Obsidian
  {
    const CLS = 'vaultwheel-pass';
    const w = world(false, true, true); w.timers = [];
    let opened = null; w.app.workspace.on = (e, f) => { if (e === 'window-open') opened = f; };
    const fakeWin = () => { const c = new Set(), x = { closed: false, timers: [], setTimeout: f => { x.timers.push(f); return 0; }, document: { body: { classList: { toggle: (k, on) => { if (on) c.add(k); else c.delete(k); }, remove: k => c.delete(k) } } }, on: () => c.has(CLS) }; return x; };
    const floating = fakeWin(); w.app.workspace.floatingSplit = { children: [{ win: floating }, {}] };
    await w.start();
    const main = w.current(), G = [...main.pressWins][0];
    const fire = (win, t, e = {}) => { for (const d of w.domEvents.filter(x => x.el === win && x.t === t)) d.f(Object.assign({ type: t }, e)); };
    const on = () => w.classes.has(CLS), run = () => { for (const f of w.timers.splice(0)) f(); };
    T('every window is listened on in the capture phase, but for blur', ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'pointermove', 'pointercancel'].every(t => w.domEvents.some(d => d.el === G && d.t === t && d.o === true)) && w.domEvents.some(d => d.el === G && d.t === 'blur' && !d.o));
    for (const [n, button] of [['middle', 1], ['right', 2]]) {
      fire(G, 'pointerdown', { button, buttons: button === 1 ? 4 : 2 });
      T('a ' + n + ' press out in Obsidian lets the pointer through the page', on());
      fire(G, 'pointermove', { buttons: button === 1 ? 4 : 2 });
      T('and it stays so while the button is held', on());
      fire(G, 'pointerup', { button, buttons: 0 }); fire(G, 'mouseup', { button, buttons: 0 });
      T('the release does not end it inside its own event (a context menu comes straight after, on Windows)', on());
      run();
      T('and it has ended just after', !on());
    }
    fire(G, 'pointerdown', { button: 0, buttons: 1 });
    T('a left press is left as it is', !on());
    fire(G, 'mousedown', { button: 2, buttons: 3 });
    T('a right press added to a held left one fires mousedown alone, and counts', on());
    fire(G, 'mouseup', { button: 2, buttons: 1 }); run();
    T('with the left still held it goes on', on());
    fire(G, 'pointerup', { button: 0, buttons: 0 }); run();
    T('all up, it ends', !on());
    fire(G, 'pointerdown', { button: 1, buttons: 4 }); fire(G, 'pointermove', { buttons: 0 });
    T('a release nobody heard (a system menu took it): the next move with nothing held ends it, at once', !on());
    fire(G, 'pointerdown', { button: 1, buttons: 4 }); fire(G, 'pointercancel', { buttons: 0 });
    T('a cancelled pointer ends it', !on());
    fire(G, 'pointerdown', { button: 2, buttons: 2 }); fire(G, 'blur');
    T('the window losing focus ends it', !on());
    fire(G, 'pointerdown', { button: 1, buttons: 4 }); fire(G, 'pointerup', { button: 1, buttons: 0 }); fire(G, 'pointerdown', { button: 1, buttons: 4 }); run();
    T('a new press straight after a release is not ended by the old release', on());
    fire(G, 'pointerup', { button: 1, buttons: 0 }); run();
    T('a window open at load is listened on', w.domEvents.some(d => d.el === floating && d.t === 'pointerdown'));
    fire(floating, 'pointerdown', { button: 1, buttons: 4 });
    T('and has the class of its own', floating.on() && !on());
    const late = fakeWin(); opened({}, late); opened({}, late);
    T('a window opened later is listened on, once', w.domEvents.filter(d => d.el === late && d.t === 'pointerdown').length === 1);
    fire(late, 'pointerdown', { button: 2, buttons: 2 }); fire(G, 'pointerdown', { button: 2, buttons: 2 });
    late.closed = true;
    await w.app.plugins.disablePlugin(ID);
    T('the plugin going takes the class off every window', !on() && !floating.on() && !late.on());
    T('and its listeners with it', !w.domEvents.length, String(w.domEvents.length));
  }
  //RELOAD
} catch (err) { out.push('FAIL threw :: ' + err.stack); }
console.log('RESULTS\n' + out.join('\n')); })();
