(async function(){
  // batch jobs in the playground: rename with a pattern (a preview, clashes refused, numbered in board order, undo) and
  // duplicate (each copy next to its file, undo puts the copies away)
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true},o)));
  const op=k=>document.querySelector('#sv .ops [data-op='+k+']');
  const ren=()=>document.querySelector('#sv .pgren');
  const titles=()=>[...document.querySelectorAll('#sv .item')].map(b=>b.title);
  const toast=()=>{const t=document.getElementById('toast'); return t.hidden?'':t.textContent;};
  const type=v=>{const i=ren().querySelector('input'); i.value=v; i.dispatchEvent(new Event('input',{bubbles:true}));};
  window.confirm=()=>true;
  const pick=async names=>{ for(const n of names){ VW.spinTo(VW.items(0).indexOf(n)); await sl(500); VW.snap(); await sl(100); VW.shiftSelect(0,n); await sl(900); VW.snap(); await sl(100); } };
  await sl(1500); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  const all=VW.items(0), files=all.filter(n=>/\.md$/i.test(n)).slice(0,3);
  T('three notes to work with', files.length===3, JSON.stringify(files));
  await pick(files); VW.openStackView(); await sl(300);
  const before=titles();
  VWpg.op('ren'); await sl(200);
  T('Rename opens with a pattern', !ren().hidden && ren().querySelector('input').value==='* #', ren().querySelector('input').value);
  type('Note #'); await sl(100);
  const pv=[...ren().querySelectorAll('.pv li')].map(l=>l.textContent);
  T('the preview shows the new names', pv.length===3 && /→  Note 1\.md$/.test(pv[0]) && /→  Note 3\.md$/.test(pv[2]), JSON.stringify(pv));
  // a name that cannot be used is refused before anything changes
  type('a/b #'); await sl(100);
  T('a name with / in it is refused', ren().querySelector('[data-r=go]').disabled && ren().querySelector('.tip').classList.contains('bad'), ren().querySelector('.tip').textContent);
  type('Note #'); await sl(100);
  key('Escape'); await sl(150);
  T('Esc closes the rename, not the playground', ren().hidden && VW.stackView().open, JSON.stringify(VW.stackView()));
  VWpg.op('ren'); await sl(150); type('Note #'); await sl(100);
  ren().querySelector('[data-r=go]').click(); await sl(1200);
  const after=titles();
  T('Rename renames them all', ['Note 1.md','Note 2.md','Note 3.md'].every(n=>after.includes(n)) && VW.state().sel.length===3, JSON.stringify(after));
  T('the toast offers Undo', /Undo$/.test(toast()), toast());
  key('z',{ctrlKey:true}); await sl(1200);
  T('ctrl + Z puts the old names back', before.every(n=>titles().includes(n)), JSON.stringify(titles()));
  // duplicate: the copies show in the folder (the originals are carried, so they are not in its row)
  const n0=VW.items(0).length;
  VWpg.op('dup'); await sl(1200);
  const withCopies=VW.items(0);
  T('Duplicate makes a copy of each', withCopies.length===n0+3 && files.every(n=>withCopies.includes(n.replace(/\.md$/,' copy.md'))), n0+' -> '+withCopies.length);
  T('the originals stay carried', VW.state().sel.length===3 && VW.stackView().open, JSON.stringify(VW.state().sel));
  key('z',{ctrlKey:true}); await sl(1200);
  T('ctrl + Z puts the copies away', VW.items(0).length===n0, VW.items(0).length+' want '+n0);
  key('Escape'); await sl(300);
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
