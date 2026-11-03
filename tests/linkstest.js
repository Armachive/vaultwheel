// the site cuts pictures down in the browser, and each small copy is a blob link holding its bytes. a link goes when its picture
// leaves the cache (400 small ones), so a long session through folders of pictures does not keep every copy it ever made. the
// server is faked
(function(){
  const now = 1700000000, files = []; for (let i = 0; i < 450; i++) files.push(['p' + String(i).padStart(3, '0') + '.jpg', 9000 + i, now - i]);
  let made = 0, gone = 0; const mo = URL.createObjectURL.bind(URL), ro = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = o => { made++; return mo(o); }; URL.revokeObjectURL = u => { gone++; return ro(u); };
  const big = new Promise(r => { const c = document.createElement('canvas'); c.width = 500; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#7575b8'; g.fillRect(0, 0, 500, 400); c.toBlob(r, 'image/jpeg'); });
  window.fetch = async u => {
    const url = new URL(u, location.href), p = url.searchParams.get('p'), json = o => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
    if (/\/api\/tree$/.test(url.pathname)) return json({ root: 'Vault', tree: { n: 'Vault', f: 0, m: now, t: {}, c: [{ n: 'Pics', f: files.length, m: now, t: { jpg: 450 }, c: [] }] } });
    if (/\/api\/files$/.test(url.pathname)) return json({ files: p === 'Pics' ? files : [] });
    if (/\/api\/file$/.test(url.pathname)) return new Response(await big);
    return json({});
  };
  (async function(){
    const sl = ms => new Promise(r => setTimeout(r, ms)); const out = []; const T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
    try {
      for (let i = 0; i < 60 && (typeof VW === 'undefined' || !VW.items(0).length); i++) await sl(250);
      await sl(300); VW.enter('Pics'); VW.snap();
      for (let i = 0; i < 40 && VW.items(0).length < 450; i++) await sl(100);
      VW.prefetchAll();
      for (let i = 0, was = -1; i < 300 && made < 450 && (i < 50 || made !== was); i++) { was = made; await sl(200); }
      T('every picture was cut down', made >= 450, made + ' links made');
      T('the links of those that left the cache are gone', made - gone <= 420, made + ' made, ' + gone + ' gone');
      T('the page keeps count of the rest', VW.keptLinks() <= 420 && VW.keptLinks() === made - gone, VW.keptLinks() + ' kept');
    } catch (err) { out.push('FAIL threw :: ' + err.message); }
    console.log('RESULTS\n' + out.join('\n'));
  })();
})();
