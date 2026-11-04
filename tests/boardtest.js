(async function(){
  // the carried files board: opens on Enter or a click on the stack, zooms at the pointer, pans, moves and sizes files,
  // plays songs, opens files on a double click, leaves on a background click or Esc, moves them with Move here
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  // (the playground makes its board when the page's module runs, after this script starts, so it is looked up once loaded)
  let sv=null;
  const pe=(el,type,x,y,o={})=>el.dispatchEvent(new PointerEvent(type,Object.assign({bubbles:true,clientX:x,clientY:y,button:0,pointerId:21,pointerType:'mouse'},o)));
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true},o)));
  const kup=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keyup',Object.assign({key:k,bubbles:true},o)));
  const box=n=>[...sv.querySelectorAll('.item')].find(b=>b.title===n);
  const mid=el=>{const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,r};};
  const toast=()=>{const t=document.getElementById('toast'); return t.hidden?'':t.textContent;};
  await sl(1500); sv=document.getElementById('sv'); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  const names=VW.items(0), pic=names.find(n=>/\.png$/i.test(n)), song='Moonrise.mp3', note=names.find(n=>/\.md$/.test(n));
  // each one is scrolled near first, since only the cards around the focus are built
  for(const n of [pic,song,note]){ VW.spinTo(VW.items(0).indexOf(n)); await sl(500); VW.snap(); await sl(100); VW.shiftSelect(0,n); await sl(1000); VW.snap(); await sl(100); }
  T('three files carried', VW.state().sel.length===3, JSON.stringify(VW.state().sel));
  // a tap of Enter while carrying opens the board
  key('Enter'); await sl(60); kup('Enter'); await sl(300);
  let v=VW.stackView();
  T('Enter while carrying opens the board', v.open && v.cards===3, JSON.stringify(v));
  T('a picture goes on as a picture, other files as cards', !!(box(pic)&&box(pic).querySelector('img')) && !!(box(song)&&box(song).querySelector('canvas')), pic);
  const inView=[pic,song,note].every(n=>{const r=box(n).getBoundingClientRect(); return r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight;});
  T('everything fits in view', inView, JSON.stringify([pic,song,note].map(n=>{const r=box(n).getBoundingClientRect(); return [r.left|0,r.top|0,r.right|0,r.bottom|0];})));
  // the magnifier: alt + scroll zooms smoothly and keeps the spot under the pointer still
  // (the board's numbers are from the board's own corner, not the page's)
  const so=sv.getBoundingClientRect();
  let p=mid(box(pic)); const z0=v.z, bx=(p.x-so.left-v.x)/v.z, by=(p.y-so.top-v.y)/v.z, s0=VW.state().s;
  for(let i=0;i<3;i++){ sv.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,altKey:true,clientX:p.x,clientY:p.y,bubbles:true,cancelable:true})); await sl(30); }
  await sl(60); const zMid=VW.stackView().z;
  await sl(900); v=VW.stackView();
  T('alt + scroll zooms in, easing there', v.z>z0*1.6 && zMid<v.z, 'z '+z0+' -> '+zMid+' -> '+v.z);
  const ax=(p.x-so.left-v.x)/v.z, ay=(p.y-so.top-v.y)/v.z;
  T('the spot under the pointer stays put', Math.abs(ax-bx)<0.5 && Math.abs(ay-by)<0.5, ax.toFixed(2)+','+ay.toFixed(2)+' want '+bx.toFixed(2)+','+by.toFixed(2)+' (board at '+so.left+','+so.top+')');
  T('the wheel behind does not move', VW.state().s===s0, 's '+s0+' -> '+VW.state().s);
  // plain scroll pans
  const y0=v.y; sv.dispatchEvent(new WheelEvent('wheel',{deltaY:120,clientX:p.x,clientY:p.y,bubbles:true,cancelable:true})); await sl(60);
  T('plain scroll pans the board', Math.abs(VW.stackView().y-(y0-120))<0.5, y0+' -> '+VW.stackView().y);
  document.querySelector('#sv .ops [data-op=fit]').click(); await sl(1200); v=VW.stackView();
  // the board starts at zoom 1 now, so Fit is judged by what it shows, not by going back to the starting zoom
  const allIn=[pic,song,note].every(n=>{const r=box(n).getBoundingClientRect(); return r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight;});
  T('Fit brings everything back in view', allIn && v.z<z0*1.6+0.5, 'z '+v.z+' (started at '+z0+')');
  // drag a file to move it, its corner to size it
  let b=box(note), m=mid(b); const l0=parseFloat(b.style.left), w0=parseFloat(b.style.width);
  pe(b,'pointerdown',m.x,m.y); await sl(20); for(let i=1;i<=5;i++){ pe(sv,'pointermove',m.x+12*i,m.y+8*i); await sl(16); } pe(sv,'pointerup',m.x+60,m.y+40); await sl(100);
  T('dragging a file moves it', Math.abs(parseFloat(b.style.left)-(l0+60/v.z))<0.6 && VW.stackView().open, b.style.left+' from '+l0);
  // a right-button drag resizes from the side it was taken hold of (AltSnap style): here its right side
  let r=b.getBoundingClientRect(); const ex=r.right-r.width/8, ey=r.top+r.height/2, h0=parseFloat(b.style.height);
  pe(b,'pointerdown',ex,ey,{button:2}); await sl(20); for(let i=1;i<=5;i++){ pe(sv,'pointermove',ex+10*i,ey,{button:2}); await sl(16); } pe(sv,'pointerup',ex+50,ey,{button:2}); await sl(100);
  T('a right-button drag on its right side widens it, height kept', Math.abs(parseFloat(b.style.width)-(w0+50/v.z))<0.6 && Math.abs(parseFloat(b.style.height)-h0)<0.6, b.style.width+' from '+w0);
  T('there is no corner grip any more', !b.querySelector('.grip'));
  // a tap picks it and shows its box; dragging the box's bottom handle makes it taller
  m=mid(b); pe(b,'pointerdown',m.x,m.y); await sl(20); pe(sv,'pointerup',m.x,m.y); await sl(450);
  const hs=b.querySelector('.bb[data-z=s]');
  T('a tap shows its box with handles', b.classList.contains('picked') && b.querySelectorAll('.bb').length===8, b.className);
  if(hs){ const hm=mid(hs), hb=parseFloat(b.style.height); pe(hs,'pointerdown',hm.x,hm.y); await sl(20); for(let i=1;i<=4;i++){ pe(sv,'pointermove',hm.x,hm.y+10*i); await sl(16); } pe(sv,'pointerup',hm.x,hm.y+40); await sl(100);
    T('dragging the bottom handle makes it taller', Math.abs(parseFloat(b.style.height)-(hb+40/v.z))<0.6, b.style.height+' from '+hb); }
  // a song plays from its card on the board
  b=box(song); const card=b.__card, rc=b.querySelector('canvas').getBoundingClientRect(), hp=card.hit&&card.hit.play;
  if(hp){ const x=rc.left+(hp[0]+hp[2]/2)/card.c.width*rc.width, y=rc.top+(hp[1]+hp[3]/2)/card.c.height*rc.height; pe(b,'pointerdown',x,y); await sl(20); pe(sv,'pointerup',x,y); await sl(1200); }
  // (a carried song is not on the wheel, so its state is read from its card on the board)
  const songA=card.it.audio; let md=songA;
  T('the song plays from the board', md && md.playing && md.progress>0, JSON.stringify(md&&{p:md.playing,pr:md.progress}));
  // a double click opens a file up in place, and its Open button opens it in its own app
  b=box(note); m=mid(b);
  for(let k=0;k<2;k++){ pe(b,'pointerdown',m.x,m.y); await sl(20); pe(sv,'pointerup',m.x,m.y); await sl(80); }
  T('a double click opens the file up in place', b.classList.contains('big') && !!b.querySelector('.xbar'), b.className);
  b.querySelector('.xbar [data-x=open]').click(); await sl(100);
  T('its Open button opens the file', /Opens/.test(toast()), toast());
  b.querySelector('.xbar [data-x=shrink]').click(); await sl(200);
  // two fingers pinch
  v=VW.stackView(); const zp=v.z, c=mid(box(pic));
  const tp=(el,type,id,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,button:0,pointerId:id,pointerType:'touch'}));
  tp(sv,'pointerdown',31,c.x-40,c.y); tp(sv,'pointerdown',32,c.x+40,c.y); await sl(20);
  for(let i=1;i<=5;i++){ tp(sv,'pointermove',31,c.x-40-12*i,c.y); tp(sv,'pointermove',32,c.x+40+12*i,c.y); await sl(16); }
  tp(sv,'pointerup',31,c.x-100,c.y); tp(sv,'pointerup',32,c.x+100,c.y); await sl(100);
  T('a pinch zooms', Math.abs(VW.stackView().z-zp*2.5)<0.05*zp, zp+' -> '+VW.stackView().z);
  // a click on the background does NOT leave any more (only the ✕, Esc or Android's back do)
  const left1=box(note).style.left;
  pe(sv,'pointerdown',8,innerHeight-8); await sl(20); pe(sv,'pointerup',8,innerHeight-8); await sl(200);
  T('a click on the background keeps the board open', VW.stackView().open, JSON.stringify(VW.stackView()));
  // two quick taps on the background leave; the files stay carried
  await sl(600); pe(sv,'pointerdown',8,innerHeight-8); await sl(20); pe(sv,'pointerup',8,innerHeight-8); await sl(60); pe(sv,'pointerdown',8,innerHeight-8); await sl(20); pe(sv,'pointerup',8,innerHeight-8); await sl(300);
  T('a double click on the background leaves the board', !VW.stackView().open && VW.state().sel.length===3, JSON.stringify(VW.stackView()));
  VW.openStackView(); await sl(400);
  // a mouse drag round two files on the empty board draws a lasso that unticks them (they were ticked)
  const lb=[box(pic),box(song)].map(x=>x.getBoundingClientRect()), lxa=Math.min(lb[0].left,lb[1].left)-30, lxb=Math.max(lb[0].right,lb[1].right)+30, lya=Math.min(lb[0].top,lb[1].top)-30, lyb=Math.max(lb[0].bottom,lb[1].bottom)+30;
  const loop=[[lxa,lya],[lxb,lya],[lxb,lyb],[lxa,lyb],[lxa,lya+2]];
  pe(sv,'pointerdown',loop[0][0],loop[0][1]); await sl(20); for(const [lx,ly] of loop.slice(1)){ pe(sv,'pointermove',lx,ly); await sl(16); } pe(sv,'pointerup',loop[4][0],loop[4][1]); await sl(150);
  T('a lasso round two files unticks them', box(pic).classList.contains('off') && box(song).classList.contains('off') && !box(note).classList.contains('off') && VW.stackView().open, [pic,song,note].map(n=>box(n).classList.contains('off')).join(','));
  pe(sv,'pointerdown',loop[0][0],loop[0][1]); await sl(20); for(const [lx,ly] of loop.slice(1)){ pe(sv,'pointermove',lx,ly); await sl(16); } pe(sv,'pointerup',loop[4][0],loop[4][1]); await sl(150);
  T('the same lasso again ticks them back', !box(pic).classList.contains('off') && !box(song).classList.contains('off'));
  document.querySelector('#sv .pgx').click(); await sl(200);
  T('the ✕ leaves the board', !VW.stackView().open && VW.state().sel.length===3, JSON.stringify(VW.stackView()));
  md=songA;
  T('a song keeps playing after the board closes', md && md.playing, JSON.stringify(md&&md.playing));
  VW.openStackView(); await sl(200);
  // the physics settles a file a pixel or two after the board opens again, so it is the same place within a few pixels
  T('the board comes back as you left it', VW.stackView().open && box(note) && Math.abs(parseFloat(box(note).style.left)-parseFloat(left1))<6, box(note)&&box(note).style.left+' want '+left1);
  key('Escape'); await sl(200);
  T('Esc leaves the board', !VW.stackView().open && VW.state().sel.length===3, JSON.stringify(VW.stackView()));
  // Move here on the board moves everything ticked into the folder you are in
  VW.openStackView(); await sl(200); const n0=VW.state().n;
  window.confirm=()=>true; document.querySelector('#sv .ops [data-op=move]').click(); await sl(800);
  T('Move here on the board moves them here', VW.state().sel.length===0 && !VW.stackView().open && VW.state().n===n0+3, 'n '+n0+' -> '+VW.state().n);
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
