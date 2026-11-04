// pictures in Obsidian (the plugin is faked here): every picture card gets its picture, the small one asked for before
// the sharp one, the card in focus shows the sharp one, a picture whose first answer failed is asked for again, nothing
// is asked for twice, and a video card asks for its file to take a frame from. then the arrows in a scaled column move
// between the cards, and only past the end of a row toward the directory columns do they go up a rung
(function(){
  const reqs = []; let failedOnce = false;
  const now = Math.floor(Date.now() / 1000), pics = [];
  for (let i = 0; i < 9; i++) pics.push(['pic ' + String(i).padStart(2, '0') + '.png', 50000, now - i * 60]);
  pics.push(['clip.mp4', 9e6, now - 5000]); pics.push(['notes.md', 2000, now - 6000]);
  // (the first three pictures come with no size, as on a phone. the rest carry theirs in the folder's listing)
  for (let i = 3; i < 9; i++) { const [a, b] = i === 6 ? [3, 2] : i % 3 === 0 ? [9, 16] : i % 3 === 1 ? [4, 3] : [16, 9]; pics[i].push(a * 100, b * 100); }
  const tree = { n: 'Vault', f: 0, m: now, t: {}, c: [{ n: 'Pics', f: pics.length, m: now, t: { png: 9, mp4: 1, md: 1 }, c: [] }] };
  const shapeOf = name => { const i = +name.slice(4, 6); return i === 6 ? [3, 2] : i % 3 === 0 ? [9, 16] : i % 3 === 1 ? [4, 3] : [16, 9]; };
  const img = (name, px) => { const [a, b] = shapeOf(name), s = px / Math.max(a, b), c = document.createElement('canvas'); c.width = Math.round(a * s); c.height = Math.round(b * s); const x = c.getContext('2d'); x.fillStyle = 'hsl(' + (name.length * 37 % 360) + ',60%,60%)'; x.fillRect(0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8); };
  window.parent = { postMessage(m) {
    if (!m || !m.vw || m.id == null) return;
    const reply = d => setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: Object.assign({ vw: 1, id: m.id }, d) })), 30);
    reqs.push({ t: m.t, p: m.p, px: m.px || 0 });
    if (m.t === 'tree') return reply({ root: 'Vault', tree });
    if (m.t === 'files') return reply({ files: m.p === 'Pics' ? pics : [] });
    if (m.t === 'prefs') return reply({ prefs: {} });
    if (m.t === 'thumb') { if (m.p === 'Pics/pic 00.png' && !failedOnce) { failedOnce = true; return reply({ url: null }); } return reply({ url: img(m.p.split('/').pop(), m.px || 360) }); }
    if (m.t === 'media') return reply({ url: null });
    reply({ ok: true });
  } };
  (async function(){
    const sl = ms => new Promise(r => setTimeout(r, ms)); const out = []; const T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
    try {
    const $ = s => document.querySelector(s);
    for (let i = 0; i < 60 && (typeof VW === 'undefined' || !VW.items(0).length); i++) await sl(250);
    VW.enter('Pics'); VW.snap(); await sl(400); VW.snap();
    const onScreen = () => VW.places().map(p => [p.name, +p.y.toFixed(4), +p.w.toFixed(4), +p.h.toFixed(4)].join(' ')).filter((r, i) => i < 4).join(' | ');
    const size = n => VW.places().find(p => p.name === n), ratio = n => size(n).w / size(n).h;
    T('a picture whose size came with the listing has its own shape from the first layout', Math.abs(ratio('pic 06.png') - 1.5) < 0.01, ratio('pic 06.png'));
    const first = onScreen();
    await sl(3600); VW.snap(); await sl(300);
    T('the pictures arriving do not shuffle the cards on screen', onScreen() === first, first + ' -> ' + onScreen());
    const faces = VW.faces(0), pf = faces.filter(f => /\.png$/.test(f.name));
    T('every picture card has its picture', pf.length > 5 && pf.every(f => f.px > 0), pf.map(f => f.name + ':' + f.px).join(', '));
    const focus = VW.state().focus, ff = faces.find(f => f.name === focus);
    T('the card in focus shows the sharp picture', ff && ff.px >= 1200, JSON.stringify(ff));
    const th = reqs.filter(r => r.t === 'thumb'), lowAt = p => th.findIndex(r => r.p === p && !r.px), hiAt = p => th.findIndex(r => r.p === p && r.px);
    T('the small picture is asked for before the sharp one', pf.every(f => { const p = 'Pics/' + f.name; return hiAt(p) < 0 || lowAt(p) < hiAt(p); }), '');
    const p00 = th.filter(r => r.p === 'Pics/pic 00.png' && !r.px).length;
    // (a card shown large gets there through its sharp picture; the small one is asked for again only for a card that waits on it)
    T('a picture whose first answer failed still shows', (faces.find(f => f.name === 'pic 00.png') || {}).px > 0, p00 + ' asks');
    const twice = pf.filter(f => f.name !== 'pic 00.png' && th.filter(r => r.p === 'Pics/' + f.name && !r.px).length > 1).map(f => f.name);
    T('no picture is asked for twice', !twice.length, twice.join(', '));
    // (the plugin takes the frame from the file's own bytes: the app:// link the page plays from could not be drawn from)
    T('a video card asks the plugin for a frame from its file', reqs.some(r => r.t === 'thumb' && r.p === 'Pics/clip.mp4'), '');
    // the arrows in the collage
    VW.setScale(1); await sl(900); VW.snap(); await sl(400);
    T('at the next scale a picture that came with no size has its shape', Math.abs(ratio('pic 00.png') - 0.5625) < 0.01 && Math.abs(ratio('pic 01.png') - 4 / 3) < 0.01, ratio('pic 00.png') + ' ' + ratio('pic 01.png'));
    // and while pictures keep coming, nothing moves: no card changes place at rest
    const spots = () => JSON.stringify(VW.places().map(p => [p.name, +p.x.toFixed(4), +p.y.toFixed(4)])); const spots0 = spots(); await sl(1800);
    T('pictures arriving move no card', spots() === spots0, '');
    const key = async k => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); await sl(350); VW.snap(); await sl(100); };
    const at = () => { const n = VW.state().focus; return VW.places().find(p => p.name === n); };
    for (let i = 0; i < 6; i++) await key('ArrowUp');
    const a0 = at(); await key('ArrowDown'); const a1 = at();
    T('down moves to the row below', a0 && a1 && a1.y > a0.y + 1e-4, JSON.stringify([a0, a1]));
    await key('ArrowUp'); const a2 = at();
    T('up comes back to the row above', a2 && Math.abs(a2.y - a0.y) < 1e-4, JSON.stringify(a2));
    await key('ArrowRight'); const a3 = at(); await key('ArrowLeft'); const a4 = at();
    T('sideways moves along the row', a3 && a4 && Math.abs(a3.y - a2.y) < 1e-4 && a3.name !== a2.name || (a4 && a4.name !== a2.name), JSON.stringify([a2 && a2.name, a3 && a3.name, a4 && a4.name]));
    let steps = 0; const depth = VW.state().path.length;
    while (steps < 30 && VW.state().path.length === depth) { const b = at(); await key('ArrowLeft'); steps++; if (VW.state().path.length !== depth) break; const c = at(); if (c && b && c.name === b.name) break; }
    T('past the end of the row toward the directory columns it goes up a rung', VW.state().path.length === depth - 1, steps + ' steps, path ' + VW.state().path.join('>'));
    } catch (err) { out.push('FAIL threw :: ' + err.message + ' ' + (err.stack || '').split('\n')[1]); }
    console.log('RESULTS\n' + out.join('\n'));
  })();
})();
