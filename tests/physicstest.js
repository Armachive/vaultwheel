(async function(){
  // the playground's layout and physics: the side panel on the right, the close button top right, small cards that start
  // in the middle at zoom 1, files that push apart and settle, ties from a card's dot to another card, a tied card
  // following the one dragged, a tap on a tie undoing it
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const $=s=>document.querySelector(s);
  const pe=(el,type,x,y,o={})=>el.dispatchEvent(new PointerEvent(type,Object.assign({bubbles:true,clientX:x,clientY:y,button:0,pointerId:31,pointerType:'mouse'},o)));
  const mid=el=>{const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,r};};
  const pick=async names=>{ for(const n of names){ VW.spinTo(VW.items(0).indexOf(n)); await sl(500); VW.snap(); await sl(100); VW.shiftSelect(0,n); await sl(900); VW.snap(); await sl(100); } };
  await sl(1500); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  const files=VW.items(0).filter(n=>/\.md$/i.test(n)).slice(0,3);
  await pick(files); VW.openStackView(); await sl(2500);
  const sv=$('#sv'), ops=$('#sv .ops').getBoundingClientRect(), x=$('#sv .pgx').getBoundingClientRect();
  T('the side panel is on the right', ops.right>innerWidth-30 && ops.left>innerWidth/2, Math.round(ops.left)+'..'+Math.round(ops.right));
  T('the close button is top right', x.right>innerWidth-60 && x.top<120 && x.width>0, Math.round(x.left)+','+Math.round(x.top));
  const boxes=[...document.querySelectorAll('#sv .item')];
  T('three cards on the board', boxes.length===3, boxes.length);
  T('the zoom starts at 1', VW.stackView().z===1, VW.stackView().z);
  T('the cards are small', boxes.every(b=>b.getBoundingClientRect().height<=innerHeight*0.2), JSON.stringify(boxes.map(b=>Math.round(b.getBoundingClientRect().height))));
  const c=boxes.map(b=>mid(b)), cx=c.reduce((s,p)=>s+p.x,0)/3, cy=c.reduce((s,p)=>s+p.y,0)/3;
  T('they sit around the middle', Math.abs(cx-(innerWidth-96)/2)<innerWidth*0.15 && Math.abs(cy-innerHeight/2)<innerHeight*0.15, Math.round(cx)+','+Math.round(cy));
  const over=(a,b)=>{const p=a.getBoundingClientRect(), q=b.getBoundingClientRect(); return Math.max(0,Math.min(p.right,q.right)-Math.max(p.left,q.left))*Math.max(0,Math.min(p.bottom,q.bottom)-Math.max(p.top,q.top));};
  T('they settle without covering each other', over(boxes[0],boxes[1])+over(boxes[0],boxes[2])+over(boxes[1],boxes[2])<200, [over(boxes[0],boxes[1]),over(boxes[0],boxes[2]),over(boxes[1],boxes[2])].map(Math.round).join(','));
  // a canvas: an untied file stays exactly where it is
  const r0=boxes.map(b=>b.style.left+b.style.top); await sl(1500);
  T('untied files stay where they are', boxes.every((b,i)=>b.style.left+b.style.top===r0[i]), JSON.stringify(r0));
  // a string: hold the first file still, then take the pointer to the second and let go there
  const [A,B]=boxes, k=mid(A), b=mid(B);
  pe(A,'pointerdown',k.x,k.y); await sl(700);
  T('holding a file still lets out a string', !!document.querySelector('#sv .links .tie.draft') && A.classList.contains('stringing'));
  pe(sv,'pointermove',(k.x+b.x)/2,(k.y+b.y)/2); await sl(50); pe(sv,'pointermove',b.x,b.y); await sl(50); pe(sv,'pointerup',b.x,b.y); await sl(300);
  T('letting go on another file ties them', document.querySelectorAll('#sv .links .tie:not(.draft)').length===1, document.querySelectorAll('#sv .links .tie').length);
  // drag the first card well away: the tied one follows, the other does not come along as far
  await sl(1500);
  const a0=mid(A), b0=mid(B), c0=mid(boxes[2]);
  pe(A,'pointerdown',a0.x,a0.y,{pointerId:32});
  for(let i=1;i<=10;i++){ pe(sv,'pointermove',a0.x-30*i,a0.y+12*i,{pointerId:32}); await sl(80); }
  await sl(1500);
  const b1=mid(B), c1=mid(boxes[2]), bMoved=Math.hypot(b1.x-b0.x,b1.y-b0.y), cMoved=Math.hypot(c1.x-c0.x,c1.y-c0.y);
  pe(sv,'pointerup',a0.x-300,a0.y+120,{pointerId:32}); await sl(200);
  T('the tied card follows', bMoved>120 && bMoved>cMoved*1.5, 'tied '+Math.round(bMoved)+'px, other '+Math.round(cMoved)+'px');
  // a tap on the tie undoes it
  await sl(1500);
  const line=$('#sv .links .tie'), lr=line.getBoundingClientRect();
  line.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:lr.left+lr.width/2,clientY:lr.top+lr.height/2,button:0,pointerId:33}));
  await sl(200);
  T('a tap on a tie undoes it', document.querySelectorAll('#sv .links .tie').length===0, document.querySelectorAll('#sv .links .tie').length);
  // a double click opens a note up in place: bigger, a bar with Open, its text embedded (the preview says where the text shows)
  const N=boxes[2], h0=N.getBoundingClientRect().height, n0=mid(N);
  const tapN=async()=>{ pe(N,'pointerdown',n0.x,n0.y,{pointerId:34}); await sl(30); pe(sv,'pointerup',n0.x,n0.y,{pointerId:34}); await sl(60); };
  await tapN(); await tapN(); await sl(400);
  const txt=N.querySelector('.embed .txt');
  T('a double click opens a note up in place', N.classList.contains('big') && N.getBoundingClientRect().height>h0*2 && !!N.querySelector('.xbar [data-x=open]'), Math.round(h0)+' -> '+Math.round(N.getBoundingClientRect().height));
  T('the note shows its text, or where it can', !!txt && /Obsidian|\S/.test(txt.textContent) && !/Opening/.test(txt.textContent), txt && txt.textContent.slice(0,80));
  N.querySelector('.xbar [data-x=shrink]').click(); await sl(300);
  T('and shrinks back', !N.classList.contains('big') && Math.abs(N.getBoundingClientRect().height-h0)<2 && !N.querySelector('.embed'), Math.round(N.getBoundingClientRect().height)+' want '+Math.round(h0));
  // a saved board: save it, put everything back, open the board again from anywhere and load it
  window.confirm=()=>true;
  const before=boxes.map(b=>b.title+'@'+b.style.left+','+b.style.top).sort(), z0=VW.stackView().z;
  VWpg.openBoards(); await sl(300);
  // the boards card does not take the keyboard on its own, and goes with its ✕ or a tap outside it
  T('the boards card opens without grabbing the focus', !document.querySelector('#sv .pgboards').hidden && document.activeElement!==document.querySelector('#sv .pgboards input'), document.activeElement && document.activeElement.tagName);
  document.querySelector('#sv .pgboards [data-b=close]').click(); await sl(150);
  T('its ✕ closes it', document.querySelector('#sv .pgboards').hidden);
  VWpg.openBoards(); await sl(300);
  pe(sv,'pointerdown',30,innerHeight-30,{pointerId:36}); await sl(20); pe(sv,'pointerup',30,innerHeight-30,{pointerId:36}); await sl(150);
  T('a tap outside closes it, the board stays open', document.querySelector('#sv .pgboards').hidden && VW.stackView().open);
  VWpg.openBoards(); await sl(300);
  const bIn=document.querySelector('#sv .pgboards input'); bIn.value='Test board'; document.querySelector('#sv .pgboards [data-b=save]').click(); await sl(400);
  T('saving a board lists it', [...document.querySelectorAll('#sv .pgboards .bl li span')].some(s=>s.textContent==='Test board'), document.querySelector('#sv .pgboards').textContent.slice(0,80));
  // save over: the saved board takes this board's state, under its old name
  const row=[...document.querySelectorAll('#sv .pgboards .bl li')].find(l=>l.querySelector('span').textContent==='Test board');
  const first=VWpg.boards().find(b=>b.name==='Test board'), tBefore=first.t, nBefore=first.items.length;
  await sl(20); row.querySelector('button').click(); await sl(400);
  const saved=VWpg.boards().filter(b=>b.name==='Test board');
  T('the save icon saves over the board under its name', saved.length===1 && saved[0].items.length===nBefore && saved[0].t>tBefore, JSON.stringify(saved.map(b=>[b.items.length,b.t-tBefore])));
  $('#sv .pgx').click(); await sl(300); VW.cancelSelection(); await sl(500);
  T('the carry is empty', VW.state().sel.length===0, JSON.stringify(VW.state().sel));
  VWpg.openBoards(); await sl(400);
  T('the boards open with nothing carried', VW.stackView().open && !document.querySelector('#sv .pgboards').hidden, JSON.stringify(VW.stackView()));
  const li=[...document.querySelectorAll('#sv .pgboards .bl li')].find(l=>l.querySelector('span').textContent==='Test board');
  [...li.querySelectorAll('button')].find(b=>b.textContent==='Open').click(); await sl(1500);
  const after=[...document.querySelectorAll('#sv .item')].map(b=>b.title+'@'+b.style.left+','+b.style.top).sort();
  T('opening it carries the same files, each where it was', VW.state().sel.length===3 && JSON.stringify(after)===JSON.stringify(before), JSON.stringify(after)+' want '+JSON.stringify(before));
  T('the view is the saved one', Math.abs(VW.stackView().z-z0)<0.001, VW.stackView().z+' want '+z0);
  $('#sv .pgx').click(); await sl(300);
  T('the close button leaves the playground', !VW.stackView().open && VW.state().sel.length===3, JSON.stringify(VW.stackView()));
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
