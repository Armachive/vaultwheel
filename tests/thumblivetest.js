// the site with storage on (the server faked), on a live build with RTEST_REAL=1 (see thumbtest): the small copies cut down on a first visit are kept, so on a second visit
// a picture is not downloaded for its small copy. a gif and a file the browser cannot decode are not kept
window.__VW_CACHE__ = true;
(function(){
  const visit = +(sessionStorage.getItem('thumblive') || 1), DB = 'vaultwheel-thumbs';
  if (visit === 1) indexedDB.deleteDatabase(DB);
  const out = JSON.parse(sessionStorage.getItem('thumbliveOut') || '[]');
  const T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
  const now = 1700000000, files = [];
  for (let i = 0; i < 12; i++) files.push(['p' + String(i).padStart(2, '0') + '.jpg', 90000 + i, now]);
  files.push(['moves.gif', 300, now - 9], ['bad.png', 400, now - 9]);
  const big = () => new Promise(r => { const c = document.createElement('canvas'); c.width = 800; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#7575b8'; g.fillRect(0, 0, 800, 400); c.toBlob(r, 'image/jpeg'); });
  const gif = Uint8Array.from(atob('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='), c => c.charCodeAt(0));
  const asked = [], real = window.fetch.bind(window);
  window.fetch = async u => {
    if (String(u).startsWith('blob:')) return real(u);
    const url = new URL(u, location.href), p = url.searchParams.get('p');
    const json = o => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
    if (/\/api\/tree$/.test(url.pathname)) return json({ root: 'Vault', tree: { n: 'Vault', f: 0, m: now, t: {}, c: [{ n: 'Pics', f: files.length, m: now, t: { jpg: 12 }, c: [] }] } });
    if (/\/api\/files$/.test(url.pathname)) return json({ files: p === 'Pics' ? files : [] });
    if (/\/api\/file$/.test(url.pathname)) { asked.push(p); if (/gif$/.test(p)) return new Response(new Blob([gif], { type: 'image/gif' })); if (/bad\.png$/.test(p)) return new Response(new Blob(['nope'])); return new Response(await big()); }
    if (/\/api\/art$/.test(url.pathname)) return new Response('', { status: 404 });
    return json({});
  };
  const sl = ms => new Promise(r => setTimeout(r, ms));
  const keysOf = () => new Promise(res => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('t', { keyPath: 'k' }).createIndex('at', 'at'); r.onsuccess = () => { const g = r.result.transaction('t').objectStore('t').getAllKeys(); g.onsuccess = () => { r.result.close(); res(g.result); }; }; });
  (async () => { try {
    for (let i = 0; i < 80 && (typeof VW === 'undefined' || !VW.items(0).length); i++) await sl(250);
    for (let i = 0; i < 5 && VW.state().path.length > 1; i++) { VW.up(); VW.snap(); await sl(300); }
    VW.enter('Pics'); VW.snap(); await sl(400); VW.snap(); VW.prefetchAll();
    if (visit === 1) {
      let keys = [];
      for (let i = 0; i < 150; i++) { await sl(200); keys = await keysOf(); if (keys.length >= 12) break; }
      await sl(1000); keys = await keysOf();
      T('the small copies are kept', keys.length === 12 && keys.includes('Vault|Pics/p00.jpg|90000|' + now + '|s'), keys.join(', '));
      T('a gif and a file that cannot be cut down are not', !keys.some(k => /moves|bad/.test(k)), '');
      sessionStorage.setItem('thumblive', '2'); sessionStorage.setItem('thumbliveOut', JSON.stringify(out));
      location.reload(); return;
    }
    for (let i = 0; i < 60; i++) { await sl(150); const f = VW.faces(0).filter(x => /jpg$/.test(x.name)); if (f.length && f.every(x => x.px > 0)) break; }
    await sl(1500);
    const f = VW.faces(0).filter(x => /jpg$/.test(x.name)), focus = VW.state().focus;
    T('every card shows its picture again', f.length > 0 && f.every(x => x.px > 0), f.map(x => x.name + ':' + x.px).join(', '));
    // (only a big card still comes down, for its sharp copy)
    const down = asked.filter(p => /jpg$/.test(p)), bigs = VW.faces(0).filter(x => x.px > 360).map(x => 'Pics/' + x.name);
    T('a picture is not downloaded for its small copy', down.every(p => bigs.includes(p)) && down.length < 12, JSON.stringify(down) + ' big ' + JSON.stringify(bigs));
  } catch (err) { out.push('FAIL threw :: ' + err.message); }
  sessionStorage.removeItem('thumblive'); sessionStorage.removeItem('thumbliveOut');
  console.log('RESULTS\n' + out.join('\n')); })();
})();
