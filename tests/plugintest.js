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
    registerEvent() { } registerDomEvent() { } registerView(t, f) { this.factory = f; } addRibbonIcon() { } addCommand(c) { (this.commands = this.commands || {})[c.id] = c; } addSettingTab(t) { this.tab = t; }
    async loadData() { return w.files.has(DIR + '/data.json') ? JSON.parse(w.files.get(DIR + '/data.json')) : null; }
    async saveData(d) { w.dataWrites++; w.put(DIR + '/data.json', JSON.stringify(d)); }
    unload() { this.onunload(); for (const i of this.mine) w.intervals.delete(i); }
  }
  class ItemView { constructor() { } load() { throw new Error('a view does not override load: it is Obsidian\'s'); } } class Modal { } class Component { } class TFile { } class TFolder { } class PluginSettingTab { } class Setting { }
  class Notice { constructor(t) { w.notices.push(t); } }
  const Platform = { isMobile: !!mobile, isDesktopApp: !!desktop, isTablet: false, isPhone: !!mobile };
  w.Platform = Platform;
  const obsidian = { Plugin, PluginSettingTab, Setting, ItemView, Modal, Component, TFile, TFolder, Notice, Platform, MarkdownRenderer: {}, getLinkpath: p => p, normalizePath: p => p.replace(/\/+/g, '/') };
  const body = { hasClass: c => w.classes.has(c), addClass: c => { w.classes.add(c); w.classLog.push('+' + c); }, removeClass: c => { w.classes.delete(c); w.classLog.push('-' + c); }, toggleClass: (c, on) => { if (on) body.addClass(c); else body.removeClass(c); } };
  const G = { setInterval: f => ({ f }), setTimeout: () => 0, addEventListener() { }, removeEventListener() { }, matchMedia: () => ({ matches: false }), dispatchEvent() { } };
  const app = {
    loadLocalStorage: k => (k in w.dev ? JSON.parse(w.dev[k]) : null), saveLocalStorage: (k, v) => { w.dev[k] = JSON.stringify(v); },
    vault: { adapter, configDir: '.obsidian', on() { } },
    workspace: { onLayoutReady(f) { f(); }, on() { }, trigger() { }, getLeavesOfType: () => w.leaves.map(v => ({ view: v })) }
  };
  const load = (code) => {
    const m = { exports: {} };
    new Function('require', 'module', 'exports', 'window', 'document', 'localStorage', 'MutationObserver', 'Event', 'getComputedStyle', code)(
      n => n === 'obsidian' ? obsidian : require(n), m, m.exports, G, { body }, { getItem: k => (w.store && k in w.store ? w.store[k] : null), setItem(k, v) { if (w.store) w.store[k] = String(v); } },
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
  // the tablet layout, on a phone
  {
    const w = world(true, false), M = DIR + '/main.js';
    await w.start(); const first = w.current();
    T('the tablet layout is held', w.Platform.isTablet && w.classes.has('is-tablet') && !w.classes.has('is-phone') && w.watchers.length === 1, '');
    w.classLog.length = 0; w.put(M, main0 + '\n// new'); await w.check(); await w.check();
    T('a reload does not flash the phone layout', w.calls.join() === 'disable,manifests,enable' && !w.classLog.includes('+is-phone') && w.Platform.isTablet && !w.Platform.isPhone, w.classLog.join());
    T('the old watcher is gone and the new one holds', !w.watchers[0].on && w.watchers.length === 2 && w.watchers[1].on, w.watchers.map(x => x.on).join());
    // turned off by hand the phone layout comes back
    await w.app.plugins.disablePlugin(ID);
    T('turned off by hand the screen gets its own layout back', w.classes.has('is-phone') && !w.Platform.isTablet, [...w.classes].join());
    // a new version that does not load: not stuck in the tablet layout, and it says what to do
    const x = world(true, false); await x.start();
    x.enableFails = true; x.put(M, main0 + '\n// new'); await x.check(); await x.check();
    T('a new version that does not load says so and lets go of the layout', x.notices.some(n => /Restart Obsidian once/.test(n)) && x.classes.has('is-phone'), JSON.stringify(x.notices));
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
  // the wheel keeps its place on each device through a restart, alone in the left sidebar
  {
    const VW = 'vaultwheel-view';
    const wheelIn = async (mobile, place, first, opts = {}) => {
      const w = world(!!mobile, !mobile, opts.fresh); w.store = place ? { 'vaultwheel-place': place, 'vaultwheel-place-2': '1' } : {};
      if (opts.data) w.put(DIR + '/data.json', opts.data);
      if (opts.boards) w.put(DIR + '/boards.json', '{}');
      if (opts.oldNone) delete w.store['vaultwheel-place-2'];
      if (opts.store) Object.assign(w.store, opts.store);
      const left = { n: 'left', size: opts.size || 300, collapsed: !!opts.collapsed, setSize(s) { this.size = s; log.push('size ' + s); }, expand() { this.collapsed = false; log.push('expand left'); } };
      const right = { n: 'right', collapsed: !!opts.rightShut, expand() { this.collapsed = false; log.push('expand right'); } }, main = { n: 'main' }, log = [], leaves = [];
      const roots = { left, right, main };
      const leaf = (r, type, state) => {
        const l = { root: r, type, state, getRoot: () => r, parent: { selectTab() { log.push('shown ' + r.n); } }, getViewState: () => ({ type: l.type, state: l.state }),
          view: { getViewType: () => l.type, frame: {} },
          setViewState: async s => { if (s.type === 'bad' || (s.type === 'all-properties' && opts.propsFail) || (s.type === VW && opts.wheelFails)) { if (s.type === VW) l.view.frame = null; l.type = 'empty'; return; } log.push('made ' + r.n + ' ' + s.type); l.type = s.type; l.state = s.state; },
          detach() { log.push('gone ' + r.n + ' ' + l.type); leaves.splice(leaves.indexOf(l), 1); } };
        return l;
      };
      for (const f of [].concat(first || [])) { const [r, type, state] = f.split(':'); leaves.push(leaf(roots[r], type === undefined ? VW : type, state)); }
      const make = r => () => { const l = leaf(r, 'empty'); leaves.push(l); return l; };
      const on = {};
      // the stacked groups: each leaf is its own group here, and a split makes a new one above
      if (opts.stack) {
        left.children = leaves.filter(l => l.root === left).map(l => l.parent);
        w.app.workspace.createLeafBySplit = (at, dir, before) => { log.push('split ' + dir + ' ' + before); const l = leaf(left, 'empty'); l.parent.setDimension = d => log.push('height ' + d); leaves.push(l); left.children.unshift(l.parent); return l; };
      }
      Object.assign(w.app.workspace, { leftSplit: left, rightSplit: right, getLeftLeaf: make(left), getRightLeaf: make(right), getLeaf: () => make(main)(), getLeavesOfType: t => leaves.filter(l => l.type === t), iterateAllLeaves: f => [...leaves].forEach(f), revealLeaf: async () => log.push('revealed'), on: (e, f) => { on[e] = f; } });
      await w.start(); await new Promise(r => setTimeout(r, 5));
      const types = r => leaves.filter(l => l.root === roots[r]).map(l => l.type + (l.state ? ':' + l.state : '')).join();
      return { log, w, leaves, left, right, types, make, leaf, roots, fire: async () => { on['layout-change'](); await new Promise(r => setTimeout(r, 5)); }, quit: () => on.quit(), settle: () => w.current().settle(), plugin: w.current() };
    };
    let r = await wheelIn(false, 'left');
    T('desktop: a wheel kept in the left sidebar comes back there after a restart that lost it', r.log.join() === 'made left ' + VW + ',shown left', r.log.join());
    r = await wheelIn(false, 'right');
    T('desktop: the right one too', r.log.join() === 'made right ' + VW + ',shown right', r.log.join());
    r = await wheelIn(false, 'left', 'left');
    T('desktop: already there and alone, nothing moves', r.log.join() === 'shown left', r.log.join());
    r = await wheelIn(false, 'left', 'main');
    T('desktop: one in the main area moves over, and is closed only after the new one has loaded', r.log.join() === 'made left ' + VW + ',gone main ' + VW + ',shown left', r.log.join());
    r = await wheelIn(false, 'left', 'main', { wheelFails: true });
    T('desktop: the new wheel failing leaves the old one where it is', r.types('main') === VW && !r.log.some(x => x.startsWith('gone main')) && r.w.notices.length === 1, r.log.join() + ' / ' + r.w.notices.join());
    r = await wheelIn(false, null);
    T('desktop: never placed, nothing opens by itself', !r.log.length, r.log.join());
    r = await wheelIn(false, 'none');
    T('desktop: closed stays closed', !r.log.length, r.log.join());
    r = await wheelIn(true, null);
    T('mobile: starts in the left sidebar', r.log.join() === 'made left ' + VW + ',shown left', r.log.join());
    r = await wheelIn(true, 'none');
    T('mobile: closed stays closed', !r.log.length, r.log.join());
    r = await wheelIn(false, 'none', null, { oldNone: true });
    T('a none written by the old build is not believed, once', r.types('left') === VW && r.plugin.stored() === 'left', JSON.stringify(r.w.dev));
    r = await wheelIn(false, 'none', null);
    T('a none written since is', !r.leaves.length, r.log.join());
    // alone in the left sidebar
    r = await wheelIn(false, 'left', ['left', 'left:file-explorer:a', 'left:search:q', 'right:outline']);
    T('everything else on the left goes right, with its state', r.types('left') === VW && r.types('right') === 'outline,file-explorer:a,search:q', r.types('left') + ' / ' + r.types('right'));
    T('each is closed only after its copy is open', r.log.indexOf('made right file-explorer') < r.log.indexOf('gone left file-explorer'), r.log.join());
    r = await wheelIn(false, 'left', ['left', 'left:bad:x', 'left:tag:t']);
    T('one that will not move stays, and the rest still go', r.types('left') === VW + ',bad:x' && r.types('right') === 'tag:t', r.types('left') + ' / ' + r.types('right'));
    r.log.length = 0; r.settle(); await new Promise(res => setTimeout(res, 5));
    T('and it is not tried again every time the layout changes', !r.log.length, r.log.join());
    r = await wheelIn(false, 'left', ['left', 'left:empty', 'left:tag:t', 'right:tag:t']);
    T('an empty tab and an exact double just close', r.types('left') === VW && r.types('right') === 'tag:t', r.types('left') + ' / ' + r.types('right'));
    r = await wheelIn(true, 'left', ['left', 'left:file-explorer:a']);
    T('on mobile too', r.types('left') === VW && r.types('right') === 'file-explorer:a', r.types('left') + ' / ' + r.types('right'));
    r = await wheelIn(false, 'left', ['left', 'left:tag:t'], { rightShut: true });
    T('the first time tabs move, a closed right sidebar opens to show them', r.log.includes('expand right'), r.log.join());
    r = await wheelIn(false, 'left', ['left', 'left:tag:t'], { rightShut: true, store: { 'vaultwheel-moved': '1' } });
    T('after that a startup leaves it closed', !r.log.includes('expand right'), r.log.join());
    // the properties panel stays on the left, in its own group above the wheel
    const PR = 'all-properties', stack = o => Object.assign({ stack: true }, o);
    r = await wheelIn(false, 'left', ['left', 'right:' + PR + ':s'], stack());
    T('properties sent right by the last build comes back with its state', r.types('left') === VW + ',' + PR + ':s' && r.types('right') === '', r.types('left') + ' / ' + r.types('right'));
    T('in a group above the wheel, at its height, closed there only once it is open here', r.log.indexOf('split horizontal true') >= 0 && r.log.includes('height 27') && r.log.indexOf('made left ' + PR) < r.log.indexOf('gone right ' + PR), r.log.join());
    r = await wheelIn(false, 'left', ['left:' + PR + ':s', 'left', 'left:tag:t'], stack());
    T('already above the wheel it stays as it is, and only the rest go right', !r.log.some(x => /split|height|gone left all/.test(x)) && r.types('left') === PR + ':s,' + VW && r.types('right') === 'tag:t', r.log.join());
    r = await wheelIn(false, 'left', ['left', 'left:' + PR + ':s'], stack());
    T('below the wheel it moves above', r.log.includes('split horizontal true') && r.types('left') === VW + ',' + PR + ':s', r.log.join());
    r = await wheelIn(false, 'left', ['left'], stack());
    T('closed everywhere it opens again', r.leaves.some(l => l.type === PR && l.root === r.left), r.types('left'));
    r = await wheelIn(false, 'left', ['left', 'right:' + PR + ':s'], stack({ propsFail: true }));
    T('one that will not open here stays where it was', r.types('right') === PR + ':s' && r.types('left') === VW, r.types('left') + ' / ' + r.types('right'));
    r = await wheelIn(true, 'left', ['left', 'left:' + PR + ':s', 'left:tag:t'], stack());
    T('a mobile drawer has no stacked groups: it stays a tab there', !r.log.some(x => /split/.test(x)) && r.types('left') === VW + ',' + PR + ':s' && r.types('right') === 'tag:t', r.log.join());
    r = await wheelIn(false, null); await r.plugin.toSidebar('left', true);
    T('asked for: open and with room', r.left.size === 300 && r.log.includes('revealed'), r.log.join());
    r = await wheelIn(false, null, null, { size: 120, collapsed: true }); await r.plugin.toSidebar('left', true);
    T('a thin or closed sidebar is opened to a usable width', r.log.includes('expand left') && r.left.size === 380, r.log.join());
    r = await wheelIn(false, 'left', 'left', { collapsed: true });
    T('one you collapsed yourself stays collapsed at startup', !r.log.includes('expand left') && r.left.collapsed, r.log.join());
    r = await wheelIn(false, 'left', null, { store: { 'vaultwheel-left-width': '520' } });
    T('a layout that lost the wheel gets its width back', r.left.size === 520, r.log.join());
    // what is remembered, and when
    r = await wheelIn(false, null, 'right'); await r.fire();
    T('nothing is written while starting up', r.plugin.stored() === 'main', JSON.stringify(r.w.dev));
    r.settle(); await r.fire();
    T('moving it is remembered', r.plugin.stored() === 'right', JSON.stringify(r.w.dev));
    r.leaves.push(r.leaf(r.roots.main, 'markdown')); await r.fire(); r.leaves.splice(0, 1); await r.fire();
    T('closing it is remembered', r.plugin.stored() === 'none', JSON.stringify(r.w.dev));
    r = await wheelIn(false, 'left', ['left', 'main:markdown']); r.leaves.splice(0, 1); await r.fire();
    T('a wheel gone during startup is not a close', r.plugin.stored() === 'left', JSON.stringify(r.w.dev));
    r = await wheelIn(false, 'left', ['left', 'main:markdown']); r.settle(); r.quit(); r.leaves.splice(0, 1); await r.fire();
    T('a wheel gone while quitting is not a close', r.plugin.stored() === 'left', JSON.stringify(r.w.dev));
    r = await wheelIn(false, 'left', ['left', 'main:markdown']); r.settle(); r.leaves.length = 0; r.leaves.push(r.leaf(r.roots.main, 'graph')); r.log.length = 0; await r.fire();
    T('a whole new layout coming in (a saved workspace) is not a close, and the wheel goes back', r.plugin.stored() === 'left' && r.types('left') === VW, JSON.stringify(r.w.dev) + ' ' + r.log.join());
    r = await wheelIn(false, 'left', ['left', 'main:markdown']); r.settle(); r.leaves.push(r.leaf(r.left, 'tag', 't')); await r.fire();
    T('a tab added on the left while running moves over too', r.types('left') === VW && r.types('right') === 'tag:t', r.types('left') + ' / ' + r.types('right'));
    // the undo
    r = await wheelIn(false, 'left', ['left', 'left:tag:t']); r.log.length = 0; await r.plugin.giveLeftBack();
    T('giving the left sidebar back: the wheel is a main tab, opened before the old one closes, and the moved tabs stay', r.types('main') === VW && r.types('left') === '' && r.types('right') === 'tag:t' && r.log.indexOf('made main ' + VW) < r.log.indexOf('gone left ' + VW) && r.plugin.stored() === 'main', r.log.join());
    r = await wheelIn(false, 'main', ['main']); r.settle(); await r.fire();
    T('a wheel in the main area is left alone', r.types('main') === VW && !r.log.length, r.log.join());
    // an old install: the wheel's ways it always had, with a data.json or a key as the sign
    const drag = (x, root) => { x.leaves[x.leaves.findIndex(l => l.type === VW)] = x.leaf(root, VW); };
    r = await wheelIn(false, null, 'main'); r.settle(); drag(r, r.left); r.leaves.push(r.leaf(r.left, 'tag', 't')); await r.fire();
    T('old install: a wheel dragged to the left sidebar still clears it', r.types('right') === 'tag:t' && r.plugin.stored() === 'left', r.types('right'));
    r = await wheelIn(false, 'left', 'left', { store: { 'vaultwheel-tablet-layout': 'off', 'vaultwheel-moved': '1', 'vaultwheel-left-width': '444' } });
    { const d = r.plugin.device; T('old install: every key carries over', d.home === 'left' && d.props === true && d.tablet === false && d.moved === true && d.leftWidth === 444 && d.legacy === true, JSON.stringify(d)); }
    r = await wheelIn(true, 'left', 'left');
    T('old install: hover, reload and sound on, tablet layout on a phone', r.plugin.settings.hover && r.plugin.settings.reload && r.plugin.settings.sound && r.plugin.device.tablet && r.w.Platform.isTablet, JSON.stringify(r.plugin.settings));
    T('old install: nothing is written at the start, so devices do not make sync conflicts', r.w.dataWrites === 0, String(r.w.dataWrites));
    r.w.store['vaultwheel-place'] = 'right'; await r.w.app.plugins.disablePlugin(ID); await r.w.app.plugins.enablePlugin(ID);
    T('old install: carried over once, the old keys are not read again', r.w.current().device.home === 'left', JSON.stringify(r.w.current().device));
    // a new install
    const freshIn = async (mobile, first, opts = {}) => {
      const x = await wheelIn(mobile, null, first, Object.assign({ fresh: true }, opts)); return x;
    };
    r = await freshIn(false, ['left:file-explorer:a', 'left:' + PR + ':s', 'right:outline']);
    r.settle(); await r.fire();
    T('new install: nothing moves and nothing opens', !r.log.length && r.types('left') === 'file-explorer:a,' + PR + ':s' && r.types('right') === 'outline', r.log.join());
    { const d = r.plugin.device; T('new install: a tab, nothing held, hover on and the rest off', d.home === 'tab' && !d.legacy && !d.tablet && r.plugin.settings.hover && !r.plugin.settings.reload && !r.plugin.settings.sound, JSON.stringify(d)); }
    T('new install: none of the old keys are written', !Object.keys(r.w.store).length, JSON.stringify(r.w.store));
    T('new install: data.json says it is past the old ways', JSON.parse(r.w.files.get(DIR + '/data.json')).settings.reload === false, r.w.files.get(DIR + '/data.json'));
    r.log.length = 0; await r.plugin.open();
    T('new install: it opens in a tab', r.types('main') === VW && r.types('left') === 'file-explorer:a,' + PR + ':s' && r.w.notices.length === 0, r.types('main') + ' / ' + r.w.notices.join());
    drag(r, r.left); await r.fire();
    T('new install: dragged to the left sidebar it stays a tab among the others', r.types('left').includes(VW) && r.types('left').includes('file-explorer:a') && r.types('right') === 'outline' && r.plugin.stored() === 'main', r.types('left') + ' / ' + r.types('right'));
    r = await freshIn(true, ['left:file-explorer:a']);
    T('new install on a phone: Obsidian\'s layout is left alone', !r.w.Platform.isTablet && r.w.classes.has('is-phone') && !r.w.watchers.length, [...r.w.classes].join());
    await r.plugin.open();
    T('new install on a phone: a tab too, the drawer untouched', r.types('main') === VW && r.types('left') === 'file-explorer:a', r.types('left'));
    // the same vault synced to a second device: its data.json is no sign of an old install
    r = await wheelIn(true, null, ['left:file-explorer:a'], { fresh: true, data: '{"dirs":{},"settings":{"hover":true,"reload":false}}' });
    T('a second device of a new install starts new, and takes the synced settings', r.plugin.device.home === 'tab' && !r.plugin.device.legacy && r.plugin.settings.hover === true && r.types('left') === 'file-explorer:a' && !r.w.Platform.isTablet, JSON.stringify(r.plugin.device));
    T('and has no reason to write them', r.w.dataWrites === 0, String(r.w.dataWrites));
    r = await wheelIn(false, null, null, { fresh: true, data: null, boards: true });
    T('boards.json alone is an old install', r.plugin.device.legacy === true && r.plugin.settings.reload === true, JSON.stringify(r.plugin.device));
    // the setting
    r = await freshIn(false, ['left:file-explorer:a', 'left:search:q', 'main:markdown:n']); r.settle();
    await r.plugin.chooseHome('left');
    T('left sidebar, alone: the wheel is there and the rest went right', r.types('left') === VW && r.types('right') === 'file-explorer:a,search:q' && r.w.notices.length === 1, r.types('left') + ' / ' + r.types('right'));
    await r.plugin.chooseHome('tab');
    T('a tab: the wheel goes back to the main area and the tabs go home', r.types('main') === 'markdown:n,' + VW && r.types('left') === 'file-explorer:a,search:q' && r.types('right') === '', r.types('main') + ' / ' + r.types('left') + ' / ' + r.types('right'));
    r = await freshIn(false, ['left:' + PR + ':s', 'left:tag:t'], { stack: true }); r.settle();
    await r.plugin.chooseHome('left-props');
    T('left sidebar, under Properties: properties stay above it', r.types('left').includes(PR) && r.types('left').includes(VW) && r.types('right') === 'tag:t', r.types('left') + ' / ' + r.types('right'));
    await r.plugin.chooseHome('left');
    T('alone after that: properties go right too', !r.types('left').includes(PR) && r.types('right').includes(PR), r.types('left') + ' / ' + r.types('right'));
    await r.plugin.chooseHome('tab');
    T('and back in a tab they are where they were, on the left', r.types('left').includes(PR) && r.types('left').includes('tag:t') && r.types('right') === '', r.types('left') + ' / ' + r.types('right'));
    r = await freshIn(false, ['right:' + PR + ':s', 'left:tag:t'], { stack: true, rightShut: true }); r.settle();
    r.w.app.workspace.rightSplit.collapse = () => { r.right.collapsed = true; r.log.push('collapse right'); };
    await r.plugin.chooseHome('left-props');
    T('under Properties: a panel from the right comes over, and the right sidebar opens to show the tabs', r.types('left').includes(PR) && r.types('right') === 'tag:t' && !r.right.collapsed, r.types('left') + ' / ' + r.types('right'));
    await r.plugin.chooseHome('tab');
    T('back in a tab: the panel is on the right again, the tabs on the left, the right sidebar closed again', r.types('right') === PR + ':s' && r.types('left') === 'tag:t' && r.right.collapsed, r.types('left') + ' / ' + r.types('right'));
    r = await freshIn(false, ['main:markdown:n'], { stack: true }); r.settle();
    await r.plugin.chooseHome('left-props');
    T('under Properties with no panel anywhere: one is made', r.types('left').includes(PR), r.types('left'));
    await r.plugin.chooseHome('tab');
    T('back in a tab that one goes again', !r.leaves.some(l => l.type === PR), r.types('left'));
    r = await freshIn(false, ['left:tag:t']); r.settle();
    await r.plugin.chooseHome('right');
    T('right sidebar: the left one is not touched', r.types('right') === VW && r.types('left') === 'tag:t', r.types('left') + ' / ' + r.types('right'));
    drag(r, r.left); await r.fire();
    T('dragged from there to the left: nothing moves and the plugin lets go', r.types('left').includes('tag:t') && r.types('left').includes(VW) && r.plugin.stored() === 'main', r.types('left'));
    r = await freshIn(false, []); r.settle(); await r.plugin.chooseHome('tab');
    T('a tab with no wheel open opens nothing', !r.leaves.length, r.log.join());
    r = await freshIn(false, ['main:markdown:n']); r.settle(); await r.plugin.chooseHome('left'); r.log.length = 0;
    r.leaves.splice(r.leaves.findIndex(l => l.type === VW), 1); await r.fire();
    T('a sidebar wheel you close stays closed', r.plugin.stored() === 'none' && !r.types('left').includes(VW), r.plugin.stored());
    await r.plugin.open();
    T('and comes back there when you ask', r.types('left') === VW && r.plugin.stored() === 'left', r.types('left'));
    // the page and the plugin's settings share data.json
    r = await freshIn(false, []); const p = r.plugin, say = m => new Promise(res => p.handle(Object.assign({ vw: 1, id: 1 }, m), { postMessage: res }));
    await p.saveSetting('hover', true);
    let got = await say({ t: 'prefs' });
    T('the page does not see the plugin\'s settings', !('settings' in got.prefs), JSON.stringify(got));
    // the files beside the page (the owner's own build): only those two names, nothing else in the folder
    r.w.put(DIR + '/vaultwheel-gifs.json', '[1]');
    got = await say({ t: 'pack', name: 'gifs' }); T('a file beside the page is read for it', got.ok && got.text === '[1]', JSON.stringify(got));
    got = await say({ t: 'pack', name: 'vendor' }); T('one that is not there says so', got.ok === false && !!got.err, JSON.stringify(got));
    got = await say({ t: 'pack', name: '../data' }); T('and no other name is taken', got.ok === false, JSON.stringify(got));
    await say({ t: 'savePrefs', prefs: { dirs: { a: { u: 1 } } } });
    let disk = JSON.parse(r.w.files.get(DIR + '/data.json'));
    T('and a save of the page\'s keeps them', disk.settings.hover === true && disk.dirs.a.u === 1, JSON.stringify(disk));
    await say({ t: 'savePrefs', prefs: { dirs: {}, settings: { hover: false, reload: true } } });
    disk = JSON.parse(r.w.files.get(DIR + '/data.json'));
    T('even one that carries an old copy of them', disk.settings.hover === true && disk.settings.reload === false, JSON.stringify(disk));
    const both = [say({ t: 'savePrefs', prefs: { dirs: { b: { u: 2 } } } }), p.saveSetting('hover', false)]; await Promise.all(both);
    disk = JSON.parse(r.w.files.get(DIR + '/data.json'));
    T('two writes at once lose neither', disk.settings.hover === false && disk.dirs.b.u === 2, JSON.stringify(disk));
    r.w.put(DIR + '/data.json', JSON.stringify({ dirs: {}, settings: { hover: true, reload: false } })); await p.onExternalSettingsChange();
    T('a change from a sync is taken', p.settings.hover === true, JSON.stringify(p.settings));
    // with reload off nothing looks at the plugin's files
    r = await freshIn(false, []); r.w.put(DIR + '/main.js', main0 + '\n// new'); r.w.calls.length = 0;
    for (let n = 0; n < 3; n++) { for (const i of r.w.intervals) await i.f(); await tick(); }
    T('reload off: the timer is there but a new main.js is not looked at', !r.w.calls.length && r.w.intervals.size >= 1 && !r.plugin.mainSum, r.w.calls.join());
    await r.plugin.saveSetting('reload', true); await tick();
    for (let n = 0; n < 3; n++) { for (const i of r.w.intervals) await i.f(); await tick(); }
    T('turned on: what changed before it does not count', !r.w.calls.length, r.w.calls.join());
    r.w.put(DIR + '/main.js', main0 + '\n// newer');
    for (let n = 0; n < 3; n++) { for (const i of r.w.current().mine) await i.f(); await tick(); }
    T('and what changes after it loads', r.w.calls.join() === 'disable,manifests,enable', r.w.calls.join());
    // the small inflate
    {
      const zlib = require('zlib'), m = { exports: {} }, big = [];
      for (let i = 0; i < 30000; i++) big.push('line ' + (i * 7919 % 977) + ' of the page, é ☃\n');
      const text = Buffer.from(big.join('')), rnd = require('crypto').randomBytes(70000);
      const w0 = world(false, true);
      new Function('require', 'module', 'exports', main0 + '\nmodule.exports.gunzip = gunzip;')(n => n === 'obsidian' ? w0.obsidian : require(n), m, m.exports);
      const same = (a, b) => Buffer.compare(Buffer.from(a), b) === 0;
      T('inflate: dynamic blocks', same(m.exports.gunzip(zlib.gzipSync(text, { level: 9 })), text));
      T('inflate: stored blocks', same(m.exports.gunzip(zlib.gzipSync(text, { level: 0 })), text));
      T('inflate: fixed blocks', same(m.exports.gunzip(zlib.gzipSync(text, { strategy: zlib.constants.Z_FIXED })), text));
      T('inflate: bytes that do not compress', same(m.exports.gunzip(zlib.gzipSync(rnd, { level: 9 })), rnd));
      const named = Buffer.concat([Buffer.from([0x1f, 0x8b, 8, 8 | 4 | 16, 0, 0, 0, 0, 0, 3, 2, 0, 65, 66, 97, 0, 99, 0]), zlib.gzipSync(text).subarray(10)]);
      T('inflate: a header with the extra fields', same(m.exports.gunzip(named), text));
    }
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
  //RELOAD
} catch (err) { out.push('FAIL threw :: ' + err.stack); }
console.log('RESULTS\n' + out.join('\n')); })();
