(async function(){
  // the bar's plus button (a new folder or a new file, named in place) and its three dots (a right click on the card in
  // focus, for a touch screen). the bridge path is in plusbridgetest, the plugin's side in plugintest
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const $=s=>document.querySelector(s), plus=$('#bPlus'), pop=$('#plusPop'), dots=$('#bMore'), menu=$('#cardMenu'), cren=$('#cardRen');
  const toast=()=>{const t=$('#toast'); return t.hidden?'':t.textContent;};
  const S=()=>VW.state(), has=n=>VW.items(0).includes(n), R=()=>VW.renaming();
  const kindOf=n=>{const p=VW.places().find(x=>x.name===n); return p&&p.kind;};
  const press=(el,type)=>{ const r=el.getBoundingClientRect(), o={bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:0,pointerId:81,pointerType:type||'mouse'};
    el.dispatchEvent(new PointerEvent('pointerdown',o)); el.dispatchEvent(new PointerEvent('pointerup',o)); el.click(); };
  const away=(type)=>{ const st=$('#stage'), o={bubbles:true,clientX:20,clientY:500,button:0,pointerId:82,pointerType:type||'mouse'}; st.dispatchEvent(new PointerEvent('pointerdown',o)); window.dispatchEvent(new PointerEvent('pointerup',o)); };
  const ckey=k=>cren.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));
  const type=v=>{ cren.value=v; cren.dispatchEvent(new Event('input',{bubbles:true})); };
  const newFile=async()=>{ press(plus); await sl(60); press(pop.querySelector('[data-new=file]')); await sl(350); };
  const focusOn=async name=>{ VW.spinTo(VW.items(0).indexOf(name)); await sl(500); VW.snap(); await sl(200); };
  const onScreen=r=>r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;
  window.confirm=()=>true;
  for (let i=0;i<80&&(typeof VW==='undefined'||!VW.items(0).length);i++) await sl(250); await sl(500); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(500);
  // the bar
  const row=[...$('#bar').children].map(c=>c.id).filter(Boolean);
  T('the bar reads plus, three dots, sort, save, theme on its right', row.slice(-5).join()==='plusWrap,bMore,dirWrap,bBoards,bTheme', row.join());
  T('the folder button is gone', !$('#bNew'));
  { const a=plus.getBoundingClientRect(), b=$('#bBoards').getBoundingClientRect(), c=dots.getBoundingClientRect(); T('plus and the dots are square, the same size as the rest', a.width===b.width&&a.height===b.height&&c.width===b.width&&a.width===a.height, a.width+'x'+a.height); }
  // the plus list
  press(plus); await sl(60);
  { const a=plus.getBoundingClientRect(), p=pop.getBoundingClientRect(), bs=[...pop.children].map(b=>b.textContent);
    T('plus opens a list right under the button', !pop.hidden&&p.top>=a.bottom&&p.top-a.bottom<14&&p.right>=a.right-1&&plus.getAttribute('aria-expanded')==='true', JSON.stringify(p));
    T('with the two choices', bs.join()==='New folder,New file', bs.join()); }
  press(plus); await sl(60);
  T('a second press closes it', pop.hidden&&plus.getAttribute('aria-expanded')==='false');
  press(plus); await sl(60); away(); await sl(60);
  T('so does a press elsewhere', pop.hidden);
  plus.focus(); plus.click(); await sl(60);
  T('from the keyboard it takes the focus', document.activeElement===pop.firstChild, document.activeElement&&document.activeElement.textContent);
  pop.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); T('down walks it', document.activeElement===pop.lastChild);
  pop.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await sl(60);
  T('Esc closes it and the focus goes back', pop.hidden&&document.activeElement===plus); plus.blur();
  // a new folder, as ever
  press(plus); await sl(60); press(pop.querySelector('[data-new=folder]')); await sl(300);
  T('new folder makes one, its name ready to type over its card', has('New folder')&&R()&&R().focused&&cren.value==='New folder'&&pop.hidden, JSON.stringify(R()));
  ckey('Escape'); await sl(100); window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true})); await sl(400);
  T('and an undo takes it away', !has('New folder'), toast());
  // a new file
  const n0=VW.items(0).length, f0=S().focus;
  await newFile();
  let r=R();
  T('new file makes a card with its name ready to type', has('New file')&&r&&r.draft&&r.focused&&r.value==='New file'&&pop.hidden, JSON.stringify(r));
  T('the whole default name is picked, so typing replaces it', r&&r.sel[0]===0&&r.sel[1]==='New file'.length, JSON.stringify(r&&r.sel));
  T('it shows the mystery icon', kindOf('New file')==='mystery'&&r.liveKind==='mystery', kindOf('New file'));
  T('it comes into focus', S().focus==='New file', S().focus);
  ckey('Escape'); await sl(600); VW.snap(); await sl(100);
  T('Esc leaves nothing behind', !has('New file')&&VW.items(0).length===n0&&!R()&&cren.hidden, JSON.stringify(VW.items(0).slice(0,3)));
  T('and the focus goes back to where it was', S().focus===f0, S().focus);
  await newFile(); away(); await sl(300);
  T('a press elsewhere leaves nothing behind too', !has('New file')&&!R()&&VW.items(0).length===n0);
  await newFile(); type('song.mp3'); await sl(60);
  T('the icon follows the extension as it is typed', R().liveKind==='audio', R().liveKind);
  type('song.'); await sl(60); T('and an extension it does not know is a plain file', R().liveKind==='other', R().liveKind);
  type('song'); await sl(60); T('and no extension is the mystery icon again', R().liveKind==='mystery', R().liveKind);
  T('the card itself keeps its plain shape while typing', kindOf('New file')==='mystery');
  type('Sketch.png'); ckey('Enter'); await sl(500);
  T('Enter saves it under the name typed', has('Sketch.png')&&!has('New file')&&!R()&&cren.hidden&&S().focus==='Sketch.png', S().focus);
  T('the card takes that type', kindOf('Sketch.png')==='image', kindOf('Sketch.png'));
  T('an Undo is offered', /Made Sketch\.png/.test(toast())&&!!$('#toast .pill'), toast());
  // a name taken, or one that cannot be
  await newFile(); type('Sketch.png'); ckey('Enter'); await sl(200);
  T('a name that is taken is refused, the field stays open', R()&&R().draft&&/already here/.test(toast())&&has('Sketch.png'), toast());
  type('a/b.md'); ckey('Enter'); await sl(200);
  T('a slash is refused', R()&&R().draft&&/cannot have/.test(toast()), toast());
  type('.hid'); ckey('Enter'); await sl(200);
  T('a leading dot is refused', R()&&R().draft&&/dot/.test(toast()), toast());
  type('  '); ckey('Enter'); await sl(200);
  T('an empty name is refused', R()&&R().draft&&/Type a name/.test(toast()), toast());
  T('and it is still in the same field', R().focused);
  type('Plain'); ckey('Enter'); await sl(500);
  T('a name with no extension is allowed, and keeps the mystery icon', has('Plain')&&kindOf('Plain')==='mystery', kindOf('Plain'));
  // the default name saved as it is, then numbered
  await newFile(); ckey('Enter'); await sl(500);
  T('Enter on the default name saves it', has('New file')&&!R(), JSON.stringify(R()));
  await newFile();
  T('a second one is numbered', R()&&R().value==='New file 2', R()&&R().value);
  ckey('Escape'); await sl(500);
  T('the first is not touched by that Esc', has('New file')&&!has('New file 2'));
  // undo
  await focusOn('New file');
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true})); await sl(400);
  T('an undo takes a saved file away', !has('New file')&&/\.trash/.test(toast()), toast());
  // the three dots, in every view, by touch, on a file and a folder
  const md=VW.items(0).find(n=>/\.md$/.test(n));
  for (const [t,label] of [[0,'the normal view'],[1,'the mirrored view'],[0.5,'the centre view']]) {
    VW.flipTo(t); await sl(1800); await focusOn(md);
    press(dots,'touch'); await sl(100);
    let m=VW.cardMenu(); const b=dots.getBoundingClientRect();
    T('the dots open the menu of the card in focus in '+label, m.open&&m.name===md&&dots.getAttribute('aria-expanded')==='true', JSON.stringify(m.name));
    T('under the button and on screen in '+label, m.rect.y>=b.bottom&&m.rect.y-b.bottom<14&&onScreen({left:m.rect.x,top:m.rect.y,right:m.rect.x+m.rect.w,bottom:m.rect.y+m.rect.h}), JSON.stringify(m.rect));
    press(dots,'touch'); await sl(100);
    T('a second press closes it in '+label, !VW.cardMenu().open&&dots.getAttribute('aria-expanded')==='false');
    press(dots,'touch'); await sl(60); away('touch'); await sl(60);
    T('a tap elsewhere closes it in '+label, !VW.cardMenu().open);
  }
  VW.flipTo(0); await sl(1800); VW.up(); VW.snap(); await sl(500);
  const dirName=S().focus;
  press(dots,'touch'); await sl(100);
  { const m=VW.cardMenu(); T('on a folder the dots give its menu', m.open&&m.name===dirName&&/Folder/.test(m.info), JSON.stringify([m.name,m.info])); }
  menu.querySelector('[data-m=rename]').click(); await sl(150);
  T('its pencil starts the rename', R()&&R().value===dirName, JSON.stringify(R())); ckey('Escape'); await sl(100);
  VW.enter('Wren Holloway'); VW.snap(); await sl(500);
  // an empty folder: the menu is for the folder itself
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'n',ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true})); await sl(300); ckey('Escape'); await sl(100);
  VW.enter('New folder'); VW.snap(); await sl(600);
  T('(an empty folder)', VW.items(0).length===0&&!S().focus, JSON.stringify(S().focus));
  press(dots,'touch'); await sl(100);
  { const m=VW.cardMenu(); T('with nothing in focus the dots give the folder\'s own menu', m.open&&m.name==='New folder', JSON.stringify(m.name)); }
  press(dots,'touch'); await sl(60);
  await newFile(); type('first.md'); ckey('Enter'); await sl(500);
  T('a new file works in an empty folder', has('first.md')&&S().focus==='first.md', JSON.stringify(VW.items(0)));
  VW.up(); VW.snap(); await sl(500);
  // under a stack
  await focusOn(md); const other=VW.items(0).find(n=>n!==md&&/\.md$/.test(n));
  VW.shiftSelect(0,other); await sl(900); VW.snap(); await sl(200);
  await focusOn(md);
  press(dots,'touch'); await sl(100);
  { const m=VW.cardMenu(); T('under a stack the dots are still for the card in focus, and the stack stays', m.open&&m.name===md&&VW.stackView, JSON.stringify(m.name)); }
  press(dots,'touch'); await sl(60);
  await newFile();
  T('a new file can be named under a stack', R()&&R().draft, JSON.stringify(R()));
  ckey('Escape'); await sl(400);
  T('and Esc leaves nothing', !has('New file')&&!R());
  VW.cancelSelection(); await sl(600); VW.snap(); await sl(200);
  // the playground has its own menu: no card menu over it
  VW.shiftSelect(0,md); await sl(900); VW.snap(); await sl(100); VW.openStackView(); await sl(300);
  press(dots); await sl(100);
  T('the dots give no card menu while the playground is open', VW.stackView().open&&!VW.cardMenu().open);
  VW.closeStackView(); await sl(200); VW.cancelSelection(); await sl(600);
  // a phone's width: the whole bar shrinks in proportion, so the buttons stay square and side by side with room for the path
  const pin=document.createElement('style'); pin.textContent='#app{position:absolute;left:0;top:0;width:390px!important;height:844px!important;overflow:hidden}'; document.head.appendChild(pin); dispatchEvent(new Event('resize')); await sl(500);
  { const rs=['#bPlus','#bMore','#bDir','#bBoards','#bTheme'].map(s=>$(s).getBoundingClientRect()), pth=$('#path').getBoundingClientRect();
    T('at 390 px every button is on the bar, in a row, all the same square, and none overlaps the crumbs', rs.every((x,i)=>x.right<=390&&Math.abs(x.width-rs[0].width)<0.5&&Math.abs(x.width-x.height)<0.5&&(!i||x.left>rs[i-1].right))&&pth.right<=rs[0].left, rs.map(x=>x.left).join()+' path to '+pth.right);
    T('and they have shrunk with the bar, leaving the path room', rs[0].width<30&&rs[0].width>18&&rs[0].left>190, 'button '+rs[0].width+' first at '+rs[0].left); }
  pin.remove(); dispatchEvent(new Event('resize')); await sl(300);
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
