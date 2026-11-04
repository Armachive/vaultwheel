// the keys in Obsidian (bridge build, the plugin faked): a shortcut the wheel has no use for goes on to Obsidian, the wheel's
// own stay
(function(){
  const seen = [], now = Math.floor(Date.now() / 1000);
  const tree = { n: 'Vault', f: 0, m: now, t: {}, c: [{ n: 'A', f: 1, m: now, t: { md: 1 }, c: [] }, { n: 'B', f: 0, m: now - 9, t: {}, c: [] }] };
  window.parent = { postMessage(m) {
    if (!m || !m.vw) return; seen.push(m); if (m.id == null) return;
    const reply = d => setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: Object.assign({ vw: 1, id: m.id }, d) })), 20);
    if (m.t === 'tree') return reply({ root: 'Vault', tree });
    if (m.t === 'files') return reply({ files: [['one.md', 10, now]] });
    if (m.t === 'prefs') return reply({ prefs: {} });
    reply({ ok: false, err: 'not in this test' });
  } };
  const sl = ms => new Promise(r => setTimeout(r, ms)), out = [], T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
  setTimeout(async () => {
    try {
      const press = async (key, o = {}) => { seen.length = 0; window.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, o))); await sl(60); return seen.filter(m => m.t === 'key'); };
      let k = await press('p', { ctrlKey: true });
      T('ctrl + P goes on to Obsidian', k.length === 1 && k[0].key === 'p' && k[0].ctrl, JSON.stringify(k));
      k = await press(',', { ctrlKey: true }); T('ctrl + comma too', k.length === 1 && k[0].key === ',', JSON.stringify(k));
      k = await press('f', { ctrlKey: true, shiftKey: true }); T('ctrl + shift + F too', k.length === 1 && k[0].shift, JSON.stringify(k));
      k = await press('p', { metaKey: true }); T('cmd + P on a Mac too', k.length === 1 && k[0].meta, JSON.stringify(k));
      k = await press('F5'); T('a function key too', k.length === 1, JSON.stringify(k));
      for (const c of ['c', 'x', 'v', 'z', 'd']) { k = await press(c, { ctrlKey: true }); T('ctrl + ' + c + ' stays with the wheel', k.length === 0, JSON.stringify(k)); }
      k = await press('F2'); T('F2 stays with the wheel', k.length === 0, JSON.stringify(k));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      for (const [key, o] of [['ArrowUp', { ctrlKey: true }], ['ArrowDown', { altKey: true }], ['n', { ctrlKey: true, shiftKey: true }], ['a', {}], ['Control', { ctrlKey: true }]]) { k = await press(key, o); T(key + ' stays with the wheel', k.length === 0, JSON.stringify(k)); }
    } catch (err) { out.push('FAIL threw :: ' + err.message); }
    console.log('RESULTS\n' + out.join('\n'));
  }, 2500);
})();
