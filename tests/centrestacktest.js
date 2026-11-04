(async function(){
  // the stack and the playground in the centre view: the stack on the focused card's corner on the parents' side, on the
  // crying gif's corner in an empty folder (never in empty space), picks fly in, the playground opens and closes back to
  // the centre view
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const q=s=>document.querySelector(s);
  await sl(1500); VW.flipTo(0.5); await sl(2500);
  T('the centre view is on', Math.abs(VW.view().flip-0.5)<0.01 && VW.view().centre>0.95, JSON.stringify(VW.view()));
  VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(800);
  const n=VW.items(0).find(x=>/\.md$/.test(x)); VW.spinTo(VW.items(0).indexOf(n)); await sl(600); VW.snap(); await sl(200);
  VW.shiftSelect(0,n); await sl(1500); VW.snap(); await sl(800);
  const st=VW.state(), f=VW.screenOf(0,st.focus), s=VW.stackScreen();
  T('carrying in the centre: one card carried, a real card in focus', st.sel.length===1 && !!st.focus && !!f, JSON.stringify(st));
  T('the stack sits up and to the parents\' side of the focused card', s && f && s.x<f.x && s.y<f.y, JSON.stringify({s,f}));
  // into an empty folder: the crying gif shows and the stack sits on its corner, not in empty space
  VW.up(); VW.snap(); await sl(600); VW.up(); VW.snap(); await sl(600);
  VW.enter('Tessara'); VW.snap(); await sl(600); VW.enter('Tessaran Collection'); VW.snap(); await sl(2500);
  const c=VW.cry(), cr=q('#cry').getBoundingClientRect(), s2=VW.stackScreen();
  T('an empty folder shows the crying gif while carrying', c.on && c.dir==='Tessaran Collection', JSON.stringify(c));
  const near=s2 && Math.hypot(s2.x-cr.left,s2.y-cr.top)<Math.max(cr.width,cr.height)*0.45;
  T('the stack sits on the gif\'s top corner on the parents\' side', near, JSON.stringify({s2,gif:[cr.left|0,cr.top|0,cr.width|0,cr.height|0]}));
  // the playground opens from the centre and closes back to it
  VW.openStackView(); await sl(600);
  T('the playground opens from the centre', VW.stackView().open && document.querySelectorAll('#sv .item').length===1, JSON.stringify(VW.stackView()));
  q('#sv .pgx').click(); await sl(800);
  T('closing it is back in the centre view, still carrying', !VW.stackView().open && Math.abs(VW.view().flip-0.5)<0.01 && VW.state().sel.length===1, JSON.stringify(VW.view()));
  // a hold on the stack puts everything back
  VW.up(); VW.snap(); await sl(800);
  const s3=VW.stackScreen(), pe=(t,x,y)=>q('#stage').dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:x,clientY:y,button:0,pointerId:41,pointerType:'mouse'}));
  pe('pointerdown',s3.x,s3.y); await sl(700); pe('pointerup',s3.x,s3.y); await sl(800);
  T('a hold on the stack puts everything back', VW.state().sel.length===0, JSON.stringify(VW.state().sel));
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
