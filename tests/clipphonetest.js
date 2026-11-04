(async function(){
  // the clipboard on a phone: the page in a frame 390 x 844, so the phone styles really apply. the indicator fits, its
  // buttons take a finger, toast and stack keep clear of it, the three dots build a set, and the top bar's scale stays out
  // of the menus
  if (window.top === window) {
    const f = document.createElement('iframe'); f.src = location.href; f.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;border:0;z-index:99';
    window.__VW_HALT__ = true; addEventListener('message', e => { if (e.data && e.data.clipRes) console.log('RESULTS\n' + e.data.clipRes.join('\n')); });
    document.body.appendChild(f); return;
  }
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i!==undefined&&!ok?' :: '+(typeof i==='string'?i:JSON.stringify(i)):''));
  try {
  const $=s=>document.querySelector(s), bar=$('#clipBar'), menu=$('#cardMenu');
  const overlap=(a,b)=>!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o)));
  const name=()=>bar.querySelector('.name').textContent;
  const focusOn=async n=>{ VW.spinTo(VW.items(0).indexOf(n)); await sl(450); VW.snap(); await sl(150); };
  await sl(1500); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(600);
  T('a phone-size stage', innerWidth===390 && innerHeight===844, [innerWidth,innerHeight]);
  const files=VW.items(0).filter(n=>/\.\w+$/.test(n)), a=files[0], b=files[1];
  // the three dots are how a phone cuts
  await focusOn(a); $('#bMore').click(); await sl(100); menu.querySelector('[data-m=cut]').click(); await sl(100);
  T('the three dots cut the card in focus', bar.hidden===false && name()===a);
  await focusOn(b); $('#bMore').click(); await sl(100);
  T('and offer to add', /Add to the cut/.test(menu.querySelector('[data-m=cut]').title));
  menu.querySelector('[data-m=cut]').click(); await sl(100);
  T('a second one through them adds to the set', name()==='2 items', name());
  const check=lab=>{
    const r=bar.getBoundingClientRect(), p=$('#cbPaste').getBoundingClientRect(), c=$('#cbCancel').getBoundingClientRect();
    T(lab+': inside the screen', r.left>=0 && r.right<=390 && r.bottom<=844, r);
    T(lab+': the buttons take a finger', p.height>=44 && p.width>=44 && c.height>=44 && c.width>=44 && p.right<=c.left, [p,c]);
    T(lab+': the buttons inside its box', p.left>=r.left && c.right<=r.right && p.top>=r.top && c.bottom<=r.bottom+1);
  };
  check('at 390 px');
  // a long name is cut short, the buttons stay
  $('#cbCancel').click(); await sl(80);
  VW.vaultChange({kind:'create',p:'Thornvale/Wren Holloway/a very long name that goes on and on past the width of any phone there is in the world.md',size:10,m:1,isDir:false}); await sl(800);
  const ln=VW.items(0).find(n=>/^a very long/.test(n)); await focusOn(ln); key('x',{ctrlKey:true}); await sl(100);
  check('with a long name');
  T('the name is cut short', $('#clipBar .name').scrollWidth>$('#clipBar .name').clientWidth);
  key('x',{ctrlKey:true}); await sl(80);
  await focusOn(a); $('#bMore').click(); await sl(100); menu.querySelector('[data-m=copy]').click(); await sl(100);
  for (const [t,lab] of [[0.5,'centre'],[1,'flipped'],[0,'default']]) { VW.flipTo(t); await sl(1800); check('in the '+lab+' view'); }
  // the stack, a toast, the indicator
  VW.shiftSelect(0,a); await sl(900); VW.snap(); await sl(200);
  const s=VW.stackScreen(); const n0=VW.items(0).length; $('#cbPaste').click(); await sl(400);
  const tr=$('#toast').getBoundingClientRect(), br=bar.getBoundingClientRect();
  T('Paste made the copy', VW.items(0).length===n0+1, VW.items(0).length);
  T('the toast sits above the indicator', !$('#toast').hidden && !overlap(tr,br), [tr,br]);
  T('neither sits on the stack', s && !(s.x>=tr.left&&s.x<=tr.right&&s.y>=tr.top&&s.y<=tr.bottom) && !(s.x>=br.left&&s.x<=br.right&&s.y>=br.top&&s.y<=br.bottom), [s,tr]);
  T('the toast is inside the screen', tr.left>=0 && tr.right<=390, tr);
  VW.cancelSelection(); await sl(200); key('Escape'); await sl(50);
  // the top bar shrinks on a phone, its menus do not
  $('#bDir').click(); await sl(100);
  const db=$('#dirPop button'), dr=db.getBoundingClientRect(), dp=$('#dirPop').getBoundingClientRect();
  T('the sort menu keeps finger-sized rows under the top bar\'s scale', dr.height>=44, dr.height);
  T('the sort menu is on screen', dp.left>=0 && dp.right<=390 && dp.bottom<=844, dp);
  $('#bDir').click(); await sl(80);
  if (!$('#bPlus').disabled) { $('#bPlus').click(); await sl(100);
    const pb=$('#plusPop button').getBoundingClientRect(), pp=$('#plusPop').getBoundingClientRect();
    T('so does the new menu', pb.height>=44 && pp.left>=0 && pp.right<=390, [pb,pp]);
    $('#bPlus').click(); await sl(80); }
  $('#bMore').click(); await sl(100);
  const mb=menu.querySelector('.acts button:not([hidden])').getBoundingClientRect(), mr=menu.getBoundingClientRect();
  T('the card menu is its full size, on screen', mb.height>=44 && mr.left>=0 && mr.right<=390, [mb,mr]);
  key('Escape');
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  parent.postMessage({ clipRes: out }, '*');
})();
