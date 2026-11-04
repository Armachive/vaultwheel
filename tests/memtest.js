(async function(){
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const stage=document.getElementById('stage');
  const pe=(type,x,y,o={})=>{const e=new PointerEvent(type,Object.assign({bubbles:true,clientX:x,clientY:y,button:0,pointerId:11,pointerType:'touch'},o)); (type==='pointerdown'?stage:window).dispatchEvent(e);};
  const dragTo=async(x0,y0,x1,y1,steps,ms)=>{ pe('pointerdown',x0,y0); await sl(16); for(let i=1;i<=steps;i++){ pe('pointermove',x0+(x1-x0)*i/steps,y0+(y1-y0)*i/steps); await sl(ms); } pe('pointerup',x1,y1); };
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true},o)));
  const kid=()=>VW.wheelsInfo().find(w=>w.level===0&&!w.dying);
  const P=()=>VW.state().path.join('>');
  const toast=()=>{const t=document.getElementById('toast'); return t.hidden?'':t.textContent;};
  await sl(1500); VW.snap(); await sl(200);
  // memory: scroll in a folder, go up, come back: it slides out from behind the parent exactly as you left it
  VW.enter('Thornvale'); await sl(1300); VW.snap(); VW.spinTo(3); await sl(500); VW.snap(); await sl(100);
  VW.up(); await sl(100); VW.snap(); await sl(100);
  T('position remembered on the way up', VW.mem().includes('Thornvale:3'), VW.mem().join(' '));
  VW.forward(); await sl(40); let k=kid(), st=VW.state(); let pw=VW.wheelsInfo().find(w=>w.level===1&&!w.dying);
  T('a visited folder is not spun up: it waits past the child slot (not behind the parent), as you left it', k.x>0.3 && st.s===3, JSON.stringify({a:k.alpha,x:k.x,s:st.s}));
  T('and moves in step with the parent, so they never overlap', Math.abs((pw.x-k.x)-(pw.xt-k.xt))<0.03, 'gap '+(pw.x-k.x).toFixed(2)+' want '+(pw.xt-k.xt).toFixed(2));
  await sl(110); k=kid();
  T('it fades in almost at once', k.alpha===1, 'alpha='+k.alpha);
  await sl(600); k=kid();
  T('and lands in the child slot', Math.abs(k.x)<0.05 && VW.state().focus===VW.items(0)[3], 'x='+k.x+' focus='+VW.state().focus);
  // a sibling you have been to: the spin up, landing where you left it
  VW.up(); await sl(100); VW.snap(); VW.enter('Caldor'); await sl(1300); VW.snap(); VW.spinTo(2); await sl(500); VW.snap(); await sl(100);
  VW.switchTo('Thornvale'); await sl(1300); VW.snap(); await sl(100);
  T('switched to the sibling at its remembered spot', P()==='SilverOrchard>Thornvale' && VW.state().s===3, P()+' s='+VW.state().s);
  VW.switchTo('Caldor'); await sl(40); k=kid(); st=VW.state();
  T('a visited sibling spins up from below', k.alpha<0.6 && st.s<0, JSON.stringify({a:k.alpha,s:st.s}));
  await sl(1300); VW.snap(); await sl(100);
  T('and lands where you left it, not at the top', P()==='SilverOrchard>Caldor' && VW.state().s===2, P()+' s='+VW.state().s);
  // clicking the folder you are in, on the parent wheel, steps back out with it in focus
  VW.snap(); await sl(200); let p=VW.screenOf(1,'Caldor');
  if(p){ pe('pointerdown',p.x,p.y); await sl(20); pe('pointerup',p.x,p.y); await sl(300); VW.snap(); await sl(100); }
  T('clicking the current folder on the parent wheel exits it', P()==='SilverOrchard' && VW.state().focus==='Caldor', P()+' focus='+VW.state().focus);
  // keys only
  VW.enter('Thornvale'); await sl(1300); VW.snap(); await sl(100);
  key('ArrowDown',{ctrlKey:true}); await sl(1300); VW.snap(); await sl(100);
  T('ctrl + down jumps to the next sibling folder', P()!=='SilverOrchard>Thornvale' && VW.state().path.length===2, P());
  const ps=VW.wheelsInfo().find(w=>w.level===1); key('ArrowDown',{shiftKey:true}); await sl(400);
  T('shift + down turns the parent wheel without leaving', VW.state().path.length===2, P());
  const f=VW.items(0).find(n=>/\.md$/.test(n)); if(f){ VW.spinTo(VW.items(0).indexOf(f)); await sl(400); VW.snap(); key('Enter',{ctrlKey:true}); await sl(60); window.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true})); await sl(100); }
  T('ctrl + enter opens the focused file', /Opens/.test(toast()), toast());
  key('ArrowLeft'); await sl(300); VW.snap();
  T('left goes up', P()==='SilverOrchard', P());
  // the carried stack never moves while weaving around fast
  VW.enter('Thornvale'); await sl(1300); VW.snap(); VW.selectFocused(); await sl(600); VW.snap();
  // the stack rides the focused card's corner now, so it is judged by how far it swings, not by sitting at x 0
  let lo=Infinity, hi=-Infinity; const look=()=>{ const x=VW.stackX(); if(x!==null){ lo=Math.min(lo,x); hi=Math.max(hi,x); } };
  for(let r=0;r<4;r++){ VW.up(); for(let i=0;i<6;i++){ await sl(30); look(); } VW.forward(); for(let i=0;i<6;i++){ await sl(30); look(); } }
  const moved=hi-lo;
  T('the stack stays put while weaving up and down', moved<0.1 && VW.state().sel.length===1, 'swing '+moved.toFixed(3)+' sel='+VW.state().sel.join(','));
  VW.cancelSelection(); await sl(400); VW.snap();
  // gestures are judged along the directions the tube and wheel have on screen
  VW.up(); await sl(200); VW.enter('Thornvale'); await sl(1300); VW.snap(); await sl(100);
  const d=VW.dirs(); p=VW.screenOf(0,VW.items(0)[1]);
  T('screen directions are not plain up/down and left/right', d && Math.abs(d.spin[0])>0.05 && Math.abs(d.axis[1])>0.05, JSON.stringify(d));
  const s0=VW.state().s;
  await dragTo(p.x,p.y,p.x+d.spin[0]*(d.ppi*1.2+12),p.y+d.spin[1]*(d.ppi*1.2+12),8,20); await sl(3500);
  T('a drag along the wheel direction spins it (a fast flick coasts on, then lands on a card)', P()==='SilverOrchard>Thornvale' && VW.state().s<s0 && Number.isInteger(VW.state().s), P()+' s0='+s0+' s='+VW.state().s);
  await sl(200); VW.snap(); p=VW.screenOf(0,VW.items(0)[1]);
  const sgn=d.axis[0]>0?1:-1;   // toward screen right along the axis is "up"
  await dragTo(p.x,p.y,p.x+sgn*d.axis[0]*60,p.y+sgn*d.axis[1]*60,8,20); await sl(400);
  T('a drag along the tube direction navigates instead', P()==='SilverOrchard', P());
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
