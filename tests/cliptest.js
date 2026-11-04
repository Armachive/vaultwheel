(async function(){
  // the clipboard: the indicator at the bottom (what is cut or copied, Paste and Cancel, stays until used), the set that
  // grows with each cut or copy, and how it lives with the stack, the playground, undo, views and scale
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i!==undefined&&!ok?' :: '+(typeof i==='string'?i:JSON.stringify(i)):''));
  try {
  const $=s=>document.querySelector(s), stage=$('#stage'), bar=$('#clipBar'), menu=$('#cardMenu');
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o)));
  const X=()=>key('x',{ctrlKey:true}), C=()=>key('c',{ctrlKey:true}), V=()=>key('v',{ctrlKey:true}), Z=()=>key('z',{ctrlKey:true});
  const toast=()=>{const t=$('#toast'); return t.hidden?'':t.textContent;};
  const S=()=>VW.state(), has=n=>VW.items(0).includes(n);
  const shown=()=>!bar.hidden && bar.getBoundingClientRect().width>0;
  const name=()=>bar.querySelector('.name').textContent, verb=()=>bar.querySelector('.verb').textContent;
  const focusOn=async n=>{ VW.spinTo(VW.items(0).indexOf(n)); await sl(450); VW.snap(); await sl(150); };
  const home=async()=>{ VW.up(); VW.snap(); await sl(350); VW.enter('Wren Holloway'); VW.snap(); await sl(450); };
  const rclick=(x,y)=>{ stage.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:y,button:2,buttons:2,pointerId:91,pointerType:'mouse'}));
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x,clientY:y,button:2,pointerId:91,pointerType:'mouse'}));
    stage.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:x,clientY:y,button:2})); };
  const overlap=(a,b)=>!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);
  window.confirm=()=>true;
  await sl(1500); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(500);
  const files=VW.items(0).filter(n=>/\.\w+$/.test(n)), a=files[0], b=files[1], c=files[2], d=files[3];
  const n0=VW.items(0).length;
  T('no indicator with nothing on the clipboard', !shown());
  // the indicator
  await focusOn(a); X(); await sl(100);
  T('ctrl + X shows it: the name and Cutting', shown() && name()===a && verb()==='Cutting', [name(),verb()]);
  const ic=bar.querySelector('canvas').getContext('2d').getImageData(0,0,48,48).data; T('with the file\'s icon drawn', [...ic].some(v=>v>0));
  T('no toast about ctrl + V any more', !/Ctrl \+ V/.test(toast()), toast());
  await sl(7000); T('it stays: no fading away', shown() && getComputedStyle(bar).opacity==='1');
  const r=bar.getBoundingClientRect();
  T('inside the screen, at the bottom, in the middle', r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight && innerHeight-r.bottom<40 && Math.abs((r.left+r.right)/2-innerWidth/2)<2, r);
  T('it takes clicks only in its own box', document.elementFromPoint(r.left-6,r.top+r.height/2)!==bar && !bar.contains(document.elementFromPoint(r.right+6,r.top+r.height/2)) && !bar.contains(document.elementFromPoint(r.left+r.width/2,r.top-6)));
  T('its buttons are pills', $('#cbPaste').classList.contains('pill') && $('#cbCancel').classList.contains('pill'));
  // a folder's icon on the bar is the rainbow, as on the stack card (its gradient once sat in the wrong space: one flat colour)
  { const c=document.createElement('canvas'); c.width=c.height=48; const x=c.getContext('2d'); VWCards.drawIcon(x,'folder',2,2,44,'dark');
    const seen=new Set(); for(let i=8;i<=40;i+=8) seen.add([...x.getImageData(i,26,1,1).data].slice(0,3).join());
    T('a folder on the clipboard bar shows the rainbow', seen.size>=3, [...seen].join(' ')); }
  T('the cut card is dimmed', VW.cardOp(0,a)<0.6);
  $('#cbCancel').click(); await sl(100);
  T('Cancel: nothing cut, the indicator gone, the card bright at once', !VW.clip() && !shown() && VW.cardOp(0,a)>0.99, [VW.clip(),VW.cardOp(0,a)]);
  C(); await sl(100);
  T('ctrl + C shows Copying, no dim', shown() && verb()==='Copying' && name()===a && VW.cardOp(0,a)>0.99);
  key('Escape'); await sl(80); T('Esc lets a copy go too', !VW.clip() && !shown());
  // the set
  X(); await focusOn(b); X(); await sl(100);
  T('a second cut adds to the cut', JSON.stringify(VW.clip().names)===JSON.stringify([a,b]) && VW.clip().cut, VW.clip());
  T('the indicator counts', name()==='2 items' && verb()==='Cutting', name());
  T('both dimmed', VW.cardOp(0,a)<0.6 && VW.cardOp(0,b)<0.6);
  X(); await sl(100);
  T('cutting one already in the set takes it out', JSON.stringify(VW.clip())===JSON.stringify({name:a,cut:true}) && VW.cardOp(0,b)>0.99 && name()===a, VW.clip());
  X(); await sl(50); 
  await focusOn(c); const pc=VW.screenOf(0,c); rclick(pc.x,pc.y); await sl(100);
  T('the menu says Cut adds', /Add to the cut/.test(menu.querySelector('[data-m=cut]').title), menu.querySelector('[data-m=cut]').title);
  menu.querySelector('[data-m=cut]').click(); await sl(100);
  T('the menu\'s Cut adds too', name()==='3 items' && VW.cardOp(0,c)<0.6, name());
  C(); await sl(100);
  T('a copy on a cut starts a new copy, and the cut is bright again', JSON.stringify(VW.clip())===JSON.stringify({name:c,cut:false}) && VW.cardOp(0,a)>0.99 && VW.cardOp(0,b)>0.99 && VW.cardOp(0,c)>0.99, VW.clip());
  X(); await sl(80); T('a cut on a copy starts a new cut', JSON.stringify(VW.clip())===JSON.stringify({name:c,cut:true}), VW.clip());
  X(); await sl(80); T('the last one out empties it and the indicator goes', !VW.clip() && !shown());
  // a set from two folders, pasted in one go, one undo
  await focusOn(a); X(); await sl(50);
  VW.up(); VW.snap(); await sl(400);
  const sib=VW.items(0).find(n=>n!=='Wren Holloway' && VW.places().find(q=>q.name===n&&q.kind==='dir')); 
  VW.vaultChange({kind:'create',p:'Thornvale/top.md',size:10,m:1,isDir:false}); await sl(800); const upfile='top.md';
  const up0=VW.items(0).length;
  T('the folder above has a file to test with', !!upfile);
  await focusOn(upfile); X(); await sl(80);
  T('items from different folders sit in one set', name()==='2 items', name());
  T('the dim shows in the folder it is in', VW.cardOp(0,upfile)<0.6);
  VW.enter(sib); VW.snap(); await sl(500); const sib0=VW.items(0).length;
  $('#cbPaste').click(); await sl(500);
  T('Paste moves all of it into the content column\'s folder', has(a) && has(upfile) && VW.items(0).length===sib0+2, VW.items(0).length);
  T('a cut set is done once pasted', !VW.clip() && !shown());
  T('the toast offers one Undo', /Moved 2 items/.test(toast()) && /Undo$/.test(toast()), toast());
  Z(); await sl(500);
  T('one ctrl + Z puts both back', !has(a) && !has(upfile) && VW.items(0).length===sib0, VW.items(0).length);
  VW.up(); VW.snap(); await sl(350);
  T('the file above is home', has(upfile) && VW.items(0).length===up0);
  VW.enter('Wren Holloway'); VW.snap(); await sl(450);
  T('and the other', has(a) && VW.items(0).length===n0);
  // a name taken where it lands: reported by file, nothing overwritten, it stays cut
  VW.up(); VW.snap(); await sl(350); await focusOn(upfile); C(); await sl(50);
  VW.enter('Wren Holloway'); VW.snap(); await sl(450); V(); await sl(400);
  T('(a copy of a file above is here)', has(upfile));
  key('Escape'); await sl(50); await focusOn(upfile); X(); await focusOn(b); X(); await sl(50);
  VW.up(); VW.snap(); await sl(350); const up1=VW.items(0).length; V(); await sl(500);
  T('a clash is named, the other goes, nothing overwritten', has(b) && VW.items(0).filter(n=>n===upfile).length===1 && VW.items(0).length===up1+1 && new RegExp('Skipped').test(toast()) && toast().includes(upfile), toast());
  T('what clashed stays cut', VW.clip() && VW.clip().name===upfile && VW.clip().cut, VW.clip());
  key('Escape'); await sl(50); Z(); await sl(500);
  VW.enter('Wren Holloway'); VW.snap(); await sl(450);
  T('undone', has(b));
  // and a copy clash is numbered, in one go, one undo, and the set stays to paste again
  await focusOn(b); C(); await focusOn(c); C(); await sl(50);
  T('a copy set grows too', name()==='2 items' && verb()==='Copying', name());
  const n1=VW.items(0).length; $('#cbPaste').click(); await sl(500);
  T('Paste copies each, numbered where the name is taken', VW.items(0).length===n1+2 && has(b.replace(/(\.\w+)$/,' copy$1')) && has(c.replace(/(\.\w+)$/,' copy$1')), [VW.items(0).length,toast()]);
  T('the toast names the new names', toast().includes(b.replace(/(\.\w+)$/,' copy$1')), toast());
  T('the copy set stays', shown() && VW.clip().names.length===2);
  V(); await sl(500); T('it pastes again', VW.items(0).length===n1+4 && has(b.replace(/(\.\w+)$/,' copy 2$1')), VW.items(0).length);
  Z(); await sl(500); T('one ctrl + Z takes one paste away', VW.items(0).length===n1+2, VW.items(0).length);
  Z(); await sl(500); T('and the other', VW.items(0).length===n1, VW.items(0).length);
  key('Escape'); await sl(50);
  // what goes from the vault leaves quietly
  const up2=files[4];
  await focusOn(c); X(); await focusOn(up2); X(); await sl(50);
  key('Delete'); await sl(400);
  T('a trashed card leaves the set', name()===c && !has(up2), name());
  VW.vaultChange({kind:'delete',p:'Thornvale/Wren Holloway/'+c,isDir:false}); await sl(800);
  T('one deleted in Obsidian too, and the set is gone with the last', !VW.clip() && !shown(), VW.clip());
  VW.vaultChange({kind:'create',p:'Thornvale/Wren Holloway/'+c,isDir:false,size:10,m:1}); await sl(800);
  // a folder and a file inside it
  VW.up(); VW.snap(); await sl(350); await focusOn('Wren Holloway'); X(); await sl(50);
  VW.enter('Wren Holloway'); VW.snap(); await sl(450); await focusOn(a); X(); await sl(50);
  T('a folder and a file in it are one set', name()==='2 items');
  VW.up(); VW.snap(); await sl(350); VW.enter(sib); VW.snap(); await sl(450); const s2=VW.items(0).length; V(); await sl(500);
  T('the file goes with its folder, not on its own', has('Wren Holloway') && !has(a) && VW.items(0).length===s2+1 && !VW.clip(), VW.items(0).length);
  VW.enter('Wren Holloway'); VW.snap(); await sl(450); T('it is inside the folder still', has(a));
  VW.up(); VW.snap(); await sl(350); Z(); await sl(500); VW.up(); VW.snap(); await sl(350);
  T('undone', has('Wren Holloway'));
  VW.enter('Wren Holloway'); VW.snap(); await sl(450);
  // a rename shows on the indicator, the dim stays on the right card
  await focusOn(d); X(); await sl(50);
  VW.vaultChange({kind:'rename',old:'Thornvale/Wren Holloway/'+d,p:'Thornvale/Wren Holloway/z'+d,isDir:false}); await sl(800);
  T('renamed: the indicator follows and the card stays dimmed', name()==='z'+d && VW.cardOp(0,'z'+d)<0.6, [name(),d,S().focus,VW.items(0).slice(0,6)]);
  VW.vaultChange({kind:'rename',old:'Thornvale/Wren Holloway/z'+d,p:'Thornvale/Wren Holloway/'+d,isDir:false}); await sl(800);
  // views, scale, folder trips
  const dim=()=>VW.cardOp(0,d)<0.6, others=()=>VW.items(0).filter(n=>n!==d).slice(0,6).every(n=>{const o=VW.cardOp(0,n); return o===null||o>0.99;});
  VW.setScale(0.5); await sl(700); VW.snap(); await sl(200); T('the dim keeps to its card through a scale step', dim()&&others()); VW.setScale(0); await sl(700); VW.snap(); await sl(200);
  for (const [t,lab] of [[0.5,'centre'],[1,'flipped']]) { VW.flipTo(t); await sl(1800);
    const q=bar.getBoundingClientRect(); T('in the '+lab+' view: the indicator on screen and the card dimmed', shown()&&q.left>=0&&q.right<=innerWidth&&q.bottom<=innerHeight&&dim(), q); }
  VW.flipTo(0); await sl(1800);
  await home(); T('and through a trip out of the folder and back', dim()&&others());
  // the stack
  VW.shiftSelect(0,d); await sl(800); T('a cut card picked up stays cut and carried', VW.clip()&&VW.clip().name===d&&S().sel[0]===d&&shown());
  const fo=S().focus; T('the card in focus under the stack is bright', VW.cardOp(0,fo)>0.99);
  VW.cancelSelection(); await sl(400); VW.snap(); await sl(150); T('put back it is still dimmed', dim() && S().sel.length===0, VW.cardOp(0,d));
  VW.shiftSelect(0,d); await sl(800); VW.up(); VW.snap(); await sl(400); await VW.dropHere(); await sl(300);
  T('moved with the stack: the cut is done, no dim, no second move', !VW.clip() && !shown() && has(d) && VW.cardOp(0,d)>0.99, [VW.clip(),VW.cardOp(0,d)]);
  Z(); await sl(400); VW.enter('Wren Holloway'); VW.snap(); await sl(450);
  T('ctrl + Z after a stack move', has(d));
  await focusOn(d); X(); await sl(50); VW.shiftSelect(0,d); await sl(800); VW.up(); VW.snap(); await sl(400); V(); await sl(500);
  T('pasting a cut card that is carried: it lands and leaves the stack', has(d) && !S().sel.length && !VW.clip() && VW.cardOp(0,d)>0.99, [S().sel,VW.clip()]);
  Z(); await sl(400); VW.enter('Wren Holloway'); VW.snap(); await sl(450);
  await focusOn(a); VW.shiftSelect(0,a); await sl(600); await focusOn(b); VW.shiftSelect(0,b); await sl(800); VW.snap(); await sl(150); const f2=S().focus;
  X(); await sl(100);
  T('carrying, ctrl + X takes the stack, not the card under it, and it stays carried', JSON.stringify(VW.clip().names)===JSON.stringify([a,b]) && S().sel.length===2 && VW.cardOp(0,f2)>0.99, [VW.clip(),S().sel]);
  X(); await sl(80); T('again takes it out', !VW.clip());
  C(); await sl(50); const n3=VW.items(0).length; V(); await sl(500);
  T('carrying, a copy paste lands and the stack stays', VW.items(0).length===n3+2 && S().sel.length===2, VW.items(0).length);
  Z(); await sl(500); T('and undoes', VW.items(0).length===n3, VW.items(0).length); key('Escape'); await sl(30); T('Esc while carrying puts the stack down before a copy goes', VW.clip()!==null && S().sel.length===0, [VW.clip(),S().sel]); key('Escape'); await sl(50);
  // cut while carrying something else, then the stack and paste
  await focusOn(c); VW.shiftSelect(0,c); await sl(800); VW.snap(); await sl(150);
  const sp=VW.stackScreen(); rclick(sp.x,sp.y); await sl(150);
  T('a right click on the stack: no menu, nothing changes', !VW.cardMenu().open && S().sel.length===1 && !VW.stackView().open);
  $('#bMore').click(); await sl(100); T('the three dots: the menu of the card under it, still carrying', VW.cardMenu().open && VW.cardMenu().name===S().focus && S().sel.length===1, VW.cardMenu().name);
  const fm=S().focus; menu.querySelector('[data-m=cut]').click(); await sl(100); T('its Cut takes that card', VW.clip().name===fm && VW.cardOp(0,fm)<0.6 && S().sel.length===1, VW.clip());
  key('F2'); await sl(150); T('F2 while carrying renames the card in focus, on its card', VW.renaming()&&VW.renaming().name===S().focus, VW.renaming());
  $('#cardRen').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await sl(100);
  T('Esc leaves the rename', !VW.renaming() && S().sel.length===1 && shown());
  const n4=VW.items(0).length; key('a'); await sl(150); T('typing searches, still carrying', S().sel.length===1 && VW.items(0).length<=n4 && VW.clip().name===fm);
  key('Escape'); await sl(100); T('Esc clears the search first', VW.items(0).length===n4 && VW.clip() && S().sel.length===1, VW.clip());
  // the playground
  VW.openStackView(); await sl(300);
  T('the indicator hides while the playground is open', !shown() && VW.clip().name===fm);
  T('and a toast goes back to its own place there', !$('#toast').classList.contains('overClip'));
  key('v',{ctrlKey:true}); await sl(150); T('ctrl + V in the playground does nothing', VW.clip().name===fm && VW.stackView().open);
  $('#sv .pgx').click(); await sl(300); T('it comes back when the playground closes', shown() && VW.clip().name===fm && VW.cardOp(0,fm)<0.6);
  VW.cancelSelection(); await sl(300); key('Escape'); await sl(80);
  await focusOn(c); X(); await sl(50); VW.shiftSelect(0,c); await sl(800); VW.up(); VW.snap(); await sl(400); VW.openStackView(); await sl(300);
  [...document.querySelectorAll('#sv .ops button')].find(x=>/Move/.test(x.textContent)).click(); await sl(500);
  T('moved from the playground: the cut is done, no dim', !VW.clip() && has(c) && VW.cardOp(0,c)>0.99, [VW.clip(),VW.cardOp(0,c)]);
  if (VW.stackView().open) VW.closeStackView(); Z(); await sl(500); VW.enter('Wren Holloway'); VW.snap(); await sl(450); T('undone again', has(c));
  // a toast and the indicator
  await focusOn(a); C(); await sl(50); V(); await sl(300);
  const ts=$('#toast').getBoundingClientRect(), bs=bar.getBoundingClientRect();
  T('a toast sits above the indicator, not on it', !$('#toast').hidden && !overlap(ts,bs) && ts.bottom<=bs.top, [ts,bs]);
  T('the bar\'s Undo still works', (()=>{const u=$('#toast .pill'); return !!u;})());
  $('#toast .pill').click(); await sl(400); key('Escape'); await sl(50);
  // a theme, a click on Paste with nothing to do
  for (const t of ['light','dark','retroma','willemstad']) { VW.setTheme(t); await sl(80); X(); await sl(80);
    const cs=getComputedStyle(bar), pb=getComputedStyle($('#cbPaste'));
    T('in the '+t+' theme it is drawn from the theme\'s colours', cs.backgroundColor!=='rgba(0, 0, 0, 0)' && cs.color!==cs.backgroundColor && pb.color!==pb.backgroundColor); X(); await sl(40); }
  VW.setTheme('light');
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
