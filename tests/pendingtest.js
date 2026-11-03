// a card drawn again and again while its picture is on its way (a long name scrolling, a frame waiting its turn in the plugin's
// queue for minutes) hears once when the picture comes, not once for every time it was drawn. the plugin is faked
(function(){
  const LONG = 'a name so long it has to scroll across its card since it will never fit on one line.png', now = Math.floor(Date.now() / 1000), held = [];
  const tree = { n: 'Vault', f: 0, m: now, t: {}, c: [{ n: 'Pics', f: 1, m: now, t: { png: 1 }, c: [] }] };
  const pic = () => { const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d'); x.fillStyle = '#7575b8'; x.fillRect(0, 0, 320, 180); return new Promise(r => c.toBlob(b => r(URL.createObjectURL(b)))); };
  window.parent = { postMessage(m) {
    if (!m || !m.vw || m.id == null) return;
    const reply = d => setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: Object.assign({ vw: 1, id: m.id }, d) })), 10);
    if (m.t === 'tree') return reply({ root: 'Vault', tree });
    if (m.t === 'files') return reply({ files: m.p === 'Pics' ? [[LONG, 5000, now, 320, 180]] : [] });
    if (m.t === 'prefs') return reply({ prefs: {} });
    if (m.t === 'thumb') { held.push(reply); return; }
    reply({ ok: true });
  } };
  (async function(){
    const sl = ms => new Promise(r => setTimeout(r, ms)); const out = []; const T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
    try {
      for (let i = 0; i < 60 && (typeof VW === 'undefined' || !VW.items(0).length); i++) await sl(250);
      await sl(500); VW.enter('Pics'); VW.snap();
      for (let i = 0; i < 40 && !held.length; i++) await sl(100);
      await sl(1500);      // it scrolls on, drawn over and over, while the picture is held back
      const perFrame = new Map(), draw = VWCards.drawCard; let last = 0;
      VWCards.drawCard = function (x, w, h, spec) { if (spec.name === LONG) { const f = VW.health().frames; perFrame.set(f, (perFrame.get(f) || 0) + 1); last = f; } return draw.call(this, x, w, h, spec); };
      const url = await pic(); while (held.length) held.shift()({ url });
      await sl(1000);
      const most = Math.max(0, ...perFrame.values());
      T('it was asked for, and held back while the card scrolled', perFrame.size > 0, perFrame.size + ' frames drew it');
      T('the picture coming draws the card once or twice, not once per draw it waited through', most <= 3, 'most in one frame: ' + most);
      T('and it shows the picture', VW.faces(0).some(f => f.px > 0), JSON.stringify(VW.faces(0)));
    } catch (err) { out.push('FAIL threw :: ' + err.message); }
    console.log('RESULTS\n' + out.join('\n'));
  })();
})();
