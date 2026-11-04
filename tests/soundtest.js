(async function(){
  // the sound toggle is gone, so a stored vwSound of '0' from back then must not leave the sound off for good
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try { localStorage.setItem('vwSound','0'); } catch(e) {}
  let made=0; const AC=window.AudioContext; window.AudioContext=function(){ made++; return new AC(); };
  try {
  await sl(1500);
  window.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:5,clientY:5})); await sl(100);
  T("a stored vwSound of '0' is ignored: the sound comes on with the first touch", made>0, made+' contexts');
  } catch(err) { out.push('FAIL threw :: '+err.message); }
  try { localStorage.removeItem('vwSound'); } catch(e) {}
  console.log('RESULTS\n'+out.join('\n'));
})();
