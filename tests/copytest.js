(async function(){
  // the playground's Copy here and the undo for Move here and Copy here: copies land in the folder you are in and the
  // originals stay put; ctrl + Z puts moved files back where they came from and takes copies away again
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true},o)));
  const op=k=>document.querySelector('#sv .ops [data-op='+k+']');
  const toast=()=>{const t=document.getElementById('toast'); return t.hidden?'':t.textContent;};
  window.confirm=()=>true;
  const pick=async names=>{ for(const n of names){ VW.spinTo(VW.items(0).indexOf(n)); await sl(500); VW.snap(); await sl(100); VW.shiftSelect(0,n); await sl(900); VW.snap(); await sl(100); } };
  await sl(1500); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  const home=VW.items(0), files=home.filter(n=>/\.(md|png|jpg)$/i.test(n)).slice(0,2);
  T('two files to work with', files.length===2, JSON.stringify(files));
  // Copy here
  await pick(files); VW.up(); VW.snap(); await sl(600);
  const up0=VW.items(0).length;
  VW.openStackView(); await sl(300);
  T('copy here is reachable (off the panel now)', typeof VWpg.op==='function');
  VWpg.op('copy'); await sl(800);
  const up1=VW.items(0);
  T('Copy here puts copies in this folder', up1.length===up0+2 && files.every(n=>up1.includes(n)), up0+' -> '+up1.length);
  T('the stack empties and the board closes', VW.state().sel.length===0 && !VW.stackView().open, JSON.stringify(VW.state().sel));
  T('the toast offers Undo', /Undo$/.test(toast()), toast());
  VW.enter('Wren Holloway'); VW.snap(); await sl(500);
  T('the originals stay where they were', files.every(n=>VW.items(0).includes(n)) && VW.items(0).length===home.length, VW.items(0).length+' want '+home.length);
  VW.up(); VW.snap(); await sl(500);
  key('z',{ctrlKey:true}); await sl(800);
  T('ctrl + Z takes the copies away again', VW.items(0).length===up0 && files.every(n=>!VW.items(0).includes(n)), VW.items(0).length+' want '+up0);
  // Move here, then undo
  VW.enter('Wren Holloway'); VW.snap(); await sl(500);
  await pick(files); VW.up(); VW.snap(); await sl(600);
  VW.openStackView(); await sl(300); op('move').click(); await sl(800);
  T('Move here moves them here', VW.items(0).length===up0+2, VW.items(0).length+' want '+(up0+2));
  key('z',{ctrlKey:true}); await sl(800);
  T('ctrl + Z moves them back out', VW.items(0).length===up0, VW.items(0).length+' want '+up0);
  VW.enter('Wren Holloway'); VW.snap(); await sl(500);
  T('they are back home', files.every(n=>VW.items(0).includes(n)) && VW.items(0).length===home.length, VW.items(0).length+' want '+home.length);
  key('z',{ctrlKey:true}); await sl(300);
  T('nothing left to undo', /Nothing to undo/.test(toast()), toast());
  // a folder copied into the folder it is already in gets a numbered name, like a duplicate
  VW.up(); VW.snap(); await sl(500);
  const v0=VW.items(0).length; await pick(['Wren Holloway']);
  VW.openStackView(); await sl(300); VWpg.op('copy'); await sl(800);
  T('a copy where the name is taken is numbered', VW.items(0).includes('Wren Holloway copy') && VW.items(0).includes('Wren Holloway') && VW.items(0).length===v0+1, JSON.stringify(VW.items(0).filter(n=>/Wren/.test(n))));
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
