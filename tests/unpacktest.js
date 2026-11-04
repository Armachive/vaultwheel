(async function(){
  // a folder on the board: a double click pours its files onto the board as cards of their own, in place of the folder
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const $=s=>document.querySelector(s);
  const pe=(el,t,x,y,o={})=>el.dispatchEvent(new PointerEvent(t,Object.assign({bubbles:true,clientX:x,clientY:y,button:0,pointerId:51,pointerType:'mouse'},o)));
  const mid=el=>{const r=el.getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2];};
  await sl(1500); VW.enter('Thornvale'); VW.snap(); await sl(600);
  const folder='Wren Holloway', nIn=(()=>{ VW.enter(folder); VW.snap(); const n=VW.items(0).length; VW.up(); VW.snap(); return n; })(); await sl(800);
  VW.spinTo(VW.items(0).indexOf(folder)); await sl(500); VW.snap(); VW.shiftSelect(0,folder); await sl(1200);
  T('the folder is carried', VW.state().sel.length===1 && VW.state().sel[0]===folder, JSON.stringify(VW.state().sel));
  VW.openStackView(); await sl(500);
  const box=$('#sv .item'); T('it is one card on the board', !!box && document.querySelectorAll('#sv .item').length===1);
  const [x,y]=mid(box), sv=$('#sv');
  pe(box,'pointerdown',x,y); pe(sv,'pointerup',x,y); await sl(60); pe(box,'pointerdown',x,y); pe(sv,'pointerup',x,y); await sl(2500);
  const cards=document.querySelectorAll('#sv .item').length, st=VW.state();
  T('a double click pours its files onto the board', cards===nIn && st.sel.length===nIn && !st.sel.includes(folder), 'cards '+cards+' carried '+st.sel.length+' want '+nIn);
  T('the board is still open and nothing is in empty space', VW.stackView().open && [...document.querySelectorAll('#sv .item')].every(b=>b.style.width), JSON.stringify(VW.stackView()));
  // the poured files are real: one can be ticked off and the rest moved here
  $('#sv .item .tick').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:52})); await sl(150);
  T('a poured file can be unticked', document.querySelectorAll('#sv .item.off').length===1);
  window.confirm=()=>true; const here=VW.items(0).length;
  $('#sv .ops [data-op=move]').click(); await sl(1500);
  T('Move here moves the ticked ones into this folder', VW.items(0).length===here+nIn-1 && VW.state().sel.length===1, VW.items(0).length+' want '+(here+nIn-1)+', carried '+VW.state().sel.length);
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
