// a plugin from before video frames answers a video with no frame flag: said once, however many videos ask. a plugin that
// says frame (even with no picture for that video) says nothing. the plugin is faked here. run on a bridge build:
// RTEST_REAL=1 sh tools/rtest.sh <out> tests/oldplugintest.js (the page is loaded twice)
(function(){
  const old = !sessionStorage.getItem('oldplugin2');
  const now = 1700000000, files = []; for (let i = 0; i < 5; i++) files.push(['clip ' + i + '.mp4', 9e6, now]);
  const tree = { n: 'Vault', f: 0, m: now, t: {}, c: [{ n: 'Vids', f: 5, m: now, t: { mp4: 5 }, c: [] }] };
  const sl = ms => new Promise(r => setTimeout(r, ms)); const said = [], out = JSON.parse(sessionStorage.getItem('oldpluginOut') || '[]'); const T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
  window.parent = { postMessage(m) {
    if (!m || !m.vw || m.id == null) return;
    const reply = d => setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: Object.assign({ vw: 1, id: m.id }, d) })), 5);
    if (m.t === 'tree') return reply({ root: 'Vault', tree });
    if (m.t === 'files') return reply({ files: m.p === 'Vids' ? files : [] });
    if (m.t === 'prefs') return reply({ prefs: {} });
    if (m.t === 'thumb') return reply(old ? { url: null } : { url: null, frame: true });
    reply({ ok: true });
  } };
  (async () => { try {
    for (let i = 0; i < 80 && (typeof VW === 'undefined' || !VW.items(0).length); i++) await sl(250);
    const el = document.querySelector('#toast');
    new MutationObserver(() => { if (!el.hidden && /Restart Obsidian/.test(el.textContent)) said.push(el.textContent); }).observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
    for (let i = 0; i < 5 && VW.state().path.length > 1; i++) { VW.up(); VW.snap(); await sl(200); }
    VW.enter('Vids'); VW.snap(); await sl(400); VW.snap(); VW.prefetchAll(); await sl(1500);
    const seen = new Set(said);
    if (old) {
      T('an old plugin gets one toast telling you to restart once', seen.size === 1 && /Restart Obsidian once/.test([...seen][0]) && said.length <= 2, JSON.stringify(said));
      sessionStorage.setItem('oldplugin2', '1'); sessionStorage.setItem('oldpluginOut', JSON.stringify(out)); location.reload(); return;
    }
    T('a plugin that makes frames gets none', !said.length, JSON.stringify(said));
  } catch (err) { out.push('FAIL threw :: ' + err.message); }
  sessionStorage.removeItem('oldplugin2'); sessionStorage.removeItem('oldpluginOut');
  console.log('RESULTS\n' + out.join('\n')); })();
})();
