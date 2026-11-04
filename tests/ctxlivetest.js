// the card menu on the site (the server is faked here, run on a live build): rename and trash are greyed and say why, open
// with is hidden, a cut pasted posts the move, a copy pasted posts /api/copy and takes the name the server gives, with no
// undo since the site cannot take a copy away, and a refused copy says why
(function(){
  const now = Math.floor(Date.now() / 1000), posts = []; let say = {};
  window.fetch = async (u, o) => {
    const url = new URL(u, location.href), p = url.searchParams.get('p');
    const json = (x, status) => new Response(JSON.stringify(x), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
    if (/\/api\/tree$/.test(url.pathname)) return json({ root: 'Vault', tree: { n: 'Vault', f: 0, m: now, t: {}, c: [{ n: 'A', f: 2, m: now, t: { md: 2 }, c: [] }, { n: 'B', f: 1, m: now - 9, t: { md: 1 }, c: [] }] } });
    if (/\/api\/files$/.test(url.pathname)) return json({ files: p === 'A' ? [['one.md', 2048, now], ['two.md', 10, now - 5]] : p === 'B' ? [['one.md', 7, now]] : [] });
    if (o && o.method === 'POST') {
      const b = JSON.parse(o.body); posts.push([url.pathname.replace(/^.*\/api/, '/api'), b]);
      if (/copy$/.test(url.pathname)) return say.refuse ? json({ ok: false, err: 'too big to copy here', name: null }, 409) : json({ ok: true, name: 'one copy.md', msg: 'copied' });
      return json({ ok: true, msg: 'moved' });
    }
    return json({});
  };
  (async function(){
    const sl = ms => new Promise(r => setTimeout(r, ms)); const out = []; const T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
    try {
    const $ = s => document.querySelector(s), stage = $('#stage');
    const key = (k, o = {}) => window.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o)));
    const toast = () => { const t = $('#toast'); return t.hidden ? '' : t.textContent; };
    const go = async n => { VW.up(); VW.snap(); await sl(500); VW.enter(n); VW.snap(); await sl(600); VW.snap(); await sl(200); };
    for (let i = 0; i < 60 && (typeof VW === 'undefined' || !VW.items(0).length); i++) await sl(250);
    VW.enter('A'); VW.snap(); await sl(800); VW.snap(); await sl(300);
    const f = VW.state().focus, p = VW.screenOf(0, f);
    stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: p.x, clientY: p.y, button: 2, pointerId: 7, pointerType: 'mouse' }));
    stage.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, button: 2 })); await sl(150);
    const b = k => VW.cardMenu().buttons.find(x => x.m === k);
    T('rename and trash are greyed and say why', b('rename').disabled && b('trash').disabled && /Obsidian/.test(b('rename').title), b('rename').title);
    T('open with is hidden', b('openWith').hidden);
    T('cut and copy work', !b('cut').disabled && !b('copy').disabled);
    key('Escape'); await sl(100);
    key('F2'); await sl(150);
    T('F2 says renaming is Obsidian\'s', !VW.renaming() && /inside Obsidian/.test(toast()), toast());
    // the copy keeps the one.md in B safe: the server gives the name
    VW.spinTo(VW.items(0).indexOf('one.md')); await sl(400); VW.snap(); await sl(200);
    key('c', { ctrlKey: true }); await sl(100); await go('B');
    say.refuse = true; key('v', { ctrlKey: true }); await sl(300); say.refuse = false;
    T('a refused copy says why and adds nothing', /too big/.test(toast()) && VW.items(0).length === 1, toast());
    key('v', { ctrlKey: true }); await sl(300);
    const c = posts.filter(x => x[0] === '/api/copy');
    T('a copy pasted posts /api/copy with the folder you are in', c.length === 2 && c[1][1].from === 'A/one.md' && c[1][1].to === 'B', JSON.stringify(c));
    T('the copy takes the server\'s name', VW.items(0).includes('one copy.md') && VW.items(0).includes('one.md'), JSON.stringify(VW.items(0)));
    T('no undo is offered, the site cannot take it away', !/Undo/.test(toast()) && /Copied/.test(toast()), toast());
    await go('A');
    VW.spinTo(VW.items(0).indexOf('two.md')); await sl(400); VW.snap(); await sl(200);
    key('x', { ctrlKey: true }); await sl(100); await go('B'); key('v', { ctrlKey: true }); await sl(300);
    const m = posts.filter(x => x[0] === '/api/move');
    T('a cut pasted posts the move', m.length === 1 && m[0][1].from === 'A/two.md' && m[0][1].to === 'B' && VW.items(0).includes('two.md'), JSON.stringify(m));
    } catch (err) { out.push('FAIL threw :: ' + err.message + ' ' + (err.stack || '').split('\n')[1]); }
    console.log('RESULTS\n' + out.join('\n'));
  })();
})();
