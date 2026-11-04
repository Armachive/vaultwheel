// the card menu in Obsidian (the plugin is faked here, run on a bridge build): a cut pasted asks for the batch move, a no
// leaves it cut, a copy pasted asks for a duplicate with the folder it goes to, an older plugin's copy lands where it
// really went, and copy path and open with use what the plugin says about the desktop
(function(){
  const reqs = [], now = Math.floor(Date.now() / 1000); let say = {}, busy = false;
  const tree = { n: 'Vault', f: 0, m: now, t: {}, c: [{ n: 'A', f: 2, m: now, t: { md: 2 }, c: [] }, { n: 'B', f: 0, m: now - 9, t: {}, c: [] }] };
  window.parent = { postMessage(m) {
    if (m && m.vw && m.t === 'busy') busy = m.v;
    if (!m || !m.vw || m.id == null) return;
    const reply = d => setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: Object.assign({ vw: 1, id: m.id }, d) })), 20);
    reqs.push(m);
    if (m.t === 'tree') return reply({ root: 'Vault', tree, desktop: { base: 'C:\\Vaults\\V', os: 'win32' } });
    if (m.t === 'files') return reply({ files: m.p === 'A' ? [['one.md', 2048, now], ['two.md', 10, now - 5]] : [] });
    if (m.t === 'prefs') return reply({ prefs: {} });
    if (m.t === 'moveMany' && say.hold) { const go = reply; say.held = () => go({ results: m.from.map(p => ({ p, ok: true, newPath: (m.to ? m.to + '/' : '') + p.split('/').pop() })) }); return; }
    if (m.t === 'moveMany') return reply(say.cancel ? { cancelled: true, results: m.from.map(p => ({ p, ok: false, err: 'cancelled' })) } : { results: m.from.map(p => ({ p, ok: true, newPath: (m.to ? m.to + '/' : '') + p.split('/').pop() })) });
    if (m.t === 'duplicate' && say.holdCopy) { const n = m.p.split('/').pop(), go = reply; say.copied = () => go({ ok: true, newPath: (m.to ? m.to + '/' : '') + n, name: n }); return; }
    if (m.t === 'duplicate') { const n = m.p.split('/').pop(); return reply(say.old ? { ok: true, newPath: 'A/one copy.md', name: 'one copy.md' } : { ok: true, newPath: (m.to ? m.to + '/' : '') + n, name: n }); }
    if (m.t === 'openWith') return reply(say.openErr ? { ok: false, err: 'no chooser' } : { ok: true });
    reply({ ok: true });
  } };
  let copied = null;
  try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { copied = t; return Promise.resolve(); } } }); } catch (e) { }
  (async function(){
    const sl = ms => new Promise(r => setTimeout(r, ms)); const out = []; const T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
    try {
    const $ = s => document.querySelector(s), stage = $('#stage'), menu = $('#cardMenu');
    const key = (k, o = {}) => window.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o)));
    const toast = () => { const t = $('#toast'); return t.hidden ? '' : t.textContent; };
    const rclick = (level, name) => { const p = VW.screenOf(level, name); stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: p.x, clientY: p.y, button: 2, pointerId: 7, pointerType: 'mouse' })); stage.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, button: 2 })); };
    const go = async n => { VW.up(); VW.snap(); await sl(500); VW.enter(n); VW.snap(); await sl(600); VW.snap(); await sl(200); };
    for (let i = 0; i < 60 && (typeof VW === 'undefined' || !VW.items(0).length); i++) await sl(250);
    VW.enter('A'); VW.snap(); await sl(800); VW.snap(); await sl(300);
    const f = VW.state().focus;
    rclick(0, f); await sl(150);
    let m = VW.cardMenu();
    T('the menu opens for the card', m.open && m.name === f, JSON.stringify(m.name));
    T('open with shows on desktop', !m.buttons.find(b => b.m === 'openWith').hidden);
    menu.querySelector('[data-m=path]').click(); await sl(100);
    T('copy path gives the path on disk', copied === 'C:\\Vaults\\V\\A\\' + f, copied);
    rclick(0, f); await sl(100); menu.querySelector('[data-m=link]').click(); await sl(100);
    T('link gives the obsidian link', copied === 'obsidian://open?vault=Vault&file=' + encodeURIComponent('A/' + f), copied);
    rclick(0, f); await sl(100); menu.querySelector('[data-m=openWith]').click(); await sl(150);
    const ow = reqs.filter(r => r.t === 'openWith');
    T('open with asks the plugin for that file', ow.length === 1 && ow[0].p === 'A/' + f, JSON.stringify(ow.map(r => r.p)));
    say.openErr = true; rclick(0, f); await sl(100); menu.querySelector('[data-m=openWith]').click(); await sl(150); say.openErr = false;
    T('a failed open with says why', /no chooser/.test(toast()), toast());
    // cut, a no in Obsidian
    key('x', { ctrlKey: true }); await sl(100); await go('B');
    say.cancel = true; key('v', { ctrlKey: true }); await sl(300); say.cancel = false;
    let mv = reqs.filter(r => r.t === 'moveMany');
    T('a cut pasted asks for the batch move, into the folder you are in', mv.length === 1 && mv[0].from[0] === 'A/' + f && mv[0].to === 'B', JSON.stringify(mv.map(r => [r.from, r.to])));
    T('a no in Obsidian changes nothing and it stays cut', !VW.items(0).includes(f) && VW.clip() && VW.clip().cut, JSON.stringify(VW.items(0)));
    key('v', { ctrlKey: true }); await sl(300);
    T('a yes moves it', VW.items(0).includes(f) && !VW.clip(), JSON.stringify(VW.items(0)));
    key('z', { ctrlKey: true }); await sl(300);
    mv = reqs.filter(r => r.t === 'moveMany');
    T('the undo moves it back without asking', mv[mv.length - 1].quiet === true && mv[mv.length - 1].to === 'A' && !VW.items(0).includes(f), JSON.stringify(mv[mv.length - 1]));
    // copy
    await go('A');
    key('c', { ctrlKey: true }); await sl(100); await go('B');
    key('v', { ctrlKey: true }); await sl(300);
    const du = reqs.filter(r => r.t === 'duplicate');
    T('a copy pasted asks for a duplicate with the folder', du.length === 1 && du[0].p === 'A/' + f && du[0].to === 'B', JSON.stringify(du.map(r => [r.p, r.to])));
    T('it lands here', VW.items(0).includes(f), JSON.stringify(VW.items(0)));
    // a duplicate in the vault's top folder names it by an empty path, which still counts as a folder
    VW.up(); VW.snap(); await sl(500); key('v', { ctrlKey: true }); await sl(300);
    const du2 = reqs.filter(r => r.t === 'duplicate');
    T('a paste at the top of the vault says so', du2.length === 2 && du2[1].to === '', JSON.stringify(du2[1] && du2[1].to));
    // an older plugin copies next to the original whatever it is asked
    await go('B'); say.old = true; key('v', { ctrlKey: true }); await sl(300); say.old = false;
    T('an older plugin\'s copy is shown where it really went', !VW.items(0).includes('one copy.md'), JSON.stringify(VW.items(0)));
    await go('A');
    T('so it is here', VW.items(0).includes('one copy.md'), JSON.stringify(VW.items(0)));
    // a set: two cards cut, the indicator's Paste, one question and one undo
    const bar = $('#clipBar'), nm = () => bar.querySelector('.name').textContent;
    const pair = ['one copy.md', 'two.md'];
    const on = async n => { VW.spinTo(VW.items(0).indexOf(n)); await sl(400); VW.snap(); await sl(150); };
    await on(pair[0]); key('x', { ctrlKey: true }); await on(pair[1]); key('x', { ctrlKey: true }); await sl(150);
    T('two cuts make a set on the indicator', !bar.hidden && nm() === '2 items', nm());
    T('Obsidian holds an update while something is cut', busy === true);
    await go('B'); const mb = reqs.filter(r => r.t === 'moveMany').length;
    say.cancel = true; $('#cbPaste').click(); await sl(300); say.cancel = false;
    T('a no in Obsidian leaves the whole set cut', nm() === '2 items' && !pair.some(n => VW.items(0).includes(n)), nm());
    $('#cbPaste').click(); await sl(300);
    let mm = reqs.filter(r => r.t === 'moveMany').slice(mb);
    T('a yes is one batch with both', mm.length === 2 && mm[1].from.length === 2 && mm[1].to === 'B' && pair.every(n => VW.items(0).includes(n)), JSON.stringify(mm));
    T('the set is done with', !VW.clip() && bar.hidden);
    key('z', { ctrlKey: true }); await sl(300);
    mm = reqs.filter(r => r.t === 'moveMany');
    T('one undo moves both back without asking', mm[mm.length - 1].quiet === true && mm[mm.length - 1].from.length === 2 && !pair.some(n => VW.items(0).includes(n)), JSON.stringify(mm[mm.length - 1]));
    // a copy set: a duplicate each, into the folder, the set stays
    await go('A'); await on(pair[0]); key('c', { ctrlKey: true }); await on(pair[1]); key('c', { ctrlKey: true }); await sl(100);
    await go('B'); const db = reqs.filter(r => r.t === 'duplicate').length; $('#cbPaste').click(); await sl(400);
    const dd = reqs.filter(r => r.t === 'duplicate').slice(db);
    T('a copy set asks for a duplicate of each, with the folder', dd.length === 2 && dd.every(r => r.to === 'B') && pair.every(n => VW.items(0).includes(n)), JSON.stringify(dd.map(r => [r.p, r.to])));
    T('and stays on the indicator', !bar.hidden && nm() === '2 items');
    // a card that goes in Obsidian leaves the set quietly
    VW.vaultChange({ kind: 'delete', p: 'A/' + pair[0], isDir: false }); await sl(800);
    T('deleted in Obsidian, it leaves the set', nm() === pair[1], nm());
    $('#cbCancel').click(); await sl(100); T('Cancel clears it', !VW.clip() && bar.hidden);
    key('x', { ctrlKey: true }); await sl(100); const held = busy; $('#cbCancel').click(); await sl(6500);
    T('a cut let go lets the update come (once the undo toast has gone too)', held === true && busy === false, JSON.stringify([held, busy]));
    // ctrl + Z does nothing while a paste waits on its question, and a second press does nothing while the first is at work
    await go('A'); const u1 = 'u1.md', u2 = 'u2.md';
    for (const n of [u1, u2]) VW.vaultChange({ kind: 'create', p: 'A/' + n, isDir: false, size: 5, m: now });
    await sl(800);
    await on(u1); key('x', { ctrlKey: true }); await sl(100); await go('B'); key('v', { ctrlKey: true }); await sl(300);
    await go('A'); await on(u2); key('x', { ctrlKey: true }); await sl(100); await go('B');
    say.hold = true; key('v', { ctrlKey: true }); await sl(200);
    const quiets = () => reqs.filter(r => r.t === 'moveMany' && r.quiet).length, q0 = quiets();
    key('z', { ctrlKey: true }); await sl(200);
    T('ctrl + Z during a paste starts nothing under it', quiets() === q0, String(quiets() - q0));
    say.held(); say.hold = false; await sl(300);
    T('the paste lands', VW.items(0).includes(u2) && VW.items(0).includes(u1), JSON.stringify(VW.items(0)));
    say.hold = true; key('z', { ctrlKey: true }); await sl(100); key('z', { ctrlKey: true }); await sl(150);
    T('a second ctrl + Z waits for the first', quiets() === q0 + 1, String(quiets() - q0));
    say.held(); say.hold = false; await sl(300);
    T('the first step is undone', !VW.items(0).includes(u2) && VW.items(0).includes(u1), JSON.stringify(VW.items(0)));
    key('z', { ctrlKey: true }); await sl(300);
    T('and the step before it is still there to undo', !VW.items(0).includes(u1) && quiets() === q0 + 2, JSON.stringify(VW.items(0)));
    // a step whose file was deleted in Obsidian is forgotten: a new file at that path is a stranger to it
    await go('A'); VW.vaultChange({ kind: 'create', p: 'A/s.md', isDir: false, size: 5, m: now }); await sl(800); await on('s.md');
    key('c', { ctrlKey: true }); await sl(100); await go('B'); key('v', { ctrlKey: true }); await sl(300); key('Escape'); await sl(50);
    T('the copy of s.md lands', VW.items(0).includes('s.md'), JSON.stringify(VW.items(0)));
    VW.vaultChange({ kind: 'delete', p: 'B/s.md', isDir: false }); await sl(800);
    VW.vaultChange({ kind: 'create', p: 'B/s.md', isDir: false, size: 9, m: now }); await sl(800);
    key('z', { ctrlKey: true }); await sl(300);
    const stranger = reqs.filter(r => r.t === 'trashMany' && r.paths.includes('B/s.md'));
    T('an undo does not ask to trash a stranger at the old path', !stranger.length && VW.items(0).includes('s.md'), JSON.stringify(stranger));
    // a copy that takes long is waited for: it goes on in Obsidian whether the page waits or not
    await go('A'); VW.vaultChange({ kind: 'create', p: 'A/long.md', isDir: false, size: 5, m: now }); await sl(800); await on('long.md');
    key('c', { ctrlKey: true }); await sl(100); await go('B'); const dup0 = reqs.filter(r => r.t === 'duplicate').length;
    say.holdCopy = true; key('v', { ctrlKey: true }); await sl(21000);
    T('after 21 s a long copy has not read as failed', !/Could not|no answer/.test(toast()), toast());
    key('v', { ctrlKey: true }); await sl(200);
    T('and a second paste does not start under it', reqs.filter(r => r.t === 'duplicate').length === dup0 + 1, String(reqs.filter(r => r.t === 'duplicate').length - dup0));
    say.copied(); say.holdCopy = false; await sl(300);
    T('it lands when it is done', VW.items(0).includes('long.md'), JSON.stringify(VW.items(0)));
    } catch (err) { out.push('FAIL threw :: ' + err.message + ' ' + (err.stack || '').split('\n')[1]); }
    console.log('RESULTS\n' + out.join('\n'));
  })();
})();
