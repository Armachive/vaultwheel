// a build with the heavy parts in files beside the page (the owner's own plugin, see tools/build.sh, made here from a test build):
// nothing of them is asked for at the start, an empty folder asks for the gifs once, an editor for its libraries, and a file
// that does not come says so and is asked for again next time. the plugin is faked
(function(){
  const vendorText = JSON.stringify(window.__VENDOR), cry = document.getElementById('cryData'), gifsText = cry.textContent;
  delete window.__VENDOR; window.__VW_PACKS = 1; cry.textContent = '';
  const reqs = []; let vendorFails = true;
  const now = Math.floor(Date.now() / 1000), png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  window.__VW_TEST_READ__ = () => Promise.resolve(Uint8Array.from(atob(png), c => c.charCodeAt(0)).buffer);
  const tree = { n: 'Vault', f: 0, m: now, t: {}, c: [{ n: 'Pics', f: 1, m: now, t: { png: 1 }, c: [] }, { n: 'Empty', f: 0, m: now, t: {}, c: [] }, { n: 'Bare', f: 0, m: now, t: {}, c: [] }] };
  window.parent = { postMessage(m) {
    if (!m || !m.vw || m.id == null) return;
    const reply = d => setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: Object.assign({ vw: 1, id: m.id }, d) })), 30);
    reqs.push(m.t === 'pack' ? 'pack ' + m.name : m.t);
    if (m.t === 'tree') return reply({ root: 'Vault', tree });
    if (m.t === 'files') return reply({ files: m.p === 'Pics' ? [['one.png', 5000, now, 1, 1]] : [] });
    if (m.t === 'prefs') return reply({ prefs: {} });
    if (m.t === 'thumb' || m.t === 'media') return reply({ url: null });
    if (m.t === 'pack' && m.name === 'gifs') return reply({ ok: true, text: gifsText });
    if (m.t === 'pack' && m.name === 'vendor') { if (vendorFails) { vendorFails = false; return reply({ ok: false, err: 'not here yet' }); } return reply({ ok: true, text: vendorText }); }
    reply({ ok: true });
  } };
  (async function(){
    const sl = ms => new Promise(r => setTimeout(r, ms)); const out = []; const T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
    try {
      const $ = s => document.querySelector(s), packs = n => reqs.filter(r => r === 'pack ' + n).length, until = async f => { for (let i = 0; i < 40 && !f(); i++) await sl(100); return f(); };
      for (let i = 0; i < 60 && (typeof VW === 'undefined' || !VW.items(0).length); i++) await sl(250);
      await sl(800);
      T('nothing is asked for at the start', !packs('gifs') && !packs('vendor'), reqs.join());
      VW.enter('Empty'); VW.snap();
      T('an empty folder asks for the gifs and shows one', await until(() => VW.cry().on) && packs('gifs') === 1, JSON.stringify(VW.cry()) + ' ' + reqs.join());
      VW.up(); await sl(300); VW.enter('Bare'); VW.snap();
      T('the next empty folder shows one and does not ask again', await until(() => VW.cry().on) && packs('gifs') === 1, reqs.join());
      VW.up(); await sl(300); VW.enter('Pics'); VW.snap(); await sl(500);
      VW.shiftSelect(0, 'one.png'); await sl(800); VW.openStackView(); await sl(600);
      const box = $('#sv .item'), sv = $('#sv'), r = box.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const pe = (el, t) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 61, pointerType: 'mouse' }));
      for (let i = 0; i < 2; i++) { pe(box, 'pointerdown'); pe(sv, 'pointerup'); await sl(60); }
      await sl(500);
      const ed = box.querySelector('.xbar [data-x=edit]');
      T('nothing of the editors is asked for until one opens', !!ed && !packs('vendor'), reqs.join());
      ed.click();
      T('a file that does not come says so', await until(() => /not here yet/.test($('#sv .pged .fail') ? $('#sv .pged .fail').textContent : '')), $('#sv .pged').textContent.slice(0, 120));
      $('#sv .pged .fail button').click(); await sl(100); ed.click();
      T('and it is asked for again, and the editor opens', await until(() => !!$('#sv .pged .cropper-container')) && packs('vendor') === 2, reqs.join());
    } catch (err) { out.push('FAIL threw :: ' + err.message + ' ' + (err.stack || '').split('\n')[1]); }
    console.log('RESULTS\n' + out.join('\n'));
  })();
})();
