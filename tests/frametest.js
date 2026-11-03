// RTEST: page errors expected
// the frame loop can't die: the error that once stopped the wheel for good (a colour stop out of range, thrown from a card
// being made) costs a frame, is said once, and the cards come when it stops. a page that came up with no size is laid out
// again once it has one
(function(){
  const out = []; const T = (n, ok, i) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));
  const sl = ms => new Promise(r => setTimeout(r, ms));
  const errs = [], warns = [], cerr = console.error, cwarn = console.warn;
  console.error = (...a) => { errs.push(a.join(' ')); cerr.apply(console, a); };
  console.warn = (...a) => { warns.push(a.join(' ')); cwarn.apply(console, a); };
  addEventListener('error', e => e.preventDefault());
  const stop = CanvasGradient.prototype.addColorStop;
  let boom = true;
  CanvasGradient.prototype.addColorStop = function (a, b) { return stop.call(this, boom ? 1.0000000001 : a, b); };
  (async function(){
    try {
      for (let i = 0; i < 60 && (typeof VW === 'undefined' || !VW.items(0).length || !VW.health().frames); i++) await sl(250);
      await sl(1000);
      const a = VW.health(), f0 = a.frames;
      T('a frame that throws is counted', a.failed > 0, JSON.stringify(a));
      T('and the error kept', a.errors.length === 1 && /addColorStop/.test(a.errors[0]), a.errors.join());
      T('no card yet', !a.shown);
      const toast = document.querySelector('#toast');
      T('the first error says so in a toast, with its message', !toast.hidden && /hit an error/.test(toast.textContent) && /addColorStop/.test(toast.textContent), toast.textContent);
      await sl(1000);
      T('the loop goes on', VW.health().frames > f0, f0 + ' to ' + VW.health().frames);
      T('the console hears of it once, however many frames fail', errs.filter(e => /a frame failed/.test(e)).length === 1 && VW.health().failed > a.failed, errs.length + ', failed ' + VW.health().failed);
      toast.hidden = true;
      await sl(2600);
      T('the self check writes down why there are no cards', warns.some(w => /no card showing/.test(w) && /"stage"/.test(w) && /"wheels"/.test(w)), warns.join(' ').slice(0, 200));
      T('and the toast does not come back', toast.hidden);
      boom = false;
      await sl(800);
      T('the cards come once the error stops', VW.health().shown && VW.wheelsInfo()[0].entries > 0, JSON.stringify(VW.health()));
      // (the frame reads the reduced motion setting after the cards are placed, and nothing else reads it here)
      const n = VW.health().failed, q = Object.getOwnPropertyDescriptor(MediaQueryList.prototype, 'matches');
      Object.defineProperty(MediaQueryList.prototype, 'matches', { configurable: true, get() { Object.defineProperty(MediaQueryList.prototype, 'matches', q); throw new Error('by hand'); } });
      await sl(300);
      T('a throw anywhere in a frame costs that frame', VW.health().failed === n + 1 && VW.health().errors.includes('by hand'), JSON.stringify(VW.health()));
      VW.snap(); await sl(600);
      // no size, then a real one
      const stage = document.querySelector('#stage'), room = () => { const r = VW.room(); return [r.outer, r.up, r.down, r.picMax].map(x => +x.toFixed(3)).join(); }, base = room(), cam = VW.camera().pos.join();
      stage.style.display = 'none'; dispatchEvent(new Event('resize')); await sl(600);
      T('a stage with no size is known', !VW.health().real && stage.clientWidth === 0);
      const f1 = VW.health().frames; await sl(500);
      T('and with no size no frames run at all', VW.health().frames === f1, f1 + ' to ' + VW.health().frames);
      stage.style.display = ''; dispatchEvent(new Event('resize')); await sl(1200);
      T('they start again with a size', VW.health().frames > f1, f1 + ' to ' + VW.health().frames);
      T('a real size again brings back the same camera and numbers', VW.health().real && room() === base && VW.camera().pos.join() === cam, room() + ' / ' + base + ' , ' + VW.camera().pos.join() + ' / ' + cam);
      T('with the cards', VW.health().shown && VW.wheelsInfo()[0].entries > 0);
      T('and nothing failed on the way', VW.health().failed === n + 1, JSON.stringify(VW.health().errors));
    } catch (err) { out.push('FAIL threw :: ' + err.message + ' ' + (err.stack || '').split('\n')[1]); }
    console.log('RESULTS\n' + out.join('\n'));
  })();
})();
