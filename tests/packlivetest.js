// the site with the heavy parts in files beside the page (see tools/build.sh, made here from a test build): nothing asked for at
// the start, an empty folder fetches the gifs once, with the page's key. the server is faked
(function(){
  const cry = document.getElementById('cryData'), gifsText = cry.textContent; delete window.__VENDOR; window.__VW_PACKS = 1; cry.textContent = '';
  const now = Math.floor(Date.now() / 1000), asked = [];
  window.fetch = async u => {
    const url = new URL(u, location.href), json = o => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } }); asked.push(url.pathname.replace(/^.*\/(api|pack)\//, '/$1/') + (url.searchParams.has('k') ? '?k' : ''));
    if (/\/api\/tree$/.test(url.pathname)) return json({ root: 'Vault', tree: { n: 'Vault', f: 0, m: now, t: {}, c: [{ n: 'Empty', f: 0, m: now, t: {}, c: [] }, { n: 'Bare', f: 0, m: now, t: {}, c: [] }] } });
    if (/\/api\/files$/.test(url.pathname)) return json({ files: [] });
    if (/\/pack\/gifs$/.test(url.pathname)) return new Response(gifsText);
    return json({});
  };
  (async function(){
    const sl = ms => new Promise(r => setTimeout(r, ms)); const out = []; const T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
    try {
      const packs = () => asked.filter(a => a.startsWith('/pack/')), until = async f => { for (let i = 0; i < 40 && !f(); i++) await sl(100); return f(); };
      for (let i = 0; i < 60 && (typeof VW === 'undefined' || !VW.items(0).length); i++) await sl(250);
      await sl(500);
      T('nothing is fetched for them at the start', !packs().length, asked.join());
      VW.enter('Empty'); VW.snap();
      T('an empty folder fetches the gifs, with the key, and shows one', await until(() => VW.cry().on) && packs().join() === '/pack/gifs?k', JSON.stringify(VW.cry()) + ' ' + asked.join());
      VW.up(); await sl(300); VW.enter('Bare'); VW.snap();
      T('the next one does not fetch them again', await until(() => VW.cry().on) && packs().length === 1, asked.join());
    } catch (err) { out.push('FAIL threw :: ' + err.message); }
    console.log('RESULTS\n' + out.join('\n'));
  })();
})();
