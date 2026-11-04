(async function(){
  // the scale of a folder: the content column widens up to its cap and its cards flatten, then it wraps into a
  // collage that at the top of the meter fits the whole folder on screen, each kind in its own block; the directory
  // columns move back only as far as the content column reaches past them; Alt + scroll and a
  // pinch over the content column scale it too; each folder has its own sort; settings live in this session's layer
  // over a saved one (no save button any more), and only the content column is ever scaled
  // a run that was stopped part way can leave saved folder settings behind, so the test starts from none
  try { localStorage.removeItem('vw.prefs'); sessionStorage.removeItem('vw.session'); } catch(e) { }
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const $=s=>document.querySelector(s), stage=$('#stage');
  const setU=async u=>{ VW.setScale(u); await sl(450); };
  const setSort=k=>{ $('#bDir').click(); $('#dirPop [data-sort="'+k+'"]').click(); };
  const tp=(type,id,x,y)=>{ const e=new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,button:0,pointerId:id,pointerType:'touch'}); (type==='pointerdown'?stage:window).dispatchEvent(e); };
  const u=()=>{ const v=VW.dirSettings(); return v ? v.u : null; };
  await sl(1500); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  const base=VW.shape(0), md=VW.items(0).find(n=>/\.md$/.test(n));
  T('a folder starts at the usual size', base.cols===1 && base.key==='base' && VW.push()===0, JSON.stringify(base));
  // the stretch
  VW.spinTo(VW.items(0).indexOf(md)); await sl(500); VW.snap(); await sl(200);
  await setU(0.45); await sl(500);
  let sh=VW.shape(0), cs=VW.cardSize(md);
  T('scaling makes the cards much flatter, and a name card only as long as its name', sh.cols===1 && cs && cs.h<cs.ih*0.55 && cs.w<sh.width && cs.w>cs.h*2, JSON.stringify({sh,cs}));
  T('and no wider than the cap', sh.width<=VW.T.CARD_W*1.375+1e-6 && cs.w<=VW.T.CARD_W*1.375+1e-6, JSON.stringify(sh));
  const pw=VW.wheelsInfo().find(w=>w.level===1&&!w.dying), cw0=VW.wheelsInfo().find(w=>w.level===0&&!w.dying), room=VW.room();
  T('the directory column moves back, but only as far as the content column reaches', VW.push()>0 && VW.push()<0.9 && pw.xt> -2.4, 'push '+VW.push()+' parent at '+pw.xt);
  T('the content column ends where the screen does', cw0.xt+sh.width/2<=Math.min(VW.T.CARD_W/2, room.outer)+0.01, JSON.stringify({x:cw0.xt,w:sh.width,room}));
  T('the card in focus stays in focus through the stretch', VW.state().focus===md, VW.state().focus);
  let sess=null; try{ sess=JSON.parse(sessionStorage.getItem('vw.session')); }catch(e){}
  T('this session keeps the scale', sess && Object.values(sess).some(v=>v.u>0.4), JSON.stringify(sess));
  // the first steps already put several cards on a row, of any kind, and no card slides over to its new place
  await setU(0.25); await sl(300);
  let pl0=VW.places(); const perRow=pl0.length/new Set(pl0.map(p=>p.ry.toFixed(4))).size;
  T('where the column stops widening, several cards share a row', perRow>=2.5, perRow.toFixed(2)+' a row');
  await setU(0.3); pl0=VW.places();
  const seen=pl0.filter(p=>VW.cardSize(p.name)), slid=seen.filter(p=>Math.abs(VW.cardSize(p.name).ox-p.x)>1e-6);
  T('at a new scale the cards are simply in their new places', seen.length>3 && !slid.length, slid.length+' of '+seen.length+' still on their way');
  const mixed=Object.values(pl0.reduce((m,p)=>((m[p.ry.toFixed(4)]=m[p.ry.toFixed(4)]||[]).push(p),m),{})).some(r=>new Set(r.map(p=>p.kind==='image'?'p':'n')).size>1);
  T('names and pictures share rows', mixed, '');
  // the arrows go by where the cards sit
  const press=async k=>{ window.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true})); await sl(300); VW.snap(); await sl(100); };
  const here=()=>VW.places().find(p=>p.name===VW.state().focus), depth0=VW.state().path.length;
  const k0=here(); await press('ArrowDown'); const k1=here(); await press('ArrowDown'); const k2=here();
  T('down goes to a card below each time', k1.y>k0.y+1e-4 && k2.y>k1.y+1e-4, [k0,k1,k2].map(q=>q.name+' '+q.y.toFixed(3)).join(' | '));
  await press('ArrowUp'); const k3=here();
  T('up goes to a card above', k3.y<k2.y-1e-4, k3.name);
  let stepsR=0, okR=true, was=here();
  for(let i=0;i<5;i++){ await press('ArrowRight'); const n=here(); if(n.name===was.name) break; stepsR++; okR=okR&&n.x>was.x+1e-4; was=n; }
  T('right goes to the nearest card that side until the row ends', okR, stepsR+' steps');
  await press('ArrowLeft'); const k4=here();
  T('left comes back, staying in the folder', (stepsR===0 || k4.x<was.x-1e-4) && VW.state().path.length===depth0, k4.name);
  // the collage
  await setU(1); await sl(700);
  sh=VW.shape(0); const pl=VW.places();
  const rm=VW.room(), top=Math.min(...pl.map(p=>p.y-p.h/2)), bot=Math.max(...pl.map(p=>p.y+p.h/2));
  T('all the way up the collage fits the whole folder on screen', sh.cols>1 && sh.stops===1 && bot-top<=rm.up+rm.down+1e-6, JSON.stringify({sh,h:bot-top,rm}));
  T('and is no wider than the cap', sh.width<=VW.T.CARD_W*1.375+1e-6, sh.width);
  T('cards sit side by side', new Set(pl.map(p=>p.x.toFixed(2))).size>=2, '');
  let overlap=0;
  for(let i=0;i<pl.length;i++) for(let j=i+1;j<pl.length;j++){ const a=pl[i],b=pl[j]; if(Math.abs(a.x-b.x)<(a.w+b.w)/2-1e-4 && Math.abs(a.y-b.y)<(a.h+b.h)/2-1e-4) overlap++; }
  T('with gaps between them, none overlapping', overlap===0, overlap+' overlaps');
  const byRow={}; for(const p of pl) (byRow[p.ry.toFixed(4)]=byRow[p.ry.toFixed(4)]||[]).push(p);
  const rowYs=Object.keys(byRow).sort((a,b)=>a-b), spans=rowYs.slice(0,-1).map(y=>{ const r=byRow[y]; return Math.max(...r.map(p=>p.x+p.w/2))-Math.min(...r.map(p=>p.x-p.w/2)); });
  T('a mosaic: every row but the last fills the column edge to edge', spans.every(s=>Math.abs(s-sh.width)<1e-3), spans.map(s=>s.toFixed(3)).join(',')+' width '+sh.width);
  const shapes=pl.filter(p=>p.kind==='image').map(p=>+(p.w/p.h).toFixed(2));
  T('pictures show in their own shapes, held between 0.5 and 2.2', new Set(shapes).size>3 && shapes.every(a=>a>=0.5-0.01 && a<=2.2+0.01), [...new Set(shapes)].join(','));
  const song=pl.find(p=>p.kind==='audio');
  T('a song is a 4:3 tile', !song || Math.abs(song.w*0.75-song.h)<1e-6, JSON.stringify(song));
  T('a collage keeps the folder\'s own sort', VW.dirSettings().sort===null, JSON.stringify(VW.dirSettings()));
  // it all fits, so there is nothing to scroll; a tap on a tile brings it to the focus
  VW.snap(); const s0=VW.state().s;
  stage.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true,clientX:innerWidth-80,clientY:innerHeight/2})); await sl(600); VW.snap();
  T('a wheel notch leaves a collage that fits where it is', VW.state().s===s0, s0+' -> '+VW.state().s);
  await sl(200); VW.snap(); await sl(200);
  const vis=VW.items(0).find(n=>{ const q=VW.screenOf(0,n); return q && q.y>innerHeight*0.25 && q.y<innerHeight*0.75 && q.x>innerWidth*0.2 && q.x<innerWidth-20 && n!==VW.state().focus; });
  let q=vis&&VW.screenOf(0,vis);
  if(q){ tp('pointerdown',51,q.x,q.y); await sl(30); tp('pointerup',51,q.x,q.y); await sl(700); VW.snap(); await sl(200); }
  T('a tap on a tile brings it to the focus', VW.state().focus===vis, 'tapped '+vis+' focus '+VW.state().focus);
  // Alt + scroll over the content column scales it; over a directory column it does nothing
  const uA=u(); const cq=VW.screenOf(0,VW.state().focus);
  stage.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,altKey:true,bubbles:true,cancelable:true,clientX:cq.x,clientY:cq.y})); await sl(400);
  T('Alt + scroll up over the content column scales it back a step', u()<uA-0.02 && u()>uA-0.1, uA+' -> '+u());
  // a trackpad pinch arrives as ctrl + scroll with Ctrl not really held: it still scales (fingers apart fits fewer)
  window.dispatchEvent(new KeyboardEvent('keyup',{key:'Control',bubbles:true}));
  const uP=u(), pr0=JSON.stringify(VW.rows().find(r=>r.level===1));
  stage.dispatchEvent(new WheelEvent('wheel',{deltaY:-20,ctrlKey:true,bubbles:true,cancelable:true,clientX:cq.x,clientY:cq.y})); await sl(400);
  T('a trackpad pinch (ctrl + scroll, Ctrl not held) over the content column scales it', u()<uP-0.02 && u()>uP-0.1, uP+' -> '+u());
  T('and leaves the parent wheel where it was', JSON.stringify(VW.rows().find(r=>r.level===1))===pr0, pr0+' -> '+JSON.stringify(VW.rows().find(r=>r.level===1)));
  // a pinch over it: fingers apart fits fewer, together fits more
  const u1=u(), c=VW.screenOf(0,VW.state().focus);
  tp('pointerdown',61,c.x-30,c.y); tp('pointerdown',62,c.x+30,c.y); await sl(20);
  for(let i=1;i<=5;i++){ tp('pointermove',61,c.x-30-20*i,c.y); tp('pointermove',62,c.x+30+20*i,c.y); await sl(20); }
  tp('pointerup',61,c.x-130,c.y); tp('pointerup',62,c.x+130,c.y); await sl(500);
  T('a pinch apart over the content column scales it down', u()<u1-0.2, u1+' -> '+u());
  T('and the pinch did not move the column or navigate', VW.state().path.join('>')==='SilverOrchard>Thornvale>Wren Holloway', VW.state().path.join('>'));
  await setU(1); await sl(500);
  // only the content column is scaled: going up, the folder is an ordinary directory column and the room comes back
  VW.up(); await sl(900); VW.snap(); await sl(300);
  T('going up: the new content column is the usual size and the room comes back', VW.shape(0).key==='base' && VW.shape(1).key==='base' && VW.push()<0.05, JSON.stringify([VW.shape(0).key,VW.shape(1).key,VW.push()]));
  // each folder has its own sort, in its own session layer
  const before=VW.items(0).slice(0,4).join('|');
  setSort('old'); await sl(500);
  T('a folder sorts its own way, from the sort button', VW.items(0).slice(0,4).join('|')!==before && $('#dirPop').hidden, before+' -> '+VW.items(0).slice(0,4).join('|'));
  T('the sort button shows a sort is on', $('#bDir').classList.contains('on'), $('#bDir').className);
  setSort(''); await sl(500);
  T('the everyday order brings the usual order back', VW.items(0).slice(0,4).join('|')===before && !$('#bDir').classList.contains('on'), VW.items(0).slice(0,4).join('|'));
  VW.forward(); await sl(1300); VW.snap(); await sl(300);
  T('back in: the folder is still a collage for this session', VW.shape(0).cols>1, JSON.stringify(VW.shape(0)));
  // there is no save any more: the session keeps it, and nothing is written for every new session
  let saved=null; try{ saved=JSON.parse(localStorage.getItem('vw.prefs')); }catch(e){}
  T('nothing is saved past the session', !saved || !Object.keys(saved.dirs||{}).length, JSON.stringify(saved));
  T('the bar has no scale meter or saved settings, and keeps the saved boards button', !$('#dScale') && !$('#dSave') && !!$('#bBoards'), '');
  // a list's card round behind the tube is not drawn, and shows again when the column has stops. a scaled column keeps the card
  // as it is, so that is where it would stay hidden (a mosaic makes its cards again)
  await setU(0); VW.up(); VW.up(); VW.enter('Riko ochre'); VW.enter('Bane Greenhouse'); VW.snap(); await sl(800);
  // (which are far enough round goes by their heights, so it looks along the folder for a place with one)
  let lst=[], hid=0;
  for(let i=0;i<12&&!hid;i++){ VW.spinTo(i*3); await sl(500); VW.snap(); await sl(300); lst=VW.faces(0); hid=lst.filter(f=>!f.shown).length; }
  T('a list keeps its far cards made but not drawn', lst.length>0 && hid>0 && hid<lst.length, hid+' of '+lst.length);
  await setU(0.45); VW.snap(); await sl(600);
  const flat=VW.faces(0).filter(f=>f.op>0.01);
  T('in a scaled column every card is drawn again', flat.length>0 && flat.every(f=>f.shown), flat.filter(f=>!f.shown).length+' of '+flat.length+' hidden');
  await setU(0.7); VW.snap(); await sl(900);
  const tiles=VW.faces(0).filter(f=>f.op>0.01);
  T('in a mosaic every card is drawn again', tiles.length>0 && tiles.every(f=>f.shown), tiles.filter(f=>!f.shown).length+' of '+tiles.length+' hidden');
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
