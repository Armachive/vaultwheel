(async function(){
  // the card menu (a right click on any card: its details and a row of icon buttons, just above the pointer, Esc or a
  // click elsewhere closes it, a long press on a touch screen stays a pick-up), cut / copy / paste (ctrl + X, C, V: a cut
  // card is dimmed until it is pasted or let go, a paste lands in the folder you are in, never inside a folder in focus,
  // a text field keeps its own ctrl + C), and F2, the rename typed right over the card's name
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
  // the menu
  let p=rclick(0,md); await sl(150);
  let m=VW.cardMenu();
  T('a right click on a card opens its menu', m.open && m.name===md, JSON.stringify(m.name));
  T('it shows the type, size and date modified', /Type/.test(m.info) && /Size/.test(m.info) && /Modified/.test(m.info), m.info);
  T('it sits just above the pointer, on screen', m.rect.y+m.rect.h<=p.y && p.y-(m.rect.y+m.rect.h)<30 && m.rect.x>=0 && m.rect.x+m.rect.w<=innerWidth && m.rect.y>=0, JSON.stringify(m.rect)+' at '+JSON.stringify(p));
  const want=['path','cut','copy','paste','openWith','rename','trash','link'];
  T('the buttons: copy path, cut, copy, paste, open with, rename, trash, link', JSON.stringify(m.buttons.map(b=>b.m))===JSON.stringify(want), JSON.stringify(m.buttons.map(b=>b.m)));
  T('icons only, each with a tooltip', m.buttons.every(b=>!b.text && b.title && b.label) && [...menu.querySelectorAll('.acts button')].every(b=>b.querySelector('svg')), JSON.stringify(m.buttons.map(b=>b.text+'|'+b.title)));
  T('no pick up in it', !m.buttons.some(b=>/pick/i.test(b.m+b.title)));
  T('open with is hidden where it cannot work (the preview)', m.buttons.find(b=>b.m==='openWith').hidden);
  T('paste waits for something to paste', m.buttons.find(b=>b.m==='paste').disabled);
  key('Escape'); await sl(100);
  T('Esc closes it', !VW.cardMenu().open);
  rclick(0,md); await sl(100);
  stage.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:20,clientY:400,button:0,pointerId:92,pointerType:'mouse'}));
  window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:20,clientY:400,button:0,pointerId:92,pointerType:'mouse'})); await sl(100);
  T('a click elsewhere closes it', !VW.cardMenu().open);
  // a folder in the parent column
  rclick(1,'Wren Holloway'); await sl(100); m=VW.cardMenu();
  T('a folder card in another column shows how many items it holds', m.open && m.name==='Wren Holloway' && /Items\s*\d+/.test(m.info) && !/Size/.test(m.info), m.info);
  key('Escape'); await sl(100);
  // a long press on a touch screen is still a pick-up, not the menu
  rclick(0,md,'touch'); await sl(100);
  T('a touch long press does not open the menu', !VW.cardMenu().open);
  // cut and copy from the keys
  key('c',{ctrlKey:true}); await sl(100);
  T('ctrl + C copies the card in focus', JSON.stringify(VW.clip())===JSON.stringify({name:md,cut:false}), JSON.stringify(VW.clip()));
  T('a copied card is not dimmed', VW.cardOp(0,md)>0.99, VW.cardOp(0,md));
  key('x',{ctrlKey:true}); await sl(200);
  T('ctrl + X cuts it, and it is dimmed', VW.clip().cut && VW.cardOp(0,md)<0.6 && VW.cardOp(0,md)>0.2, VW.cardOp(0,md));
  key('Escape'); await sl(200);
  T('Esc lets the cut go and the card is bright again', !VW.clip() && VW.cardOp(0,md)>0.99, VW.cardOp(0,md));
  key('x',{ctrlKey:true}); await sl(100); key('c',{ctrlKey:true}); await sl(200);
  T('a new copy lets the cut go too', !VW.clip().cut && VW.cardOp(0,md)>0.99, VW.cardOp(0,md));
  // a text field keeps its own ctrl + C and ctrl + V
  const inp=document.createElement('input'); document.body.appendChild(inp); inp.focus();
  const ev=new KeyboardEvent('keydown',{key:'x',ctrlKey:true,bubbles:true,cancelable:true}); inp.dispatchEvent(ev);
  T('ctrl + X in a text field is the field\'s', !ev.defaultPrevented && !VW.clip().cut, JSON.stringify(VW.clip()));
  inp.remove();
  // cut, then paste in another folder: a move
  key('x',{ctrlKey:true}); await sl(100);
  VW.up(); VW.snap(); await sl(600);
  const up0=VW.items(0).length, upHas=has(md);
  const sub=VW.items(0).find(n=>n!=='Wren Holloway' && VW.places().find(q=>q.name===n && q.kind==='dir'));
  if (sub) await focusOn(sub);
  key('v',{ctrlKey:true}); await sl(600);
  T('ctrl + V moves a cut card into the folder you are in, not into the folder in focus', !upHas && has(md) && VW.items(0).length===up0+1, VW.items(0).length+' want '+(up0+1)+' focus '+S().focus);
  T('the cut is used up and the card is bright', !VW.clip() && VW.cardOp(0,md)>0.99, JSON.stringify(VW.clip())+' '+VW.cardOp(0,md));
  T('the toast offers Undo', /Undo$/.test(toast()), toast());
  if (sub) { VW.enter(sub); VW.snap(); await sl(500); T('the folder in focus got nothing', !has(md), JSON.stringify(VW.items(0).slice(0,4))); VW.up(); VW.snap(); await sl(500); }
  key('z',{ctrlKey:true}); await sl(600);
  T('ctrl + Z moves it back', !has(md) && VW.items(0).length===up0, VW.items(0).length+' want '+up0);
  key('v',{ctrlKey:true}); await sl(200);
  T('nothing left to paste after a cut went', /Nothing to paste/.test(toast()), toast());
  // copy, then paste: a duplicate made here, its own name kept, then numbered when the name is taken
  VW.enter('Wren Holloway'); VW.snap(); await sl(500); await focusOn(md);
  key('c',{ctrlKey:true}); await sl(100); VW.up(); VW.snap(); await sl(600);
  key('v',{ctrlKey:true}); await sl(600);
  T('ctrl + V after a copy makes a copy here with the same name', has(md) && VW.items(0).length===up0+1, VW.items(0).length+' '+toast());
  key('v',{ctrlKey:true}); await sl(600);
  const cp=md.replace(/\.md$/,' copy.md');
  T('pasted again, the copy is numbered like a duplicate', has(cp) && VW.items(0).length===up0+2, JSON.stringify(VW.items(0).filter(n=>n.startsWith(md.replace(/\.md$/,'')))));
  T('the copy stays on the clipboard', JSON.stringify(VW.clip())===JSON.stringify({name:md,cut:false}));
  VW.enter('Wren Holloway'); VW.snap(); await sl(500);
  T('the original stays where it was', has(md), JSON.stringify(VW.items(0).length));
  // the menu's own cut and paste
  await focusOn(md); rclick(0,md); await sl(100);
  menu.querySelector('[data-m=cut]').click(); await sl(200);
  T('the menu\'s cut cuts and dims the card', VW.clip().cut && VW.cardOp(0,md)<0.6 && !VW.cardMenu().open, VW.cardOp(0,md));
  rclick(0,md); await sl(100);
  T('the menu offers the paste now', !VW.cardMenu().buttons.find(b=>b.m==='paste').disabled);
  menu.querySelector('[data-m=paste]').click(); await sl(300);
  T('pasting a cut card where it already is leaves it there', has(md) && !VW.clip() && /already here/.test(toast()), toast());
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
