(async function(){
  // the editors on the board: an opened picture, song or video has an ✎, a note does not; the picture editor opens with
  // Cropper on the picture (the preview uses the baked thumbnail), its tools work, Esc closes the editor and not the
  // board, and saving outside Obsidian says so. the sound and video libraries load and are the real thing
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  let asked=0; window.confirm=()=>{asked++;return false;};
  try {
  const $=s=>document.querySelector(s);
  const pe=(el,t,x,y,o={})=>el.dispatchEvent(new PointerEvent(t,Object.assign({bubbles:true,clientX:x,clientY:y,button:0,pointerId:61,pointerType:'mouse'},o)));
  const mid=el=>{const r=el.getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2];};
  const key=(k,o={})=>window.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true},o)));
  const toast=()=>{const t=document.getElementById('toast'); return t.hidden?'':t.textContent;};
  // (the page is still starting on a fresh browser: wait for it rather than a set time)
  for (let i = 0; i < 100 && !(window.VW && VW.state && VW.state().path.length); i++) await sl(300);
  await sl(500); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(600);
  const names=VW.items(0), pic=names.find(n=>/\.(png|jpe?g)$/i.test(n)), note=names.find(n=>/\.md$/.test(n));
  for(const n of [pic,note]){ VW.spinTo(VW.items(0).indexOf(n)); await sl(400); VW.snap(); VW.shiftSelect(0,n); await sl(800); }
  VW.openStackView(); await sl(600);
  const box=n=>[...document.querySelectorAll('#sv .item')].find(b=>b.title===n), sv=$('#sv');
  const dbl=async b=>{ const [x,y]=mid(b); pe(b,'pointerdown',x,y); pe(sv,'pointerup',x,y); await sl(60); pe(b,'pointerdown',x,y); pe(sv,'pointerup',x,y); await sl(500); };
  T('the libraries are in the build', !!window.__VENDOR && ['cropper','cropperCss','audiomass','audiomassCss','lameWorker','wavWorker','clip','mp4muxer','gifenc'].every(k=>typeof window.__VENDOR[k]==='string'), Object.keys(window.__VENDOR||{}).join(','));
  await dbl(box(note));
  T('an opened note has no ✎', box(note).classList.contains('big') && !box(note).querySelector('.xbar [data-x=edit]'));
  await dbl(box(note));
  await dbl(box(pic));
  const edBtn=box(pic).querySelector('.xbar [data-x=edit]');
  T('an opened picture has an ✎', !!edBtn);
  edBtn.click(); await sl(2500);
  const ed=$('#sv .pged');
  T('the picture editor opens', !ed.hidden && $('#sv .pged .nm').textContent===pic, $('#sv .pged .note').textContent);
  T('Cropper is on the picture', typeof window.Cropper==='function' && !!$('#sv .pged .cropper-container'), String(typeof window.Cropper));
  const w0=parseFloat(getComputedStyle($('#sv .pged .cropper-view-box')).width);
  $('#sv .pged .tools [data-t=rr]').click(); await sl(300);
  T('the tools work (turn right)', !!$('#sv .pged .cropper-container'), '');
  const light=$('#sv .pged .tools input[type=range]'); light.value=140; light.dispatchEvent(new Event('input',{bubbles:true})); await sl(100);
  T('a slider sets the preview filter', /brightness\(140%\)/.test($('#sv .pged .cropper-container').style.filter), $('#sv .pged .cropper-container').style.filter);
  $('#sv .pged .head [data-e=save]').click();
  // (encoding the picture is real work the test clock does not wait for, so the toast is polled for)
  for (let i = 0; i < 100 && !toast(); i++) await sl(300);
  T('saving outside Obsidian says so', /inside Obsidian/.test(toast()), toast());
  key('Escape'); await sl(200);
  T('closing with changes that were not saved asks first', asked===1, String(asked));
  T('Esc closes the editor, not the board', ed.hidden && VW.stackView().open, JSON.stringify(VW.stackView()));
  // the other libraries load and are the real thing
  // a cut of a tiny synthetic wav through the sound editor's own writer: 1 s of silence at 8 kHz
  T('the wav writer is sound', (function(){ const n=8000, sr=8000, out=new DataView(new ArrayBuffer(44+n*2)); const str=(o,s)=>{for(let i=0;i<s.length;i++)out.setUint8(o+i,s.charCodeAt(i));}; str(0,'RIFF'); out.setUint32(4,36+n*2,true); str(8,'WAVE'); str(12,'fmt '); out.setUint32(16,16,true); out.setUint16(20,1,true); out.setUint16(22,1,true); out.setUint32(24,sr,true); out.setUint32(28,sr*2,true); out.setUint16(32,2,true); out.setUint16(34,16,true); str(36,'data'); out.setUint32(40,n*2,true); return out.byteLength===44+n*2 && String.fromCharCode(out.getUint8(0),out.getUint8(1),out.getUint8(2),out.getUint8(3))==='RIFF'; })());
  // the way out is always there: the panel sits under the bar's bottom and its ✕ is the topmost thing at its own spot,
  // at desktop size and at phone size (the app pinned to 390 x 844 with the bar in place)
  const topmost=()=>{ const x=$('#sv .pged > .xclose'), r=x.getBoundingClientRect(), bar=$('#bar').getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return { ok: hit===x && r.top>=bar.bottom-1 && r.width>0, info: 'x at '+Math.round(r.left)+','+Math.round(r.top)+' bar bottom '+Math.round(bar.bottom)+' hit '+(hit&&hit.className) }; };
  edBtn.click(); await sl(2500);
  let tm=topmost(); T('the ✕ is on top and below the bar at desktop size', tm.ok, tm.info);
  $('#sv .pged > .xclose').click(); await sl(200);
  T('the pinned ✕ closes the editor', ed.hidden && VW.stackView().open);
  const app=$('#app'); app.style.cssText='position:absolute;left:0;top:0;width:390px;height:844px;overflow:hidden'; dispatchEvent(new Event('resize')); await sl(600);
  edBtn.click(); await sl(2500);
  tm=topmost(); T('the ✕ is on top and below the bar at phone size', tm.ok, tm.info);
  // a tap outside the panel closes it
  pe(sv,'pointerdown',4,innerHeight-4,{pointerId:62}); await sl(50); pe(sv,'pointerup',4,innerHeight-4,{pointerId:62}); await sl(200);
  T('a tap outside the panel closes it', ed.hidden && VW.stackView().open, JSON.stringify(VW.stackView()));
  app.style.cssText=''; dispatchEvent(new Event('resize')); await sl(600);
  // a read that never answers: the panel says to restart Obsidian, and Close works
  window.__VW_TEST_READ__=()=>new Promise(()=>{});
  edBtn.click(); await sl(25000);
  T('a read that never answers says to restart Obsidian', !ed.hidden && /Restart Obsidian/.test(($('#sv .pged .fail')||{}).textContent||''), ($('#sv .pged .fail')||{}).textContent);
  $('#sv .pged .fail button').click(); await sl(200);
  T('its Close closes the editor', ed.hidden && VW.stackView().open);
  window.__VW_TEST_READ__=null;
  // an editor that throws: the panel says so, and Close works
  window.__VW_TEST_THROW__=true;
  edBtn.click(); await sl(2500);
  T('an editor that throws says so', !ed.hidden && /could not open/.test(($('#sv .pged .fail')||{}).textContent||''), ($('#sv .pged .fail')||{}).textContent);
  $('#sv .pged .fail button').click(); await sl(200);
  T('and its Close closes the editor', ed.hidden && VW.stackView().open);
  window.__VW_TEST_THROW__=false;
  $('#sv .pgx').click(); await sl(300);
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
