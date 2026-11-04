(async function(){
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const stage=document.getElementById('stage'), W=stage.clientWidth, H=stage.clientHeight, top=stage.getBoundingClientRect().top;
  const pe=(type,x,y,o={})=>{const e=new PointerEvent(type,Object.assign({bubbles:true,clientX:x,clientY:y,button:0,pointerId:9,pointerType:'mouse'},o)); (type==='pointerdown'?stage:window).dispatchEvent(e);};
  const dragTo=async(x0,y0,x1,y1,steps,ms)=>{ pe('pointerdown',x0,y0); await sl(16); for(let i=1;i<=steps;i++){ pe('pointermove',x0+(x1-x0)*i/steps,y0+(y1-y0)*i/steps); await sl(ms); } };
  const wh=o=>stage.dispatchEvent(new WheelEvent('wheel',Object.assign({bubbles:true,cancelable:true,clientX:900,clientY:400},o)));
  const P=()=>VW.state().path.join('>');
  await sl(1500); VW.enter('Thornvale'); VW.snap(); await sl(600);
  // the view flip through the api
  const cam0=VW.view().cam.slice(); const px0=VW.wheelsInfo().find(w=>w.level===1).x;
  VW.flipTo(1); await sl(1400); let v=VW.view();
  const px1=VW.wheelsInfo().find(w=>w.level===1).x;
  T('flip lands on the mirrored view', v.flip===1 && v.side===-1, JSON.stringify(v));
  // mirrored, the camera swings to the other side, backing off only as far as it takes to show where the focus card's name starts
  T('camera swings to the other side', v.cam[0]*cam0[0]<=0, cam0[0]+' -> '+v.cam[0]);
  T('the start of the focus card\'s name is on screen, mirrored too', VW.nameStart()>0.03, 'left end at '+VW.nameStart().toFixed(3)+' of the width');
  T('parent wheel is on the other side', px0<0 && px1>0, px0+' -> '+px1);
  T('still the same folder', P()==='SilverOrchard>Thornvale' && VW.state().focus===VW.items(0)[0], P()+' '+VW.state().focus);
  VW.flipTo(0); await sl(1400); v=VW.view();
  T('flip back', v.flip===0 && v.side===1 && VW.wheelsInfo().find(w=>w.level===1).x<0, JSON.stringify(v));
  T('and the camera is exactly where it was', v.cam.every((c,i)=>Math.abs(c-cam0[i])<1e-3), JSON.stringify(cam0)+' -> '+JSON.stringify(v.cam));
  // dragging from the dead space (bottom left corner in the normal view) turns it over; a tap there does nothing
  pe('pointerdown',24,top+H-24); await sl(16); pe('pointerup',24,top+H-24); await sl(100);
  T('a tap on the dead space does nothing', VW.view().flip===0 && P()==='SilverOrchard>Thornvale', JSON.stringify(VW.view()));
  await dragTo(24,top+H-24,24+W*0.42,top+H-60,10,16);
  const mid=VW.view(); T('the view follows the hand', mid.flip>0.5 && mid.flip<1.05, 'flip='+mid.flip);
  pe('pointerup',24+W*0.42,top+H-60); await sl(1500); v=VW.view();
  T('let go past half: it clicks over', v.target===1 && v.flip===1, JSON.stringify(v));
  // and from the other corner, back
  await dragTo(W-24,top+H-24,W-24-W*0.42,top+H-60,10,16); pe('pointerup',W-24-W*0.42,top+H-60); await sl(1500); v=VW.view();
  T('drag from the bottom right corner brings it back', v.target===0 && v.flip===0, JSON.stringify(v));
  // a short drag that does not get near the centre view springs back
  await dragTo(24,top+H-24,24+W*0.05,top+H-40,6,16); pe('pointerup',24+W*0.05,top+H-40); await sl(1500); v=VW.view();
  T('a short drag springs back', v.target===0 && v.flip===0, JSON.stringify(v));
  // a longer one stops in the centre view, then back to the default view by keys
  await dragTo(24,top+H-24,24+W*0.12,top+H-40,6,16); pe('pointerup',24+W*0.12,top+H-40); await sl(1500); v=VW.view();
  T('a drag about a quarter of the way stops in the centre view', v.target===0.5 && v.flip===0.5, JSON.stringify(v));
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',ctrlKey:true,shiftKey:true,bubbles:true})); await sl(1500); v=VW.view();
  T('ctrl + shift + left goes back to the default view', v.target===0 && v.flip===0 && v.side===1, JSON.stringify(v));
  // subtle camera tilt while a wheel is dragged, eased out after
  VW.snap(); await sl(200);
  let p=VW.screenOf(0,VW.items(0)[1]);
  await dragTo(p.x,p.y,p.x+50,p.y+150,8,30); const tl=VW.view().tilt;
  T('camera tilts a little during a wheel drag', Math.hypot(tl[0],tl[1])>0.003 && Math.hypot(tl[0],tl[1])<0.06, JSON.stringify(tl));
  pe('pointerup',p.x+50,p.y+150); await sl(900); const tl2=VW.view().tilt;
  T('and eases back after', Math.abs(tl2[0])<0.002 && Math.abs(tl2[1])<0.002, JSON.stringify(tl2));
  await sl(400); VW.spinTo(0); await sl(300); VW.snap(); await sl(200);
  T('that drag only spun the wheel', P()==='SilverOrchard>Thornvale' && VW.state().s===0, P()+' s='+VW.state().s);
  // focus lead: a card a third of the way in already counts as in focus
  const dd=VW.dirs(); p=VW.screenOf(0,VW.items(0)[0]);
  const L=0.42*dd.ppi+11, ex=p.x-dd.spin[0]*L, ey=p.y-dd.spin[1]*L;   // pull the card toward the previous slot: the next entry rises 0.42 of the way in
  await dragTo(p.x,p.y,ex,ey,8,30); await sl(60);
  const fl=VW.focusLead();
  T('a card about 40% of the way in is already the focus', fl && fl.s>0.34 && fl.s<0.5 && fl.fi===1 && VW.state().focus===VW.items(0)[1], JSON.stringify(fl)+' focus='+VW.state().focus+' ppi='+dd.ppi.toFixed(1));
  await sl(300); const fl2=VW.focusLead();
  T('and stays the focus when the drag pauses', fl2.fi===1, JSON.stringify(fl2));
  pe('pointerup',ex,ey); await sl(600);
  T('release lands on it', VW.state().s===1, 's='+VW.state().s);
  // spring snap: no overshoot
  const s0=VW.state().s; wh({deltaY:100}); let over=0, under=0;
  for(let i=0;i<10;i++){ await sl(20); over=Math.max(over,VW.state().s-(s0+1)); }
  await sl(300);
  T('spring lands without overshoot', over<=1e-4 && Math.abs(VW.state().s-(s0+1))<0.01, 'over='+over.toFixed(4)+' s='+VW.state().s.toFixed(3));
  // a long sideways drag walks several rungs
  VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  await dragTo(700,400,700+120,406,8,16); pe('pointerup',820,406); await sl(400);
  T('an ordinary swipe is one rung', P()==='SilverOrchard>Thornvale', P());
  await sl(300); VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  await dragTo(200,400,200+W*0.75,406,10,16); pe('pointerup',200+W*0.75,406); await sl(400);
  T('a swipe past half the screen walks two rungs', P()==='SilverOrchard', P());
  // a drag off the tube but outside the bottom corners does not turn the view over
  VW.snap(); await sl(200);
  await dragTo(10,top+H*0.62,210,top+H*0.62,8,16); pe('pointerup',210,top+H*0.62); await sl(1200);
  T('a drag off the tube away from the corners leaves the view alone', VW.view().flip===0, JSON.stringify(VW.view()));
  // forward opens the folder in focus, not the one you last came up from
  VW.snap(); VW.enter('Caldor'); VW.snap(); await sl(300); VW.up(); VW.snap(); await sl(300);
  const ti=VW.items(0).indexOf('Patterns'); VW.spinTo(ti); await sl(400); VW.snap(); await sl(100);
  VW.forward(); await sl(200);
  T('forward opens the folder in focus, not the last one left', P()==='SilverOrchard>Patterns', P());
  VW.up(); VW.snap(); await sl(300);
  await sl(400); VW.snap();
  // the carried files view
  VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  VW.spinTo(2); await sl(400); VW.snap(); VW.selectFocused(); await sl(500); VW.snap();
  const second=VW.items(0)[3]; VW.shiftSelect(0,second); await sl(900); VW.snap(); await sl(200);
  VW.openStackView(); await sl(100); let sv=VW.stackView();
  T('stack view opens with every carried file', sv.open && sv.cards===2, JSON.stringify(sv)+' sel='+VW.state().sel.join(','));
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await sl(100);
  T('Escape closes it and keeps the selection', !VW.stackView().open && VW.state().sel.length===2, JSON.stringify(VW.stackView())+' sel='+VW.state().sel.length);
  VW.openStackView(); await sl(60); VW.up(); await sl(100);
  T('navigating closes it', !VW.stackView().open && P()==='SilverOrchard>Thornvale', P());
  VW.cancelSelection(); await sl(300);

  // the centre view, lean: nothing eases for the hidden directory columns, both view sets are ready after a resize, the
  // side is kept for the session, and a tooltip in a scaled row stays off its neighbours
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true},o)));
  const until=async(f,ms=3000)=>{ for(let i=0;i<ms/40 && !f();i++) await sl(40); return f(); };
  let q;
  VW.flipTo(0.5); await until(()=>VW.view().flip===0.5); await sl(400);
  key('ArrowDown',{altKey:true}); await sl(200);
  const dirs=VW.wheelsInfo().filter(w=>w.level>0&&!w.dying);
  T('in the centre a scale step leaves the hidden columns where they belong', dirs.length && dirs.every(w=>Math.abs(w.x-w.xt)<1e-3), JSON.stringify(dirs));
  key('ArrowUp',{altKey:true}); await sl(600);
  // resized in the centre and straight out: the side view's numbers are there at once, not the centre's
  stage.style.width='1100px'; dispatchEvent(new Event('resize')); await sl(500);
  VW.flipTo(0); await sl(80); const rs=VW.room();
  await until(()=>VW.view().flip===0); await sl(400); const rs2=VW.room();
  T('after a resize in the centre, leaving it has the side numbers at once', !rs.centre && rs.pushMax>0.05 && Math.abs(rs2.pushMax-rs.pushMax)<0.02 && Math.abs(rs2.outer-rs.outer)<0.02, JSON.stringify({now:[rs.pushMax,rs.outer],rest:[rs2.pushMax,rs2.outer]}));
  stage.style.width=''; dispatchEvent(new Event('resize')); await sl(500);
  // the side is kept for the session with the view, so a reload after a swipe keeps the parents where they were
  VW.flipTo(0.5); await until(()=>VW.view().flip===0.5); await sl(300);
  VW.enter('Wren Holloway'); VW.snap(); await sl(600);
  key('ArrowRight'); await sl(900);
  T('the side is remembered for the session', VW.view().side===-1 && sessionStorage.getItem('vw.side')==='-1' && sessionStorage.getItem('vw.view')==='centre', VW.view().side+' '+sessionStorage.getItem('vw.side'));
  // in a scaled row of several the tooltip covers none of the row's cards
  for(let i=0;i<10;i++){ key('ArrowDown',{altKey:true}); await sl(60); } await sl(1200); VW.snap(); await sl(300);
  const rpl=VW.places(), rf=VW.state().focus, rme=rpl.find(p=>p.name===rf), row=rpl.filter(p=>Math.abs(p.y-rme.y)<1e-4);
  q=VW.screenOf(0,rf); pe('pointermove',q.x,q.y); await sl(900);
  const rt=document.getElementById('tip'), rtr=rt.getBoundingClientRect();
  const hits=row.map(p=>VW.cardRect(0,p.name)).filter(Boolean).filter(c=>{const xs=c.map(p=>p[0]),ys=c.map(p=>p[1]); return rtr.left<Math.max(...xs)-2 && rtr.right>Math.min(...xs)+2 && rtr.top<Math.max(...ys)-2 && rtr.bottom>Math.min(...ys)+2;});
  T('in a scaled row the tooltip covers none of the row\'s cards', row.length>1 && !rt.hidden && !hits.length, row.length+' in the row, tip '+JSON.stringify([rtr.left,rtr.top,rtr.width,rtr.height].map(Math.round))+' covers '+hits.length);
  pe('pointermove',W/2,top+4);
  for(let i=0;i<10;i++){ key('ArrowUp',{altKey:true}); await sl(60); } await sl(800);
  VW.flipTo(0); await until(()=>VW.view().flip===0); await sl(300);
  // the edge blurs: the side band is three blurs, each stronger than the last, and neither it nor the rim takes a click
  // or covers the top bar (its buttons and crumbs are what a click at their middle finds)
  const sb=document.getElementById('sideBlur'), rb=document.getElementById('rimBlur');
  const radii=[...sb.children].map(i=>parseFloat((getComputedStyle(i).backdropFilter||getComputedStyle(i).webkitBackdropFilter||'').replace(/[^\d.]/g,''))||0);
  T('the side band is three blurs, growing stronger', radii.length===3 && radii[0]>0 && radii[0]<radii[1] && radii[1]<radii[2], radii.join(','));
  const layers=[sb,rb,...sb.children,...rb.children], live=layers.filter(el=>getComputedStyle(el).pointerEvents!=='none');
  T('no blur layer takes the pointer', !live.length, live.map(el=>el.id||el.className).join(','));
  const corner=rb.querySelector('.c1'), cr=corner.getBoundingClientRect(), edge=rb.querySelector('.t').getBoundingClientRect();
  T('the corners blur further in than the edges', cr.width>edge.height && cr.height>edge.height, cr.width+' '+edge.height);
  const covered=[...document.querySelectorAll('#bar button:not([hidden]), #bar .crumb')].filter(b=>{ const r=b.getBoundingClientRect(); if(!r.width) return false; const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return !el || !(b===el || b.contains(el)); });
  T('the top bar\'s buttons and crumbs are clear of the blurs', !covered.length, covered.map(b=>b.id||b.textContent).join(','));
  T('a wide stage is not slim', !stage.classList.contains('slim'), stage.className);
  stage.style.width='390px'; dispatchEvent(new Event('resize')); await sl(300);
  T('a narrow stage gets the lighter blurs', stage.classList.contains('slim') && parseFloat(getComputedStyle(sb.querySelector('.s3')).backdropFilter.replace(/[^\d.]/g,''))<radii[2] && rb.querySelector('.t').getBoundingClientRect().height<edge.height, stage.className);
  stage.style.width=''; dispatchEvent(new Event('resize')); await sl(300);
  T('and a wide one gets them back', !stage.classList.contains('slim'), stage.className);
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
