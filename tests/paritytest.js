(async function(){
  // the file explorer jobs on the card in focus: the menu (ctrl + click on the focus), rename (F2), duplicate
  // (ctrl + D), move to .trash (Delete), new folder (ctrl + shift + N, or the plus button), undo (ctrl + Z, or Undo in the toast)
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const $=s=>document.querySelector(s), stage=$('#stage'), menu=$('#cardMenu');
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true},o)));
  const toast=()=>{const t=$('#toast'); return t.hidden?'':t.textContent;};
  const S=()=>VW.state(), has=n=>VW.items(0).includes(n);
  window.confirm=()=>true;
  await sl(1500); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  const md=VW.items(0).find(n=>/\.md$/.test(n)); VW.spinTo(VW.items(0).indexOf(md)); await sl(500); VW.snap(); await sl(200);
  // the menu: ctrl + click on the card in focus, at the pointer
  const ctrlTap=async (n,id)=>{ const p=VW.screenOf(0,n);
    stage.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y,button:0,pointerId:id,ctrlKey:true}));
    await sl(30); window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:p.x,clientY:p.y,button:0,pointerId:id,ctrlKey:true})); await sl(200); };
  await ctrlTap(md,81);
  { const p=VW.screenOf(0,md), r=menu.getBoundingClientRect();
    T('ctrl + click on the card in focus opens its menu, it does not open the file', !menu.hidden && menu.querySelector('.name').textContent===md && !/Opens/.test(toast()), menu.querySelector('.name').textContent+' '+toast());
    T('at the pointer', r.left<=p.x+1 && r.right>=p.x-1 && (r.bottom<=p.y+14 || r.top>=p.y), JSON.stringify([p,r.left,r.right,r.top,r.bottom])); }
  key('Escape'); await sl(100);
  T('Esc closes it', menu.hidden, '');
  key('Escape'); await sl(100);
  // rename (typed over the card's own name), and undo
  const cren=$('#cardRen'), typeCard=async (txt)=>{ cren.value=txt; cren.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await sl(400); };
  key('F2'); await sl(150);
  T('F2 has the name typed over the card, the name without its extension selected', !cren.hidden && document.activeElement===cren && cren.value===md && cren.selectionEnd===md.lastIndexOf('.'), cren.value+' '+cren.selectionStart+'-'+cren.selectionEnd);
  await typeCard('Renamed note.md');
  T('Enter renames it, and it stays in focus', has('Renamed note.md') && !has(md) && S().focus==='Renamed note.md' && cren.hidden, S().focus);
  key('z',{ctrlKey:true}); await sl(400);
  T('ctrl + Z puts the old name back', has(md) && !has('Renamed note.md'), toast());
  // names that cannot be
  key('F2'); await sl(150); await typeCard('a/b.md');
  T('a name with a slash is refused', has(md) && /cannot/.test(toast()) && !cren.hidden, toast());
  const other=VW.items(0).find(n=>n!==md && /\.md$/.test(n)); await typeCard(other);
  T('a name already in the folder is refused', has(md) && /already here/.test(toast()) && !cren.hidden, toast());
  cren.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await sl(100);
  // duplicate, and undo
  key('d',{ctrlKey:true}); await sl(400);
  const copy=md.replace(/\.md$/,' copy.md');
  T('ctrl + D makes a copy next to it, named copy, in focus', has(copy) && S().focus===copy, S().focus);
  key('z',{ctrlKey:true}); await sl(400);
  T('ctrl + Z takes the copy away again', !has(copy), toast());
  // move to .trash
  VW.spinTo(VW.items(0).indexOf(md)); await sl(400); VW.snap(); await sl(100);
  const n0=S().n; key('Delete'); await sl(400);
  T('Delete moves the card in focus to .trash (after asking)', !has(md) && S().n===n0-1 && /\.trash/.test(toast()), toast());
  // new folder: it waits for its name
  key('n',{ctrlKey:true,shiftKey:true}); await sl(300);
  T('ctrl + shift + N makes a new folder with its name ready to type, over its card', has('New folder') && !cren.hidden && document.activeElement===cren && cren.value==='New folder', JSON.stringify(VW.items(0).slice(0,3)));
  await typeCard('Ideas');
  T('naming it renames the new folder, and it is in focus', has('Ideas') && !has('New folder') && S().focus==='Ideas', S().focus);
  $('#bPlus').click(); await sl(50); $('#plusPop [data-new=folder]').click(); await sl(300);
  T('new folder under the plus button makes one too, its name ready to type', has('New folder') && !cren.hidden && document.activeElement===cren, JSON.stringify(VW.items(0).slice(0,3)));
  cren.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await sl(100);
  key('z',{ctrlKey:true}); await sl(400);
  T('ctrl + Z takes the new folder away again', !has('New folder'), toast());
  // undo never goes after something that has since gone to .trash
  { window.confirm=()=>true; const f0=S().focus, nm='Soon gone'+(f0.match(/\.[a-z0-9]+$/i)||[''])[0];
    key('F2'); await sl(150); await typeCard(nm); key('Delete'); await sl(400); key('z',{ctrlKey:true}); await sl(400);
    T('ctrl + Z does not try to rename a trashed file', !has(nm) && !/could not/i.test(toast()), toast()); }
  // and the old sheet is gone
  T('no file sheet is left in the page', !$('#fileSheet'), '');
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
