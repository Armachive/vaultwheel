// a new file in Obsidian (the plugin is faked here, run on a bridge build): nothing is asked of the plugin until Enter, an
// Esc asks nothing at all, the name typed goes over with the folder, a number from the plugin is what the card shows, a
// refusal keeps the field open, an older plugin says what to do, and an undo goes through trash with Obsidian's question
(function(){
  const reqs = [], now = Math.floor(Date.now() / 1000); let say = {};
  const tree = { n: 'Vault', f: 0, m: now, t: {}, c: [{ n: 'A', f: 2, m: now, t: { md: 2 }, c: [] }, { n: 'B', f: 0, m: now - 9, t: {}, c: [] }] };
  // (a real window stands for the plugin's side, since the page only takes vault changes from its parent window)
  const fr = document.createElement('iframe'); fr.style.display = 'none'; (document.body || document.documentElement).appendChild(fr); window.parent = fr.contentWindow;
  fr.contentWindow.postMessage = function(m) {
    if (!m || !m.vw || m.id == null) return;
    const reply = d => setTimeout(() => { window.dispatchEvent(new MessageEvent('message', { data: Object.assign({ vw: 1, id: m.id }, d) })); }, say.slow || 20);
    reqs.push(m);
    if (m.t === 'tree') return reply({ root: 'Vault', tree, desktop: null });
    if (m.t === 'files') return reply({ files: m.p === 'A' ? [['one.md', 2048, now], ['two.md', 10, now - 5]] : [] });
    if (m.t === 'prefs') return reply({ prefs: {} });
    if (m.t === 'newFile') {
      if (say.err) return reply({ ok: false, err: say.err });
      return reply({ ok: true, path: (m.p ? m.p + '/' : '') + (say.as || m.name), name: say.as || m.name });
    }
    if (m.t === 'trashMany') return reply({ results: m.paths.map(p => ({ p, ok: true })) });
    reply({ ok: true });
  };
  (async function(){
    const sl = ms => new Promise(r => setTimeout(r, ms)); const out = []; const T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
    try {
    const $ = s => document.querySelector(s), cren = $('#cardRen'), plus = $('#bPlus'), pop = $('#plusPop'), dots = $('#bMore');
    const toast = () => { const t = $('#toast'); return t.hidden ? '' : t.textContent; };
    const ckey = k => cren.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    const has = n => VW.items(0).includes(n), asked = t => reqs.filter(r => r.t === t);
    const kindOf = n => { const p = VW.places().find(x => x.name === n); return p && p.kind; };
    const newFile = async () => { plus.click(); await sl(40); pop.querySelector('[data-new=file]').click(); await sl(350); };
    const change = (kind, p, more) => window.dispatchEvent(new MessageEvent('message', { source: fr.contentWindow, data: Object.assign({ vw: 1, t: 'vaultChange', kind, p, isDir: false, size: 0, m: now }, more) }));
    for (let i = 0; i < 60 && (typeof VW === 'undefined' || !VW.items(0).length); i++) await sl(250);
    VW.enter('A'); VW.snap(); await sl(800); VW.snap(); await sl(300);
    await newFile();
    T('nothing is asked of the plugin while the name is typed', VW.renaming() && VW.renaming().draft && !asked('newFile').length, JSON.stringify(VW.renaming()));
    ckey('Escape'); await sl(300);
    T('Esc asks nothing at all, not even a trash', !asked('newFile').length && !asked('trashMany').length && !has('New file'));
    await newFile(); cren.value = 'notes.md'; ckey('Enter'); await sl(300);
    let q = asked('newFile');
    T('Enter asks for the file by the name typed, in this folder', q.length === 1 && q[0].p === 'A' && q[0].name === 'notes.md', JSON.stringify(q));
    T('the card is there with its type', has('notes.md') && kindOf('notes.md') === 'text' && !VW.renaming(), kindOf('notes.md'));
    // the vault's own create event comes after: no second card
    change('create', 'A/notes.md'); await sl(800);
    T('the vault\'s create event adds no second card', VW.items(0).filter(n => n === 'notes.md').length === 1, JSON.stringify(VW.items(0)));
    // a file arriving under the draft's own name, while it is being typed, is not the draft
    await newFile(); change('create', 'A/New file'); await sl(800);
    T('a real file arriving under the draft\'s name gets its own card and the field stays', VW.items(0).filter(n => n === 'New file').length === 2 && VW.renaming() && VW.renaming().draft, JSON.stringify(VW.items(0)));
    ckey('Escape'); await sl(300);
    T('Esc takes only the draft', VW.items(0).filter(n => n === 'New file').length === 1, JSON.stringify(VW.items(0)));
    // numbered by the plugin (a clash the page cannot see)
    say.as = 'hid 2.md'; await newFile(); cren.value = 'hid.md'; ckey('Enter'); await sl(300); say.as = null;
    T('a number from the plugin is what the card shows, and it says so', has('hid 2.md') && !has('hid.md') && /already there/.test(toast()), toast());
    // refused, and put right
    say.err = 'that name cannot be used'; await newFile(); cren.value = 'bad?.md'; ckey('Enter'); await sl(300); say.err = null;
    T('a refusal keeps the field open and says why', VW.renaming() && VW.renaming().draft && /cannot be used/.test(toast()), toast());
    cren.value = 'good.md'; ckey('Enter'); await sl(300);
    T('and the name can then be fixed', has('good.md') && !has('New file 2') && !VW.renaming(), JSON.stringify(VW.items(0)));
    // an older plugin
    say.err = 'unknown request'; await newFile(); cren.value = 'x.md'; ckey('Enter'); await sl(300); say.err = null;
    T('an older plugin says to restart Obsidian', /restart Obsidian/.test(toast()), toast());
    ckey('Escape'); await sl(300);
    // left while it is being saved
    say.slow = 300; await newFile(); cren.value = 'late.md'; ckey('Enter'); await sl(40); ckey('Escape'); await sl(600); say.slow = 0;
    T('a reply that comes after the field went still shows the file it made', has('late.md') && !has('New file 2'), JSON.stringify(VW.items(0)));
    // undo
    VW.spinTo(VW.items(0).indexOf('late.md')); await sl(300);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })); await sl(300);
    const tr = asked('trashMany');
    T('an undo sends it to .trash through the plugin', tr.length === 1 && tr[0].paths[0] === 'A/late.md' && !has('late.md'), JSON.stringify(tr));
    // a folder never opened is listed first, so the draft does not sit on a guess
    VW.up(); VW.snap(); await sl(500); VW.enter('B'); VW.snap(); await sl(600);
    await newFile(); cren.value = 'in b.md'; ckey('Enter'); await sl(300);
    q = asked('newFile');
    T('in another folder it goes there', q[q.length - 1].p === 'B' && has('in b.md'), JSON.stringify(q[q.length - 1]));
    T('the three dots open on it', (dots.click(), VW.cardMenu().open && VW.cardMenu().name === 'in b.md'), VW.cardMenu().name);
    } catch (err) { out.push('FAIL threw :: ' + err.message + ' ' + (err.stack || '').split('\n')[1]); }
    console.log('RESULTS\n' + out.join('\n'));
  })();
})();
