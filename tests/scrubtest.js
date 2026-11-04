(async function(){
  // Ctrl + Shift + scroll: one scroll is one view along, down toward the mirrored view, up back
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const stage=document.getElementById('stage');
  await sl(1500);
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Control',ctrlKey:true,shiftKey:true,bubbles:true}));
  const wh=dy=>stage.dispatchEvent(new WheelEvent('wheel',{deltaY:dy,ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true,clientX:700,clientY:400}));
  const settle=async()=>{ for(let i=0;i<80 && VW.view().flip!==VW.view().target;i++) await sl(50); await sl(300); };
  wh(100); await settle();
  T('one notch down goes to the centre view', VW.view().target===0.5 && VW.view().flip===0.5, JSON.stringify(VW.view()));
  for(let i=0;i<6;i++){ wh(30); await sl(25); } await settle();
  T('one trackpad swipe (a burst of small events) is one view: on to the mirrored view', VW.view().flip===1 && VW.view().side===-1, JSON.stringify(VW.view()));
  wh(100); await settle();
  T('past the mirrored view it stays', VW.view().flip===1, JSON.stringify(VW.view()));
  wh(-100); await settle(); wh(-100); await settle();
  T('two notches up go back to the default view', VW.view().flip===0 && VW.view().side===1, JSON.stringify(VW.view()));
  // Ctrl + Shift + a mouse drag anywhere: one swipe is one view
  const pe=(type,x,y)=>{const ev=new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,button:0,pointerId:7,pointerType:"mouse",ctrlKey:true,shiftKey:true}); (type==="pointerdown"?stage:window).dispatchEvent(ev);};
  const swipe=async dx=>{ pe("pointerdown",700,400); await sl(20); for(let i=1;i<=8;i++){ pe("pointermove",700+dx*i/8,400); await sl(20); } pe("pointerup",700+dx,400); await settle(); };
  const p0=VW.state().path.join(">");
  await swipe(300);
  T("a long ctrl+shift drag right is one view: to the centre view", VW.view().flip===0.5, JSON.stringify(VW.view()));
  await swipe(300);
  T("and another to the mirrored view", VW.view().flip===1, JSON.stringify(VW.view()));
  await swipe(-300); await swipe(-300);
  T("two drags left go back to the default view, and the folder never changed", VW.view().flip===0 && VW.state().path.join(">")===p0, JSON.stringify(VW.view())+" "+VW.state().path.join(">"));
  // Ctrl + scroll (Ctrl really held) turns the parent wheel from anywhere on screen, as shift + up/down does, and scales nothing
  VW.enter('Thornvale'); await sl(1500); VW.snap(); await sl(200);
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Control',ctrlKey:true,bubbles:true}));
  const pS=()=>{ const r=VW.rows().find(r=>r.level===1); return r ? (r.target ?? r.s) : null; };
  const pi=VW.items(1).indexOf('Thornvale'), dir=pi<VW.items(1).length-1 ? 1 : -1;
  const ps0=pS(), u0=JSON.stringify(VW.dirSettings()), q=VW.screenOf(0,VW.state().focus);
  stage.dispatchEvent(new WheelEvent('wheel',{deltaY:100*dir,ctrlKey:true,bubbles:true,cancelable:true,clientX:q.x,clientY:q.y})); await sl(50);
  T("ctrl + scroll over the content column turns the parent wheel a step", ps0!==null && pS()===ps0+dir, ps0+" -> "+pS());
  T("and does not scale the content column", JSON.stringify(VW.dirSettings())===u0, u0+" -> "+JSON.stringify(VW.dirSettings()));
  stage.dispatchEvent(new WheelEvent('wheel',{deltaY:-100*dir,ctrlKey:true,bubbles:true,cancelable:true,clientX:innerWidth-30,clientY:innerHeight-30})); await sl(50);
  T("ctrl + scroll the other way from a far corner turns it back", pS()===ps0, ps0+" -> "+pS());
  window.dispatchEvent(new KeyboardEvent('keyup',{key:'Control',bubbles:true}));
  } catch(e){ out.push('FAIL threw '+e.message); }
  console.log('RESULTS\n'+out.join('\n'));
})();
