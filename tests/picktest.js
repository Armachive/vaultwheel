(async function(){
  // picking up and carrying: nothing navigates on a pick, picks fly into the stack, the badge counts, every row keeps the
  // lane open so moving between rows with a stack moves nothing, the stack opens the playground (where moves happen), taps join the
  // stack while carrying, and the plain tap rules (tap focuses, tap the focus opens, ctrl + click from anywhere)
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const stage=document.getElementById('stage');
  const pe=(type,x,y,o={})=>{const e=new PointerEvent(type,Object.assign({bubbles:true,clientX:x,clientY:y,button:0,pointerId:5,pointerType:'touch'},o)); (type==='pointerdown'?stage:window).dispatchEvent(e);};
  const tap=async(p,o={})=>{ pe('pointerdown',p.x,p.y,o); await sl(30); pe('pointerup',p.x,p.y,o); };
  const hold=async(p,ms)=>{ pe('pointerdown',p.x,p.y); await sl(ms); pe('pointerup',p.x,p.y); };
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true},o)));
  const kup=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keyup',Object.assign({key:k,bubbles:true},o)));
  const P=()=>VW.state().path.join('>'), S=()=>VW.state();
  const toast=()=>{const t=document.getElementById('toast'); return t.hidden?'':t.textContent;};
  const row=l=>VW.rows().find(r=>r.level===l);
  await sl(1500); for (let i = 0; i < 40 && !VW.items(0).length; i++) await sl(250);   // the page may still be starting
  VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  // the plain taps: a tap on another file brings it to the focus without opening it; a tap on the one in focus opens it
  VW.spinTo(2); await sl(500); VW.snap(); await sl(150);
  let nm=VW.items(0)[3], p=VW.screenOf(0,nm);
  await tap(p); await sl(500); VW.snap(); await sl(150);
  T('a tap on a file brings it to the focus, it does not open', S().focus===nm && !/Opens/.test(toast()), S().focus+' '+toast());
  p=VW.screenOf(0,nm); await tap(p); await sl(200);
  T('a tap on the file in focus opens it', /Opens/.test(toast()) && toast().includes(nm), toast());
  await sl(3200);
  // ctrl + click: a file opens from wherever it is and the focus stays; a folder comes to the focus without opening
  const f0=S().focus, other=VW.items(0)[4]; p=VW.screenOf(0,other);
  await tap(p,{ctrlKey:true}); await sl(300);
  T('ctrl + click opens a file without moving the focus', toast().includes(other) && S().focus===f0, S().focus+' '+toast());
  const sib=VW.items(1).find(n=>n!=='Wren Holloway' && VW.screenOf(1,n));
  p=VW.screenOf(1,sib); await tap(p,{ctrlKey:true}); await sl(900); VW.snap(); await sl(200);
  T('ctrl + click on a folder brings it to the focus without going in', P()==='SilverOrchard>Thornvale' && S().focus===sib, P()+' focus='+S().focus);
  VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  // space does nothing now
  key(' '); await sl(200);
  T('space does nothing', S().sel.length===0, JSON.stringify(S().sel));
  // the first pick: a hold on a card. nothing navigates, it flies into the stack, the badge says 1
  VW.spinTo(2); await sl(500); VW.snap(); await sl(150);
  const a=VW.items(0)[4]; p=VW.screenOf(0,a);
  pe('pointerdown',p.x,p.y); await sl(520); const fl=VW.stackScreen(); await sl(30); pe('pointerup',p.x,p.y);
  T('a hold picks a card up and it flies into the stack', S().sel[0]===a && fl && fl.flying, JSON.stringify({sel:S().sel,fl}));
  await sl(700);
  T('the pick does not navigate', P()==='SilverOrchard>Thornvale>Wren Holloway', P());
  let c0=row(0), p1=row(1);
  T('no lane: carrying, the rows sit on whole steps as they always do, and a card is in focus', (c0.target??c0.s)%1===0 && (p1.target??p1.s)%1===0 && !!S().focus, JSON.stringify([c0,p1,S().focus]));
  // a folder from the directory row: shift-click picks it, it flies over, the rows stay put, the rainbow badge counts it
  VW.snap(); await sl(100);
  // (the folder just under the lane faces the camera; ones near the top of the row are partly covered by their neighbours)
  const cs=row(0).s, pi=VW.items(1).indexOf('Wren Holloway'), fold=VW.items(1)[pi+1]; p=VW.screenOf(1,fold);
  await tap(p,{shiftKey:true,pointerType:'mouse'}); await sl(60);
  T('shift-click on a folder in another row picks it without going there', S().sel.includes(fold) && P()==='SilverOrchard>Thornvale>Wren Holloway' && row(0).s===cs, fold+' '+JSON.stringify(S().sel)+' '+P()+' s '+cs+' -> '+row(0).s);
  await sl(600);
  // carrying, a tap on a file joins the stack
  VW.snap(); await sl(100);
  const t2=VW.items(0).find(n=>/\.[a-z0-9]+$/i.test(n) && VW.screenOf(0,n)); p=VW.screenOf(0,t2);
  await tap(p); await sl(500);
  T('carrying, a tap on a file adds it to the stack', S().sel.includes(t2) && S().sel.length===3, JSON.stringify(S().sel));
  // moving between rows with a stack: the stack does not move at all, and the row you come up to does not shift
  VW.snap(); await sl(200);
  const st0=VW.stackScreen(), ps=row(1).s; let drift=0;
  VW.up(); const cNow=row(0);
  for(let i=0;i<12;i++){ await sl(40); const q=VW.stackScreen(); drift=Math.max(drift,Math.hypot(q.x-st0.x,q.y-st0.y)); }
  T('going up with a stack: the stack stays exactly where it is', drift<2, 'drift '+drift.toFixed(2)+'px');
  T('and the row you come up to keeps its place', cNow.s===ps, 's '+ps+' -> '+cNow.s);
  await sl(400); VW.snap(); drift=0;
  VW.forward(); for(let i=0;i<12;i++){ await sl(40); const q=VW.stackScreen(); drift=Math.max(drift,Math.hypot(q.x-st0.x,q.y-st0.y)); }
  T('going back in: the stack still does not move', drift<2 && P()==='SilverOrchard>Thornvale>Wren Holloway', 'drift '+drift.toFixed(2)+'px '+P());
  await sl(1000); VW.snap(); await sl(200);
  // carrying, a tap on a folder still navigates
  const sib2=VW.items(1).find(n=>n!=='Wren Holloway' && n!==fold && VW.screenOf(1,n));
  p=VW.screenOf(1,sib2); await tap(p); await sl(1300); VW.snap(); await sl(200);
  T('carrying, a tap on a folder still takes you there', P()==='SilverOrchard>Thornvale>'+sib2 && S().sel.length===3, P());
  p=VW.screenOf(1,sib2); if(p){ await tap(p); await sl(500); VW.snap(); await sl(200); }
  T('a tap on the folder you are in closes it', P()==='SilverOrchard>Thornvale', P());
  VW.enter('Wren Holloway'); await sl(1300); VW.snap(); await sl(200);
  // the stack: a tap opens the playground; Esc leaves it with everything still carried
  let q=VW.stackScreen();
  await tap(q); await sl(300);
  T('a tap on the stack opens the playground', VW.stackView().open, JSON.stringify(VW.stackView()));
  key('Escape'); await sl(300); VW.snap();
  T('Esc leaves it, everything still carried', !VW.stackView().open && S().sel.length===3, JSON.stringify(S().sel));
  q=VW.stackScreen(); await tap(q); await sl(300);
  // moving happens in the playground: untick one, Move here takes the rest into this folder, the board stays open on the one left
  const n0=S().n, firstBox=document.querySelector('#sv .item'), keepName=firstBox.title;
  firstBox.querySelector('.tick').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:71})); await sl(100);
  window.confirm=()=>true; document.querySelector('#sv .ops [data-op=move]').click(); await sl(800);
  T('Move here moves the ticked ones and keeps the unticked one carried', S().sel.length===1 && S().sel[0]===keepName && S().n===n0+2 && VW.stackView().open, JSON.stringify(S().sel)+' n '+n0+' -> '+S().n);
  key('Escape'); await sl(400);
  T('leaving with it unticked puts it back', S().sel.length===0, JSON.stringify(S().sel));
  // shift-click, a hold, or holding enter on the stack puts everything back and the stack is gone
  VW.snap(); await sl(200); VW.spinTo(1); await sl(500); VW.snap(); await sl(150);
  VW.shiftSelect(0,VW.items(0)[1]); await sl(800); VW.snap(); await sl(150);
  q=VW.stackScreen(); await tap(q,{shiftKey:true,pointerType:'mouse'}); await sl(400);
  T('shift-click on the stack puts everything back', S().sel.length===0 && !VW.stackView().open, JSON.stringify(S().sel));
  VW.snap(); await sl(150); VW.shiftSelect(0,VW.items(0)[1]); await sl(800); VW.snap(); await sl(150);
  q=VW.stackScreen(); await hold(q,650); await sl(400);
  T('a hold on the stack puts everything back', S().sel.length===0 && !VW.stackView().open, JSON.stringify(S().sel));
  VW.snap(); await sl(150); VW.shiftSelect(0,VW.items(0)[1]); await sl(800); VW.snap(); await sl(150);
  key('Enter'); await sl(600); kup('Enter'); await sl(400);
  T('holding enter with a stack puts everything back', S().sel.length===0 && !VW.stackView().open, JSON.stringify(S().sel));
  key('Escape'); await sl(300); VW.cancelSelection(); await sl(300);
  // the folder you are inside cannot be picked from the directory row
  VW.snap(); await sl(200); p=VW.screenOf(1,'Wren Holloway');
  if(p){ await tap(p,{shiftKey:true,pointerType:'mouse'}); await sl(300); }
  T('the folder you are inside is not picked up', S().sel.length===0 && /inside/.test(toast()), toast());
  // sorting: by type puts files of a kind together in rainbow order, for the folders too, and it is remembered
  const BAR_ORDER=['code','image','blender','text','flp','audio','video','obsidian','other'];
  const BAR_OF={code:'code',image:'image',blender:'blender',text:'text',gif:'text',flp:'flp',audio:'audio',video:'video',obsidian:'obsidian',base:'obsidian',junk:'other',other:'other'};
  // each folder sorts its own way from the sort button: by type puts files of a kind together in rainbow order, kept for
  // the session; by size orders the folders too (by how many files they hold)
  const setSort=k=>{ document.getElementById('bDir').click(); document.querySelector('#dirPop [data-sort='+k+']').click(); };
  setSort('type'); await sl(500);
  const rk=n=>{ const k=VWCards.typeOf(n,false), m=(VWCards.TYPES[k]||{}).media; return BAR_ORDER.indexOf(m==='image'||m==='video'?m:BAR_OF[k]||'other'); };  // pictures and videos (gifs too) rank with their kind
  const ranks=VW.items(0).filter(n=>/\.[^.]+$/.test(n)).map(rk);
  const ordered=ranks.every((r,i)=>!i||r>=ranks[i-1]);
  let sess=null; try{ sess=JSON.parse(sessionStorage.getItem('vw.session')); }catch(e){}
  T('sort by type: files in rainbow order of their kind', ordered && ranks.length>3, JSON.stringify(ranks));
  T('the folder keeps its sort for the session', sess && Object.values(sess).some(v=>v.sort==='type'), JSON.stringify(sess));
  VW.up(); await sl(700); VW.snap(); await sl(100);
  const pf=VW.items(0);
  setSort('big'); await sl(500);
  T('size sorting orders the folders too', JSON.stringify(pf)!==JSON.stringify(VW.items(0)), JSON.stringify(pf.slice(0,5))+' vs '+JSON.stringify(VW.items(0).slice(0,5)));
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
