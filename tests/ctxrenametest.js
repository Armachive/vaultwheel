(async function(){
  // F2 and the menu's pencil: the new name is typed in a field bent to the card's slant and laid exactly over its name, in
  // every view, Enter saves, Esc or a click elsewhere leaves the name. (also: no card menu over the playground, and the
  // menu's trash. the menu and cut / copy / paste are in ctxmenutest)
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const $=s=>document.querySelector(s), stage=$('#stage'), menu=$('#cardMenu'), cren=$('#cardRen');
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o)));
  const toast=()=>{const t=$('#toast'); return t.hidden?'':t.textContent;};
  const S=()=>VW.state(), has=n=>VW.items(0).includes(n);
  const rclick=(level,name,type)=>{ const p=VW.screenOf(level,name); if(!p) return null;
    stage.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y,button:type==='touch'?0:2,buttons:type==='touch'?1:2,pointerId:91,pointerType:type||'mouse'}));
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:p.x,clientY:p.y,button:2,pointerId:91,pointerType:type||'mouse'}));
    stage.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:p.x,clientY:p.y,button:2})); return p; };
  const focusOn=async name=>{ VW.spinTo(VW.items(0).indexOf(name)); await sl(500); VW.snap(); await sl(200); };
  window.confirm=()=>true;
  await sl(1500); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(500);
  const md=VW.items(0).find(n=>/\.md$/.test(n)); await focusOn(md);
  // F2: the name is typed over the card itself
  await focusOn(md);
  key('F2'); await sl(200);
  let r=VW.renaming();
  T('F2 puts a text field over the card\'s name, focused, the name without its extension picked', r && r.focused && r.value===md && r.sel[0]===0 && r.sel[1]===md.lastIndexOf('.'), JSON.stringify(r));
  // (found by what the page itself says is at those places, so it holds at any slant: on the name is the field, just off it is not)
  const hit=(fx,fy)=>{ const q=VW.renamePoint(fx,fy); return q && document.elementFromPoint(q[0],q[1]); };
  const lies=()=>hit(0.02,0.5)===cren && hit(0.02,0.1)===cren && hit(0.02,0.9)===cren && hit(0.02,1.2)!==cren && hit(0.02,-0.2)!==cren && hit(-0.02,0.5)!==cren;
  T('the field lies exactly over the name', lies(), JSON.stringify(r && r.rect));
  T('its text is about the name\'s size on screen', r.font>12 && r.font<200, r.font);
  { const q0=VW.renamePoint(0,0), q1=VW.renamePoint(0,1), tall=Math.hypot(q0[0]-q1[0],q0[1]-q1[1]); T('the field is as tall on screen as the name', Math.abs(r.font*1.6-tall)<3, r.font*1.6+' vs '+tall); }
  cren.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await sl(100);
  T('Esc leaves the name as it was', !VW.renaming() && cren.hidden && has(md));
  key('F2'); await sl(150); cren.value='Typed over.md'; cren.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await sl(400);
  T('Enter saves the new name', has('Typed over.md') && !has(md) && !VW.renaming() && S().focus==='Typed over.md', S().focus);
  key('z',{ctrlKey:true}); await sl(400);
  T('and ctrl + Z puts it back', has(md), toast());
  await focusOn(md); rclick(0,md); await sl(100); menu.querySelector('[data-m=rename]').click(); await sl(150);
  r=VW.renaming();
  T('the menu\'s pencil starts the same rename', r && r.focused && r.value===md && !VW.cardMenu().open, JSON.stringify(r));
  stage.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:20,clientY:400,button:0,pointerId:94,pointerType:'mouse'}));
  window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:20,clientY:400,button:0,pointerId:94,pointerType:'mouse'})); await sl(100);
  T('a click elsewhere leaves the name as it was', !VW.renaming() && has(md));
  // the field follows the slant in the other views too
  for (const [t,label] of [[1,'the mirrored view'],[0.5,'the centre view']]) {
    VW.flipTo(t); await sl(1800); await focusOn(md);
    key('F2'); await sl(200);
    T('the field lies over the name in '+label, !!VW.renaming() && lies(), JSON.stringify(VW.renaming() && VW.renaming().rect));
    cren.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await sl(100);
  }
  VW.flipTo(0); await sl(1800); await focusOn(md);
  // the playground's right button resizes: no menu over it
  VW.shiftSelect(0,md); await sl(900); VW.snap(); await sl(100); VW.openStackView(); await sl(300);
  stage.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:700,clientY:400,button:2})); await sl(100);
  T('no card menu while the playground is open', VW.stackView().open && !VW.cardMenu().open);
  VW.closeStackView(); await sl(200); VW.cancelSelection(); await sl(600); VW.snap(); await focusOn(md);
  // the menu's trash
  rclick(0,md); await sl(100); menu.querySelector('[data-m=trash]').click(); await sl(400);
  T('the menu\'s trash moves it to .trash', !has(md) && /\.trash/.test(toast()), toast());
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
