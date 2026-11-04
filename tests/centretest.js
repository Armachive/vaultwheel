(async function(){
  // the centre view: straight on to the content column, only that column, swipes either way go up a level
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const stage=document.getElementById('stage'), W=stage.clientWidth, H=stage.clientHeight, top=stage.getBoundingClientRect().top;
  const pe=(type,x,y,o={})=>{const e=new PointerEvent(type,Object.assign({bubbles:true,clientX:x,clientY:y,button:0,pointerId:9,pointerType:'mouse'},o)); (type==='pointerdown'?stage:window).dispatchEvent(e);};
  const dragTo=async(x0,y0,x1,y1,steps,ms)=>{ pe('pointerdown',x0,y0); await sl(16); for(let i=1;i<=steps;i++){ pe('pointermove',x0+(x1-x0)*i/steps,y0+(y1-y0)*i/steps); await sl(ms); } };
  const wh=o=>stage.dispatchEvent(new WheelEvent('wheel',Object.assign({bubbles:true,cancelable:true,clientX:W/2,clientY:top+H/2},o)));
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true},o)));
  const keyUp=k=>window.dispatchEvent(new KeyboardEvent('keyup',{key:k,bubbles:true}));
  const P=()=>VW.state().path.join('>');
  const until=async(f,ms=3000)=>{ for(let i=0;i<ms/40 && !f();i++) await sl(40); return f(); };
  const parentX=()=>{ const p=VW.wheelsInfo().find(w=>w.level===1&&!w.dying); return p?p.xt:null; };
  await sl(1500); VW.enter('Thornvale'); VW.snap(); await sl(600);

  // in from the default view, no turning over on the way or at rest
  const sides=new Set(); VW.flipTo(0.5);
  for(let i=0;i<60;i++){ sides.add(VW.view().side); await sl(40); }
  let v=VW.view();
  T('flipTo(0.5) lands on the centre view', v.flip===0.5 && v.target===0.5 && v.centre===1 && stage.classList.contains('centre'), JSON.stringify(v));
  T('the side is kept from the default view and never turns over', v.side===1 && sides.size===1 && !stage.classList.contains('flipped'), [...sides].join(','));
  T('the directory columns are hidden', v.vis===0, 'vis='+v.vis);
  T('the camera looks straight on', Math.abs(v.dir[0])<0.005 && Math.abs(v.cam[0])<0.005, JSON.stringify(v.dir)+' '+JSON.stringify(v.cam));

  // straight on: the focus card is in the middle across and level
  VW.snap(); await sl(500);
  const f0=VW.state().focus, p0=VW.screenOf(0,f0), r0=VW.cardRect(0,f0);
  T('the focus card is in the middle across', p0 && Math.abs(p0.x-W/2)<W*0.02, JSON.stringify(p0));
  T('the focus card is level', r0 && Math.abs(r0[0][1]-r0[1][1])<1 && Math.abs(r0[2][1]-r0[3][1])<1, JSON.stringify(r0));

  // framing on a few screen shapes
  let cp=VW.centrePose();
  T('wide screen: the card about 15% tall, the column about a third wide', cp.card>=0.13 && cp.card<=0.17 && cp.fill>=0.26 && cp.fill<=0.42, JSON.stringify(cp));
  const cam=VW.camera();
  T('nothing on the front of the tube is fogged', cam.fog[0]>Math.sqrt(cp.D*cp.D-VW.T.R*VW.T.R), JSON.stringify(cam.fog)+' D='+cp.D);
  const mist=document.getElementById('mist').style.backgroundImage;
  T('the far end mist is off the screen', /transparent 108%, var\(--mist\) 140%/.test(mist), mist.slice(-90));
  T('no side blur', getComputedStyle(document.getElementById('sideBlur')).display==='none', getComputedStyle(document.getElementById('sideBlur')).display);
  stage.style.width='390px'; stage.style.height='844px'; dispatchEvent(new Event('resize')); await sl(600);
  cp=VW.centrePose();
  T('phone: the column fills the width, the card still readable', cp.fill>=0.90 && cp.fill<=0.97 && cp.card>=0.09, JSON.stringify(cp));
  stage.style.width='1024px'; stage.style.height='768px'; dispatchEvent(new Event('resize')); await sl(600);
  cp=VW.centrePose();
  T('4:3: the card about 15% tall, the column about half wide', cp.card>=0.13 && cp.card<=0.17 && cp.fill>=0.42 && cp.fill<=0.52, JSON.stringify(cp));
  stage.style.width=''; stage.style.height=''; dispatchEvent(new Event('resize')); await sl(800); VW.snap(); await sl(300);

  // the hidden parent column cannot be tapped or spun
  const pp=VW.screenOf(1,'Thornvale');
  if(pp){ pe('pointerdown',pp.x,pp.y); await sl(30); pe('pointerup',pp.x,pp.y); await sl(600); }
  T('a tap where the hidden parent card is does nothing', pp && P()==='SilverOrchard>Thornvale', P()+' '+JSON.stringify(pp));
  VW.spinTo(2); await sl(500); VW.snap();
  const ps0=VW.rows().find(r=>r.level===1).s, cs0=VW.state().s;
  if(pp){ await dragTo(pp.x,pp.y,pp.x+6,pp.y-160,8,30); pe('pointerup',pp.x+6,pp.y-160); await sl(900); }
  T('a vertical drag there spins the content column, not the parent', VW.state().s!==cs0 && VW.rows().find(r=>r.level===1).s===ps0 && P()==='SilverOrchard>Thornvale', 's '+cs0+' -> '+VW.state().s+' parent '+ps0+' -> '+VW.rows().find(r=>r.level===1).s);
  VW.spinTo(0); await sl(500); VW.snap();

  // scale: the column widens to the screen's full width
  for(let i=0;i<5;i++){ key('ArrowDown',{altKey:true}); await sl(60); }
  await sl(900);
  let sh=VW.shape(0), rm=VW.room();
  T('scaled 25%, the column is as wide as the screen allows', rm.centre===true && Math.abs(sh.width-rm.full)<rm.full*0.02 && rm.full>VW.T.CARD_W*1.5, 'width '+sh.width.toFixed(3)+' full '+(rm.full||0).toFixed(3));
  const pl=VW.places().filter(q=>Math.abs(q.y-VW.places()[0].y)<1e-4);
  T('a row keeps the side view\'s order (nothing turns round on the way in)', pl.length<2 || (pl[0].x-pl[1].x)*VW.view().side>0, JSON.stringify(pl.map(q=>q.x.toFixed(2))));
  for(let i=0;i<5;i++){ key('ArrowUp',{altKey:true}); await sl(60); }
  await sl(900);
  T('and back to a plain column', VW.shape(0).width===VW.T.CARD_W, 'width '+VW.shape(0).width);

  // swipes: either way goes up, the parent on the side it came in from
  VW.enter('Wren Holloway'); VW.snap(); await sl(600); VW.snap();
  let q=VW.screenOf(0,VW.state().focus);
  await dragTo(q.x,q.y,q.x+120,q.y+4,8,16); pe('pointerup',q.x+120,q.y+4); await sl(800); VW.snap(); await sl(200);
  v=VW.view();
  T('a swipe right goes up with the parent on the left', P()==='SilverOrchard>Thornvale' && v.side===1 && parentX()<0 && v.target===0.5, P()+' side '+v.side+' parent x '+parentX());
  key('Enter'); await sl(60); keyUp('Enter'); await sl(800); VW.snap(); await sl(200);
  T('Enter goes back into the folder', P()==='SilverOrchard>Thornvale>Wren Holloway', P());
  q=VW.screenOf(0,VW.state().focus);
  await dragTo(q.x,q.y,q.x-120,q.y+4,8,16); pe('pointerup',q.x-120,q.y+4); await sl(800); VW.snap(); await sl(200);
  v=VW.view();
  T('a swipe left goes up with the parent on the right', P()==='SilverOrchard>Thornvale' && v.side===-1 && parentX()>0 && stage.classList.contains('flipped') && v.target===0.5, P()+' side '+v.side+' parent x '+parentX());
  const fl=VW.screenOf(0,VW.state().focus);
  T('the column stays in the middle', fl && Math.abs(fl.x-W/2)<W*0.02, JSON.stringify(fl));

  // trackpad swipes
  VW.enter('Wren Holloway'); VW.snap(); await sl(600);
  for(let i=0;i<6;i++){ wh({deltaX:30}); await sl(16); }
  await sl(500); v=VW.view();
  T('a trackpad swipe one way goes up, parent on the right', P()==='SilverOrchard>Thornvale' && v.side===-1, P()+' side '+v.side);
  VW.enter('Wren Holloway'); VW.snap(); await sl(600);
  for(let i=0;i<6;i++){ wh({deltaX:-30}); await sl(16); }
  await sl(500); v=VW.view();
  T('and the other way, parent on the left', P()==='SilverOrchard>Thornvale' && v.side===1, P()+' side '+v.side);
  VW.enter('Wren Holloway'); VW.snap(); await sl(600);
  wh({deltaX:120,shiftKey:true}); await sl(400); v=VW.view();
  T('shift + scroll sideways goes up too', P()==='SilverOrchard>Thornvale' && v.side===-1, P()+' side '+v.side);

  // arrow keys
  VW.enter('Wren Holloway'); VW.snap(); await sl(600);
  key('ArrowLeft'); await sl(500); v=VW.view();
  T('ArrowLeft goes up with the parent on the left', P()==='SilverOrchard>Thornvale' && v.side===1, P()+' side '+v.side);
  VW.enter('Wren Holloway'); VW.snap(); await sl(600);
  key('ArrowRight'); await sl(500); v=VW.view();
  T('ArrowRight goes up with the parent on the right', P()==='SilverOrchard>Thornvale' && v.side===-1, P()+' side '+v.side);
  // in a collage the arrows move along the row first
  for(let i=0;i<11;i++){ key('ArrowDown',{altKey:true}); await sl(60); }
  await sl(1200); VW.snap(); await sl(300);
  const pls=VW.places(), fn=VW.state().focus, fp=pls.find(x=>x.name===fn);
  const leftOf=fp && pls.some(x=>Math.abs(x.y-fp.y)<1e-4 && x.x<fp.x-1e-4);
  key(leftOf?'ArrowLeft':'ArrowRight'); await sl(400);
  T('in a collage a sideways arrow moves along the row', VW.shape(0).stops && P()==='SilverOrchard>Thornvale' && VW.state().focus!==fn, 'focus '+fn+' -> '+VW.state().focus+' '+P());
  for(let i=0;i<11;i++){ key('ArrowUp',{altKey:true}); await sl(60); }
  await sl(1000); VW.snap();

  // the stack sits on the focus card's corner on the parents' side
  VW.flipTo(0); await until(()=>VW.view().flip===0); VW.flipTo(0.5); await until(()=>VW.view().flip===0.5);
  VW.enter('Wren Holloway'); VW.snap(); await sl(600);
  VW.selectFocused(); await sl(900); VW.snap(); await sl(300);
  let ss=VW.stackScreen(), fc=VW.screenOf(0,VW.state().focus);
  T('the stack sits left of the focus card with the parents on the left', ss && fc && VW.view().side===1 && ss.x<fc.x-20, JSON.stringify(ss)+' '+JSON.stringify(fc));
  q=fc; await dragTo(q.x,q.y,q.x-120,q.y+4,8,16); pe('pointerup',q.x-120,q.y+4); await sl(1000); VW.snap(); await sl(300);
  ss=VW.stackScreen(); fc=VW.screenOf(0,VW.state().focus);
  T('after a swipe left it sits right of it', ss && fc && VW.view().side===-1 && ss.x>fc.x+20 && VW.state().sel.length===1, JSON.stringify(ss)+' '+JSON.stringify(fc)+' sel '+VW.state().sel.length);
  // an empty folder: the stack sits on the crying gif, never on the hidden folder card
  VW.up(); VW.snap(); await sl(400);
  VW.enter('Tessara'); VW.snap(); await sl(500); VW.enter('Tessaran Collection'); VW.snap(); await sl(1200);
  const cry=VW.cry(), cr=document.getElementById('cry').getBoundingClientRect(); ss=VW.stackScreen();
  const ghost=VW.screenOf(1,'Tessaran Collection');
  T('an empty folder in the centre shows the crying gif', cry.on && cry.dir==='Tessaran Collection', JSON.stringify(cry));
  // (the parents are on the right here, after the swipe left)
  const cx=VW.view().side>0?cr.left:cr.right;
  T('the stack sits on the gif\'s top corner on the parents\' side', ss && cr.width>0 && Math.abs(ss.x-cx)<40 && ss.y>cr.top-70 && ss.y<cr.top+cr.height*0.3,
    JSON.stringify(ss)+' side '+VW.view().side+' gif '+[cr.left,cr.top,cr.width,cr.height].map(Math.round).join(','));
  T('not where the hidden folder card is', !ghost || Math.hypot(ss.x-ghost.x,ss.y-ghost.y)>60, JSON.stringify(ghost));
  VW.cancelSelection(); await sl(400); VW.up(); VW.up(); VW.snap(); await sl(400); VW.enter('Thornvale'); VW.snap(); await sl(500);

  // out by keys: one view a press, a full turn passes through the centre
  key('ArrowRight',{ctrlKey:true,shiftKey:true}); await until(()=>VW.view().flip===1); v=VW.view();
  T('ctrl + shift + right from the centre lands on the mirrored view', v.flip===1 && v.side===-1, JSON.stringify(v));
  key('ArrowLeft',{ctrlKey:true,shiftKey:true}); await sl(100); const mid=VW.view(); await until(()=>VW.view().flip===0.5);
  key('ArrowLeft',{ctrlKey:true,shiftKey:true}); await until(()=>VW.view().flip===0); v=VW.view();
  T('ctrl + shift + left twice goes back through the centre to the default view', mid.target===0.5 && v.flip===0 && v.side===1, 'mid '+JSON.stringify(mid)+' end '+JSON.stringify(v));

  // out and in by drag
  VW.flipTo(0.5); await until(()=>VW.view().flip===0.5); VW.snap(); await sl(300);
  await dragTo(W-24,top+H-24,W-24-W*0.28,top+H-30,10,16); pe('pointerup',W-24-W*0.28,top+H-30); await sl(1500); v=VW.view();
  T('a drag left from the bottom right corner leaves the centre for the default view', v.target===0 && v.flip===0, JSON.stringify(v));
  await dragTo(24,top+H-24,24+W*0.28,top+H-30,10,16); pe('pointerup',24+W*0.28,top+H-30); await sl(1500); v=VW.view();
  T('a drag right from the bottom left corner in the default view stops in the centre', v.target===0.5 && v.flip===0.5, JSON.stringify(v));
  VW.spinTo(2); await sl(500); VW.snap(); const s2=VW.state().s;
  await dragTo(W-30,top+H-30,W-34,top+H-200,8,30); pe('pointerup',W-34,top+H-200); await sl(1200); v=VW.view();
  T('a vertical drag from a bottom corner spins the column and leaves the view', v.target===0.5 && v.flip===0.5 && VW.state().s!==s2, JSON.stringify(v)+' s '+s2+' -> '+VW.state().s);

  // the move in and out keeps the focus card framed: it slides straight between where the side view has it and the
  // middle, never off the screen or down under the rim mist (on a phone it used to swing right off the side)
  const framed=async to=>{ VW.flipTo(to); let worst=0, at=''; for(let i=0;i<18;i++){ await sl(40); const c=VW.screenOf(0,VW.state().focus), r=stage.getBoundingClientRect(); if(!c) continue;
    const fx=(c.x-r.left)/r.width, fy=(c.y-r.top)/r.height, d=Math.max(Math.abs(fx-0.5),Math.abs(fy-0.5)); if(d>worst){ worst=d; at=VW.view().flip+' at '+fx.toFixed(2)+','+fy.toFixed(2); } } return [worst,at]; };
  VW.flipTo(0); await until(()=>VW.view().flip===0); VW.snap();
  let fr=[await framed(0.5), await framed(1)];
  stage.style.width='390px'; stage.style.height='780px'; dispatchEvent(new Event('resize')); await sl(400);
  fr.push(await framed(0.5), await framed(0));
  // and resized back while on the way into the centre view, it lands straight on with the focus in the middle
  stage.style.width=''; stage.style.height=''; dispatchEvent(new Event('resize')); VW.flipTo(0.5); await until(()=>VW.view().flip===0.5); await sl(300); VW.snap();
  v=VW.view(); q=VW.screenOf(0,VW.state().focus);
  T('the focus card stays framed in and out on a wide screen and a phone, and after a resize it is straight on in the middle', fr.every(x=>x[0]<0.2) && Math.abs(v.dir[0])<0.005 && q && Math.abs(q.x-W/2)<W*0.02 && Math.abs(q.y-top-H/2)<H*0.04,
    JSON.stringify(fr)+' '+JSON.stringify(v.dir)+' '+JSON.stringify(q));

  // with the directory columns hidden the whole tube is the content column's: Alt + scroll beside a narrow column scales
  // it, its tooltip sits clear of the card, and scaled the scene comes to rest in the centre and mirrored views
  const ws=o=>stage.dispatchEvent(new WheelEvent('wheel',Object.assign({bubbles:true,cancelable:true,clientX:W*0.12,clientY:top+H*0.5},o)));
  for(let i=0;i<5;i++){ ws({deltaY:100,altKey:true}); await sl(40); }
  await sl(700);
  const scaled=Math.abs(VW.dirSettings().u-0.25)<0.01 && Math.abs(VW.shape(0).width-VW.room().full)<VW.room().full*0.02;
  const rest0=await until(()=>!VW.busy().length,2000) ? [] : VW.busy();
  q=VW.screenOf(0,VW.state().focus); pe('pointermove',q.x,q.y); await sl(700);
  const tipEl=document.getElementById('tip'), tr=tipEl.getBoundingClientRect(), cR=VW.cardRect(0,VW.state().focus), xs=cR.map(p=>p[0]), ys=cR.map(p=>p[1]);
  const clear=!tipEl.hidden && (tr.right<=Math.min(...xs)+2 || tr.left>=Math.max(...xs)-2 || tr.bottom<=Math.min(...ys)+2 || tr.top>=Math.max(...ys)-2);
  pe('pointermove',W/2,top+4); VW.flipTo(1); await until(()=>VW.view().flip===1); await sl(600);
  const rest1=await until(()=>!VW.busy().length,2000) ? [] : VW.busy();
  T('Alt + scroll beside the column scales it, the tooltip is clear of the card, and scaled it comes to rest centred and mirrored', scaled && clear && !rest0.length && !rest1.length,
    JSON.stringify({u:VW.dirSettings().u,w:VW.shape(0).width,full:VW.room().full,tip:[tr.left,tr.top,tr.width,tr.height].map(Math.round),card:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)].map(Math.round),rest0,rest1}));
  VW.flipTo(0.5); await until(()=>VW.view().flip===0.5);
  // two quick swipes the opposite ways: up twice, the parent on the side of the last one, nothing left mid way
  VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  q=VW.screenOf(0,VW.state().focus);
  await dragTo(q.x,q.y,q.x+120,q.y+4,6,16); pe('pointerup',q.x+120,q.y+4); await sl(60);
  await dragTo(q.x,q.y,q.x-120,q.y+4,6,16); pe('pointerup',q.x-120,q.y+4); await sl(1000);
  const wi=VW.wheelsInfo().filter(w=>!w.dying), c0=wi.find(w=>w.level===0), p1=wi.find(w=>w.level===1);
  T('two quick swipes the opposite ways go up twice, the parent on the last swipe\'s side', P()==='SilverOrchard' && VW.view().side===-1 && c0 && Math.abs(c0.x)<0.05 && (!p1 || p1.x>0) && VW.wheelsInfo().every(w=>!w.dying),
    P()+' '+JSON.stringify(VW.wheelsInfo()));
  VW.enter('Thornvale'); VW.snap(); await sl(300);
  VW.flipTo(0); await until(()=>VW.view().flip===0);
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
