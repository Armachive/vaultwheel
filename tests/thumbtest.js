// thumbnails kept across sessions, in a page with storage on (the plugin is faked here). run on a bridge build with
// RTEST_REAL=1 sh tools/rtest.sh <out> tests/thumbtest.js: storage does not wait for the test clock. the first visit makes them and
// they land in storage, keyed by vault, path, size, change time and tier; gifs and links that are not blobs do not. the
// page is then loaded again: what was kept shows with no ask to the plugin, and the sharp picture is still asked for after
// the small one was looked up. a changed file is made afresh, one that will not decode leaves storage and is made
// afresh, and links out of storage are freed as the cache lets go of them
window.__VW_CACHE__ = true;
(function(){
  const visit = +(sessionStorage.getItem('thumbtest') || 1), DB = 'vaultwheel-thumbs';
  if (visit === 1) indexedDB.deleteDatabase(DB);
  const out = JSON.parse(sessionStorage.getItem('thumbtestOut') || '[]');
  const T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
  const now = 1700000000, pics = [];
  for (let i = 0; i < 6; i++) pics.push(['pic ' + i + '.png', 5000 + i, now - i, 400, 300]);
  // (the second visit finds pic 4 changed on disk)
  if (visit === 2) pics[4][2] = now + 500;
  pics.push(['moves.gif', 3000, now - 20], ['clip.mp4', 9e6, now - 21], ['song.mp3', 4e6, now - 22], ['asfile.png', 7000, now - 23, 400, 300], ['bare.png', 8000, now - 24, 400, 300]);
  const many = []; for (let i = 0; i < 430; i++) many.push(['m' + String(i).padStart(3, '0') + '.png', 100 + i, now, 40, 30]);
  const tree = { n: 'Vault', f: 0, m: now, t: {}, c: [{ n: 'Pics', f: pics.length, m: now, t: { png: 6 }, c: [] }, { n: 'Many', f: many.length, m: now, t: { png: many.length }, c: [] }] };
  const reqs = [];
  const link = (px, type) => new Promise(r => { const c = document.createElement('canvas'); c.width = px; c.height = Math.max(1, Math.round(px * 0.75)); const x = c.getContext('2d'); x.fillStyle = '#7575b8'; x.fillRect(0, 0, c.width, c.height); c.toBlob(b => r(URL.createObjectURL(b)), type || 'image/png'); });
  const dataLink = () => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; return c.toDataURL(); };
  const made = new Set(), revoked = new Set(), cou = URL.createObjectURL.bind(URL), rou = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = u => { revoked.add(u); rou(u); };
  window.parent = { postMessage(m) {
    if (!m || !m.vw || m.id == null) return;
    const reply = d => setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: Object.assign({ vw: 1, id: m.id }, d) })), 5);
    reqs.push({ t: m.t, p: m.p, px: m.px || 0 });
    if (m.t === 'tree') return reply({ root: 'Vault', tree });
    if (m.t === 'files') return reply({ files: m.p === 'Pics' ? pics : m.p === 'Many' ? many : [] });
    if (m.t === 'prefs') return reply({ prefs: {} });
    if (m.t === 'thumb') {
      if (/moves\.gif$/.test(m.p)) return link(40, 'image/png').then(url => reply({ url }));
      if (/asfile\.png$/.test(m.p)) return reply({ url: dataLink() });
      if (/clip\.mp4$/.test(m.p)) return link(40, 'image/jpeg').then(url => reply({ url, frame: true }));
      return link(m.px >= 1200 ? 1280 : 40).then(url => reply({ url }));
    }
    if (m.t === 'art') return link(40).then(url => reply({ url }));
    if (m.t === 'media') return reply({ url: null });
    reply({ ok: true });
  } };
  const sl = ms => new Promise(r => setTimeout(r, ms));
  const openDb = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onupgradeneeded = () => r.result.createObjectStore('t', { keyPath: 'k' }).createIndex('at', 'at'); });
  const keysOf = async () => { const db = await openDb(); const k = await new Promise(res => { const g = db.transaction('t').objectStore('t').getAllKeys(); g.onsuccess = () => res(g.result); }); db.close(); return k; };
  const small = p => reqs.filter(r => r.t === 'thumb' && r.p === p && !r.px).length;
  (async function(){
    try {
    for (let i = 0; i < 80 && (typeof VW === 'undefined' || !VW.items(0).length); i++) await sl(250);
    if (visit === 1) {
      VW.enter('Pics'); VW.snap(); await sl(400); VW.snap(); VW.prefetchAll();
      let keys = [];
      for (let i = 0; i < 100; i++) { await sl(150); keys = await keysOf(); if (keys.length >= 8) break; }
      T('small pictures, a video frame and a cover are kept', keys.includes('Vault|Pics/pic 0.png|5000|' + now + '|s') && keys.includes('Vault|Pics/clip.mp4|9000000|' + (now - 21) + '|v') && keys.includes('Vault|Pics/song.mp3|4000000|' + (now - 22) + '|a'), keys.join(', '));
      T('a gif is not kept', !keys.some(k => /moves\.gif/.test(k)), keys.join(', '));
      T('a link that is not a blob is not kept', !keys.some(k => /asfile\.png/.test(k)), keys.join(', '));
      T('the small one is asked for before the sharp one', ['Pics/pic 0.png'].every(p => { const th = reqs.filter(r => r.p === p), a = th.findIndex(r => !r.px), b = th.findIndex(r => r.px); return b < 0 || a < b; }), JSON.stringify(reqs.filter(r => r.p === 'Pics/pic 0.png')));
      // a stored picture that no longer decodes
      const db = await openDb(); await new Promise(res => { const t = db.transaction('t', 'readwrite'); t.objectStore('t').put({ k: 'Vault|Pics/bare.png|8000|' + (now - 24) + '|s', b: new Blob(['not a picture'], { type: 'image/png' }), at: 1 }); t.oncomplete = res; }); db.close();
      VW.up(); VW.snap(); await sl(300); VW.enter('Many'); VW.snap(); await sl(300); VW.prefetchAll();
      for (let i = 0; i < 300; i++) { await sl(200); keys = await keysOf(); if (keys.filter(k => /Many/.test(k)).length >= 430) break; }
      T('a big folder is kept whole', keys.filter(k => /Many/.test(k)).length === 430, keys.length + ' kept');
      sessionStorage.setItem('thumbtest', '2'); sessionStorage.setItem('thumbtestOut', JSON.stringify(out));
      location.reload(); return;
    }
    // (the page comes back to the folder it was in)
    for (let i = 0; i < 5 && VW.state().path.length > 1; i++) { VW.up(); VW.snap(); await sl(300); }
    VW.enter('Pics'); VW.snap(); await sl(400); VW.snap(); VW.prefetchAll();
    const P = n => 'Pics/' + n;
    for (let i = 0; i < 60; i++) { await sl(150); const f = VW.faces(0).filter(x => /^pic [0-5]/.test(x.name)); if (f.length && f.every(x => x.px > 0)) break; }
    // (a card waiting on the bad one asks again once it has failed)
    VW.spinTo(VW.items(0).indexOf('bare.png')); await sl(500); VW.snap();
    for (let i = 0; i < 60 && !small(P('bare.png')); i++) await sl(150);
    await sl(1000); VW.spinTo(VW.items(0).indexOf('pic 0.png')); await sl(500); VW.snap(); await sl(1500);
    T('what was kept shows with no small ask to the plugin', [0, 1, 2, 3, 5].every(i => small(P('pic ' + i + '.png')) === 0) && !small(P('clip.mp4')) && !reqs.some(r => r.t === 'art'), JSON.stringify(reqs.filter(r => r.t === 'thumb' || r.t === 'art').map(r => r.p + ' ' + r.px)));
    const faces = VW.faces(0);
    T('and every kept picture has its face', faces.filter(f => /^pic /.test(f.name)).every(f => f.px > 0), faces.map(f => f.name + ':' + f.px).join(', '));
    T('a changed file is made afresh', small(P('pic 4.png')) === 1, small(P('pic 4.png')) + ' asks');
    T('a gif is asked for as before', small(P('moves.gif')) >= 1, '');
    const focus = VW.state().focus, ff = faces.find(f => f.name === focus);
    T('the card in focus still gets the sharp picture', reqs.some(r => r.p === P(focus) && r.px >= 1200) && ff.px >= 1200, JSON.stringify(ff));
    T('a kept picture that will not decode is made afresh', small(P('bare.png')) === 1, small(P('bare.png')) + ' asks');
    const keys = await keysOf();
    // (it comes back once its new copy lands)
    T('the bad copy is replaced', keys.includes('Vault|Pics/bare.png|8000|' + (now - 24) + '|s'), '');
    T('a link out of storage is still alive while the cache holds it', VW.keptLinks() >= 5 && revoked.size <= 1, VW.keptLinks() + ' held, ' + revoked.size + ' freed');
    VW.up(); VW.snap(); await sl(300); VW.enter('Many'); VW.snap(); await sl(300); VW.prefetchAll();
    for (let i = 0; i < 200; i++) { await sl(150); if (revoked.size >= 20) break; }
    await sl(1000);
    T('links out of storage are freed as the cache lets go of them', revoked.size >= 20 && VW.keptLinks() <= 410, VW.keptLinks() + ' held, ' + revoked.size + ' freed');
    { const n = reqs.filter(r => r.t === 'thumb' && !r.px && /^Many/.test(r.p)).length; T('a big folder seen before makes no small asks', n === 0, n + ' asks'); }
    } catch (err) { out.push('FAIL threw :: ' + err.message + ' ' + (err.stack || '').split('\n')[1]); }
    sessionStorage.removeItem('thumbtest'); sessionStorage.removeItem('thumbtestOut');
    console.log('RESULTS\n' + out.join('\n'));
  })();
})();
