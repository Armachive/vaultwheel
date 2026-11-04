(async function(){
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const stage=document.getElementById('stage');
  const pe=(type,x,y,o={})=>{const e=new PointerEvent(type,Object.assign({bubbles:true,clientX:x,clientY:y,button:0,pointerId:7,pointerType:'touch'},o)); (type==='pointerdown'?stage:window).dispatchEvent(e);};
  const tap=async(p)=>{ pe('pointerdown',p.x,p.y); await sl(20); pe('pointerup',p.x,p.y); };
  const wh=o=>stage.dispatchEvent(new WheelEvent('wheel',Object.assign({bubbles:true,cancelable:true,clientX:900,clientY:400},o)));
  const kid=()=>VW.wheelsInfo().find(w=>w.level===0&&!w.dying);
  const P=()=>VW.state().path.join('>');
  const toast=()=>{const t=document.getElementById('toast'); return t.hidden?'':t.textContent;};
  await sl(1500); VW.snap(); await sl(200);
  // a new directory: the child spins up from below, fades in, lands on the newest entry
  VW.enter('Thornvale'); await sl(45);
  let k=kid(), st=VW.state();
  T('new child starts below and faded', st.s< -1 && k.alpha<0.6, 's='+st.s.toFixed(2)+' alpha='+k.alpha);
  T('new child does not slide in from the side', k.x===0 && k.xt===0, 'x='+k.x);
  await sl(120); k=kid();
  T('the spin up is under way (still fading at 165 ms)', k.alpha<1, 'alpha='+k.alpha);
  await sl(900); st=VW.state(); k=kid();
  T('child lands with the newest entry in focus', st.s===0 && k.alpha===1 && st.focus===VW.items(0)[0], JSON.stringify({s:st.s,a:k.alpha,f:st.focus}));
  // going up keeps the place: no spin-up, the parent wheel steps over with the folder you left in focus
  VW.up(); await sl(45); st=VW.state(); k=kid();
  T('going up keeps the place (no spin-up, no fade)', st.path.length===1 && k.alpha===1 && st.focus==='Thornvale', 's='+st.s+' a='+k.alpha+' f='+st.focus);
  // ease out, no bounce: s never passes the target
  VW.enter('Thornvale'); VW.snap(); await sl(300);
  const s0=VW.state().s; wh({deltaY:100}); let over=0;
  for(let i=0;i<8;i++){ await sl(20); over=Math.max(over,VW.state().s-(s0+1)); }
  T('ease out with no overshoot', over<=1e-6, 'max overshoot '+over.toFixed(4));
  await sl(200);
  T('wheel notch lands quickly', Math.abs(VW.state().s-(s0+1))<0.01, 's='+VW.state().s.toFixed(3));
  // one notch is one entry even when the notch is big (scaled displays)
  const s1=Math.round(VW.state().s); wh({deltaY:150}); await sl(500);
  T('a 150 px notch moves exactly one entry', Math.round(VW.state().s)===s1+1, s1+' -> '+VW.state().s);
  const s2=Math.round(VW.state().s); wh({deltaY:300}); await sl(500);
  T('a 300 px notch moves exactly one entry', Math.round(VW.state().s)===s2+1, s2+' -> '+VW.state().s);
  // clicks: a file comes into focus on one click, opens on a double click; a folder opens on one click
  VW.up(); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  const files=VW.items(0); const fi=files.findIndex((n,i)=>i>=2 && /\.md$/.test(n));
  VW.spinTo(Math.max(0,fi-2)); await sl(400); VW.snap(); await sl(200);
  let p=VW.screenOf(0,files[fi]);
  if(p){ await tap(p); await sl(500); }
  T('one click on a file brings it into focus', VW.state().focus===files[fi] && !/Opens/.test(toast()), 'focus='+VW.state().focus+' toast='+toast());
  VW.snap(); await sl(200); p=VW.screenOf(0,files[fi]);
  if(p){ await tap(p); await sl(200); }
  T('a tap on the file in focus opens it', /Opens/.test(toast()), toast());
  // a file on the parent wheel: that folder becomes the child and the file comes into focus
  // the parent wheel is turned down to its files first (scrolling over it), then one of them is clicked
  // (Thornvale has no loose files, so this one is done from Sketchbook with the vault root as the parent)
  VW.up(); VW.snap(); VW.up(); VW.snap(); VW.enter('Sketchbook'); VW.snap(); await sl(400);
  const par=VW.items(1), pf='TOP NOTES.md', pfi=par.indexOf(pf);
  let q=VW.screenOf(1,'Sketchbook');
  for(let i=0;i<pfi-3 && q;i++){ wh({deltaY:100,clientX:q.x,clientY:q.y}); await sl(40); }
  await sl(500); VW.snap(); await sl(300); p=pfi>=0&&VW.screenOf(1,pf);
  if(p){ await tap(p); await sl(900); VW.snap(); await sl(300); }
  T('one click on a parent-wheel file goes up and focuses it', P()==='SilverOrchard' && VW.state().focus===pf, P()+' focus='+VW.state().focus+' at '+pfi);
  VW.enter('Thornvale'); VW.snap(); await sl(300);
  // folder: one click opens
  const fol=VW.items(0).find(n=>n==='Wren Holloway'); VW.snap(); await sl(200); p=fol&&VW.screenOf(0,fol);
  if(!p){ VW.spinTo(VW.items(0).indexOf('Wren Holloway')); await sl(400); VW.snap(); await sl(200); p=VW.screenOf(0,'Wren Holloway'); }
  if(p){ await tap(p); await sl(500); }
  T('one click on a folder opens it', P()==='SilverOrchard>Thornvale>Wren Holloway', P());
  // sideways swipes
  VW.snap(); await sl(300);
  for(let i=0;i<6;i++){ wh({deltaX:-30}); await sl(16); }
  T('swipe left to right goes up one rung', P()==='SilverOrchard>Thornvale', P());
  await sl(500);
  for(let i=0;i<4;i++){ wh({deltaX:30}); await sl(16); }
  T('swipe right to left goes back down', P()==='SilverOrchard>Thornvale>Wren Holloway', P());
  await sl(500); VW.snap();
  pe('pointerdown',700,400); await sl(16); pe('pointermove',730,402); await sl(16); pe('pointermove',790,404); await sl(16); pe('pointerup',790,404);
  T('touch swipe left to right goes up', P()==='SilverOrchard>Thornvale', P());
  await sl(600); VW.snap();
  VW.selectFocused(); await sl(100);
  const selName=VW.state().sel[0];
  for(let i=0;i<4;i++){ wh({deltaX:-30}); await sl(16); }
  T('selection comes along on the swipe', P()==='SilverOrchard' && VW.state().sel.length===1 && VW.state().sel[0]===selName, P()+' sel='+VW.state().sel.join(','));
  VW.cancelSelection(); await sl(500); VW.snap();
  // a flick coasts on, slows down by itself and lands exactly on a card
  VW.enter('Thornvale'); VW.snap(); await sl(300);
  pe('pointerdown',900,500); await sl(16); pe('pointermove',902,470); await sl(16); pe('pointermove',904,420); await sl(16); pe('pointermove',905,380); await sl(16); pe('pointerup',905,380);
  await sl(200); const mid=VW.state().s; await sl(3500); st=VW.state();
  T('a flick coasts on and lands on a card', !Number.isInteger(mid) && Number.isInteger(st.s) && st.s>2, 'mid='+mid.toFixed(2)+' end='+st.s);
  // empty folder: the crying gif shows, and goes when you leave
  VW.up(); VW.enter('Tessara'); VW.enter('Tessaran Collection'); VW.snap(); await sl(300);
  let c=VW.cry();
  T('empty folder shows a crying gif', c.on && c.dir==='Tessaran Collection', JSON.stringify(c));
  VW.up(); await sl(100); c=VW.cry();
  T('the gif goes when you leave', !c.on, JSON.stringify(c));
  // Enter does what a click does: the folder in focus opens; a file in focus opens too
  VW.up(); VW.snap(); await sl(300);
  const ki=VW.items(0).indexOf('Thornvale'); VW.spinTo(ki); await sl(400); VW.snap(); await sl(100);
  const kd=k=>window.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true})), ku=k=>window.dispatchEvent(new KeyboardEvent('keyup',{key:k,bubbles:true}));
  kd('Enter'); await sl(80); ku('Enter'); await sl(300);
  T('Enter opens the folder in focus', P()==='SilverOrchard>Thornvale', P());
  VW.snap(); VW.enter('Wren Holloway'); VW.snap(); await sl(300);
  const md=VW.items(0).findIndex(n=>/\.md$/.test(n)); if(md>=0){ VW.spinTo(md); await sl(400); VW.snap(); await sl(100); }
  kd('Enter'); await sl(80); ku('Enter'); await sl(200);
  T('Enter on a file opens it', /Opens/.test(toast()), toast());
  // holding Enter picks the card in focus up instead
  const held=VW.state().focus; kd('Enter'); await sl(700); ku('Enter'); await sl(300);
  T('holding Enter picks the card up', VW.state().sel.length===1 && VW.state().sel[0]===held, JSON.stringify(VW.state().sel));
  VW.cancelSelection(); await sl(300); VW.snap();
  // press and hold on a card picks it up
  const nm=VW.items(0)[2]; VW.spinTo(2); await sl(400); VW.snap(); await sl(200);
  let hp=VW.screenOf(0,nm);
  if(hp){ pe('pointerdown',hp.x,hp.y); await sl(700); pe('pointerup',hp.x,hp.y); await sl(300); }
  T('press and hold on a card picks it up', VW.state().sel.length===1 && VW.state().sel[0]===nm, JSON.stringify(VW.state().sel));
  // picking up the bottom card: the stack sits just above the new bottom card, never below it
  VW.cancelSelection(); await sl(300); VW.snap();
  const last=VW.items(0).length-1; VW.spinTo(last); await sl(600); VW.snap(); await sl(100);
  VW.selectFocused(); await sl(900); VW.snap(); await sl(200);
  // no lane any more: the focus lands on the new last card, on a whole step
  T('a carried card never sits below the last card', VW.state().s===VW.state().n-1, 's='+VW.state().s+' n='+VW.state().n);
  window.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true,clientX:900,clientY:400})); await sl(500); VW.snap();
  T('and scrolling down cannot push it below', VW.state().s===VW.state().n-1, 's='+VW.state().s);
  VW.cancelSelection(); await sl(300);
  // shift + enter picks up whatever is in focus, a folder too, without going into it
  VW.up(); VW.snap(); await sl(300);
  VW.spinTo(VW.items(0).indexOf('Wren Holloway')); await sl(400); VW.snap(); await sl(100);
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true})); await sl(60); ku('Enter'); await sl(300);
  T('shift + enter picks up the folder in focus', P()==='SilverOrchard>Thornvale' && VW.state().sel[0]==='Wren Holloway', P()+' '+JSON.stringify(VW.state().sel));
  VW.cancelSelection(); await sl(300);
  } catch(err) { out.push('FAIL threw :: '+err.message); }
  console.log('RESULTS\n'+out.join('\n'));
})();
