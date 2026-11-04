(async function(){
  // the flipped view (parents on the right) does everything the normal view does, mirrored
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const stage=document.getElementById('stage');
  const pe=(type,x,y,o={})=>{const e=new PointerEvent(type,Object.assign({bubbles:true,clientX:x,clientY:y,button:0,pointerId:9,pointerType:'touch'},o)); (type==='pointerdown'?stage:window).dispatchEvent(e);};
  const tap=async(p,o={})=>{ pe('pointerdown',p.x,p.y,o); await sl(20); pe('pointerup',p.x,p.y,o); };
  const wh=o=>stage.dispatchEvent(new WheelEvent('wheel',Object.assign({bubbles:true,cancelable:true,clientX:700,clientY:400},o)));
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true},o)));
  const kid=()=>VW.wheelsInfo().find(w=>w.level===0&&!w.dying);
  const P=()=>VW.state().path.join('>');
  await sl(1500); VW.snap();
  VW.flipTo(1); for(let i=0;i<60 && VW.view().flip!==1;i++) await sl(50);
  T('view turned over', VW.view().side===-1 && stage.classList.contains('flipped'), JSON.stringify(VW.view()));
  VW.enter('Thornvale'); await sl(1300); VW.snap(); await sl(100);
  const pw=VW.wheelsInfo().find(w=>w.level===1);
  T('the parent wheel sits on the right', pw.xt>0.5, 'parent x '+pw.xt);
  // keys: the arrow toward the parent (right here) goes up, the other goes in
  key('ArrowRight'); await sl(300); VW.snap();
  T('right arrow goes up in the flipped view', P()==='SilverOrchard', P());
  VW.spinTo(VW.items(0).indexOf('Thornvale')); await sl(400); VW.snap();
  key('ArrowLeft'); await sl(300); VW.snap();
  T('left arrow goes into the focused folder', P()==='SilverOrchard>Thornvale', P());
  // shift + sideways scroll and trackpad swipes are mirrored too
  await sl(300);
  wh({deltaX:120,shiftKey:true}); await sl(300); VW.snap();
  T('shift + scroll right goes up', P()==='SilverOrchard', P());
  await sl(200); VW.spinTo(VW.items(0).indexOf('Thornvale')); await sl(400); VW.snap();
  wh({deltaX:-120,shiftKey:true}); await sl(300); VW.snap();
  T('shift + scroll left goes in', P()==='SilverOrchard>Thornvale', P());
  await sl(400);
  for(let i=0;i<6;i++){ wh({deltaX:30}); await sl(16); }
  T('trackpad swipe right to left goes up', P()==='SilverOrchard', P());
  await sl(500); VW.snap();
  // a visited folder pans in from the child side in step with the parent
  VW.spinTo(VW.items(0).indexOf('Thornvale')); await sl(400); VW.snap(); await sl(100);
  VW.forward(); await sl(40); let k=kid(); const p1=VW.wheelsInfo().find(w=>w.level===1&&!w.dying);
  T('a visited folder waits on the child side (left here), not behind the parent', k.x< -0.3, 'x='+k.x);
  T('and moves in step with the parent', Math.abs((p1.x-k.x)-(p1.xt-k.xt))<0.03, 'gap '+(p1.x-k.x).toFixed(2)+' want '+(p1.xt-k.xt).toFixed(2));
  await sl(800); VW.snap();
  // touch: dragging toward the child side goes up
  const d=VW.dirs(), q=VW.screenOf(0,VW.items(0)[1]);
  const sgn=d.axis[0]<0?1:-1;
  pe('pointerdown',q.x,q.y); for(let i=1;i<=8;i++){ pe('pointermove',q.x+sgn*d.axis[0]*8*i,q.y+sgn*d.axis[1]*8*i); await sl(20); } pe('pointerup',q.x+sgn*d.axis[0]*64,q.y+sgn*d.axis[1]*64);
  await sl(400); VW.snap();
  T('a touch drag toward the parent side goes up', P()==='SilverOrchard', P()+' axis '+JSON.stringify(d.axis));
  VW.enter('Thornvale'); await sl(1300); VW.snap(); await sl(100);
  // clicks: a sibling folder on the parent wheel opens in one click
  const sib=VW.items(1)[VW.items(1).indexOf('Thornvale')+1]; let p=VW.screenOf(1,sib);
  if(p){ await tap(p); await sl(1300); VW.snap(); await sl(200); }
  T('one click on a parent-wheel folder opens it', P()==='SilverOrchard>'+sib, P()+' want '+sib);
  key('ArrowRight'); await sl(300); VW.snap(); VW.enter('Thornvale'); VW.enter('Wren Holloway'); await sl(1300); VW.snap(); await sl(200);
  // press and hold picks a card up, and a carried card never goes below the last one
  const nm=VW.items(0)[2]; VW.spinTo(2); await sl(400); VW.snap(); await sl(200);
  p=VW.screenOf(0,nm);
  if(p){ pe('pointerdown',p.x,p.y); await sl(700); pe('pointerup',p.x,p.y); await sl(300); }
  T('press and hold picks a card up', VW.state().sel.length===1 && VW.state().sel[0]===nm, JSON.stringify(VW.state().sel));
  VW.cancelSelection(); await sl(300); VW.snap();
  const last=VW.items(0).length-1; VW.spinTo(last); await sl(600); VW.snap(); await sl(100);
  VW.selectFocused(); await sl(900); VW.snap(); await sl(200);
  // no lane any more: the focus lands on the new last card, on a whole step
  T('a carried card never sits below the last card', VW.state().s===VW.state().n-1, 's='+VW.state().s+' n='+VW.state().n);
  // a tap of Enter while carrying opens the playground; Esc leaves it with everything still carried
  key('Enter'); await sl(60); window.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true})); await sl(400);
  T('Enter while carrying opens the playground', VW.stackView().open, JSON.stringify(VW.stackView()));
  key('Escape'); await sl(300);
  VW.cancelSelection(); await sl(300); VW.snap();
  // shift-click a folder on the parent wheel: it flies into the stack and you stay where you are
  // (the folder just under the lane faces the camera; ones near the top of the column are partly covered by their neighbours)
  const fold=VW.items(1)[VW.items(1).indexOf('Wren Holloway')+1];
  p=fold && VW.screenOf(1,fold);
  if(p){ await tap(p,{shiftKey:true}); await sl(1300); VW.snap(); await sl(300); }
  T('shift-click on a parent folder picks it up without going there', P()==='SilverOrchard>Thornvale>Wren Holloway' && VW.state().sel.includes(fold), P()+' '+JSON.stringify(VW.state().sel));
  // and a hold on the stack puts everything back, the same in the mirrored view
  const qs=VW.stackScreen(); pe('pointerdown',qs.x,qs.y); await sl(650); pe('pointerup',qs.x,qs.y); await sl(300);
  T('holding the stack puts everything back', !VW.stackView().open && VW.state().sel.length===0, JSON.stringify(VW.state().sel));
  key('Escape'); await sl(300);
  VW.cancelSelection(); await sl(300); VW.up(); await sl(300); VW.snap();
  // a flick coasts and lands on a card
  VW.snap(); const d2=VW.dirs(), q2=VW.screenOf(0,VW.items(0)[0]);
  pe('pointerdown',q2.x,q2.y); for(let i=1;i<=4;i++){ pe('pointermove',q2.x-d2.spin[0]*30*i,q2.y-d2.spin[1]*30*i); await sl(16); } pe('pointerup',q2.x-d2.spin[0]*120,q2.y-d2.spin[1]*120);
  await sl(3500);
  T('a flick coasts and lands on a card', Number.isInteger(VW.state().s) && P()==='SilverOrchard>Thornvale', 's='+VW.state().s+' '+P());
  // a scaled column is packed once per view move, as the move starts: not again when the side changes, nor when it lands
  VW.setScale(0.7); await sl(600);
  const lands=async t=>{ const p0=kid().packs; VW.flipTo(t); for(let i=0;i<100 && VW.view().flip!==t;i++) await sl(40); await sl(800); return kid().packs-p0; };
  await lands(0);
  for(const t of [0.5,1,0.5,0,0.5,0]) { const n=await lands(t); T('view move to '+t+' packs the scaled column once', n===1, 'packed '+n); }
  const s0=VW.view().side, n01=await lands(1); T('straight across to the mirrored view packs it once', n01===1 && VW.view().side===-s0, 'packed '+n01+' side '+VW.view().side);
  await lands(0); VW.setScale(0); await sl(400);
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
