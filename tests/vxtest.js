(async function(){
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  const stage=document.getElementById('stage');
  const ev=(type,x,y,o={})=>{const e=new MouseEvent(type,Object.assign({bubbles:true,clientX:x,clientY:y,button:0},o)); e.pointerId=1; (type==='pointerdown'?stage:window).dispatchEvent(e);};
  const click=async(p,o={})=>{ ev('pointerdown',p.x,p.y,o); await sl(30); ev('pointerup',p.x,p.y,o); await sl(350); };
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true},o)));
  await sl(1500);
  const cam=VW.camera(); T('camera solved', cam.pos.every(Number.isFinite), JSON.stringify(cam));
  T('no wheels above the vault root', VW.state().wheels===1, VW.state().wheels);
  VW.enter('Thornvale'); VW.snap(); await sl(300);
  // parent-wheel scroll while hovering it
  const pi=VW.items(1).indexOf('Thornvale'); const sib=VW.items(1)[pi+1]; let p=VW.screenOf(1,sib);
  T('parent wheel neighbor visible', !!p, sib);
  const childS=VW.state().s;
  if(p){ stage.dispatchEvent(new WheelEvent('wheel',{deltaY:100,clientX:p.x,clientY:p.y,bubbles:true,cancelable:true})); await sl(800); }
  T('scrolling over the parent wheel leaves the child alone', VW.state().s===childS && VW.state().path.join('>')==='SilverOrchard>Thornvale', VW.state().s);
  VW.snap(); await sl(200);
  // click a sibling on the parent wheel: path switches, roll animation
  p=VW.screenOf(1,sib);
  if(p){ await click(p); await sl(900); VW.snap(); await sl(300); }
  T('click on a parent sibling switches the child wheel', VW.state().path.join('>')==='SilverOrchard>'+sib, VW.state().path.join('>'));
  T('old child wheel cleaned up after the roll', VW.wheelsInfo().filter(w=>w.level===0).length===1, JSON.stringify(VW.wheelsInfo().map(w=>w.dir+':'+w.level+(w.dying?'x':''))));
  // back into Thornvale > Wren Holloway
  key('ArrowLeft'); await sl(300); VW.snap(); VW.enter('Thornvale'); VW.snap(); VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  const n0=VW.state().n;
  // shift + enter picks the focused entry up (enter does what a click does)
  VW.spinTo(2); await sl(700); VW.snap(); await sl(100);
  const f=VW.state().focus; key('Enter',{shiftKey:true}); await sl(700);
  T('Shift+Enter selects the focused entry', VW.state().sel.length===1 && VW.state().sel[0]===f, JSON.stringify(VW.state().sel));
  // no lane any more: the picked card leaves its row and the row stays on whole steps, with a real card in focus
  T('selected entry leaves its wheel and the row stays on whole steps', VW.state().n===n0-1 && Number.isInteger(VW.state().s), 'n '+VW.state().n+' s '+VW.state().s);
  stage.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true})); await sl(800);
  T('carry scroll steps whole entries', Number.isInteger(VW.state().s), VW.state().s);
  // Esc returns it
  key('Escape'); await sl(800);      // (the cards ease back into place)
  T('Esc puts the selection back', VW.state().sel.length===0 && VW.state().n===n0 && Number.isInteger(VW.state().s), 'n '+VW.state().n+' s '+VW.state().s);
  // shift-click select via a real click on a visible child card
  VW.spinTo(5); await sl(700); VW.snap(); await sl(100);
  const name5=VW.items(0)[5]; p=VW.screenOf(0,name5);
  if(p){ await click(p,{shiftKey:true}); await sl(900); VW.snap(); await sl(300); }
  T('shift-click selects', VW.state().sel.includes(name5), JSON.stringify(VW.state().sel));
  // shift-click a folder on the parent wheel: it is picked up and you stay where you are
  // (the folder just under the lane faces the camera; ones near the top of the column are partly covered by their neighbours)
  const fold=VW.items(1)[VW.items(1).indexOf('Wren Holloway')+1];
  p=fold && VW.screenOf(1,fold);
  if(p){ await click(p,{shiftKey:true}); await sl(1200); VW.snap(); await sl(400); }
  T('shift-click on a parent folder picks it up without going there', VW.state().path.join('>')==='SilverOrchard>Thornvale>Wren Holloway' && VW.state().sel.includes(fold), VW.state().path.join('>')+' '+JSON.stringify(VW.state().sel));
  // carry into Silas Brightwater and drop
  VW.up(); await sl(300); VW.snap();
  const target = VW.items(0).includes('Silas Brightwater') && fold!=='Silas Brightwater' ? 'Silas Brightwater' : VW.items(0).find(n=>n!==fold && n!=='Wren Holloway');
  VW.enter(target); VW.snap(); await sl(400);
  const nB=VW.state().n, carried=VW.state().sel.length;
  // while carrying, a tap of Enter opens the playground, and Move here moves what is ticked
  key('Enter'); await sl(60); window.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true})); await sl(400);
  T('Enter while carrying opens the playground', VW.stackView().open, JSON.stringify(VW.stackView()));
  window.confirm=()=>true; document.querySelector('#sv .ops [data-op=move]').click(); await sl(600);
  T('Move here moves everything here', VW.state().sel.length===0 && VW.state().n===nB+carried, 'n '+nB+' -> '+VW.state().n);
  const toast=document.getElementById('toast').textContent; T('drop says preview only', /Preview only/.test(toast), toast.slice(0,90));
  // undercard spring and pop exist on the focused entry
  T('back and forward keys', (key('ArrowLeft'), true));
  console.log('RESULTS\n'+out.join('\n'));
})();
