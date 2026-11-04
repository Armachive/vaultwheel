(async function(){
  // a song or a video started from the wheel pauses when you leave the content column it was started in
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const press=async()=>{ window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await sl(30); window.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true})); await sl(300); };
  const n=()=>VW.playingCount();
  await sl(1500); VW.enter('Thornvale'); await sl(1300); VW.snap(); VW.enter('Wren Holloway'); await sl(1300); VW.snap(); await sl(100);
  const items=VW.items(0), song=items.findIndex(x=>/\.(mp3|wav|flac|m4a|ogg)$/i.test(x)), name=items[song];
  T('the folder has a song to try', song>=0, JSON.stringify(items.slice(0,6)));
  VW.spinTo(song); await sl(500); VW.snap(); await sl(100);
  T('the song is in focus', VW.state().focus===name, VW.state().focus);
  await press();
  T('it plays', n()===1, 'playing '+n());
  VW.spinTo(0); await sl(400);
  T('turning the same column leaves it playing', n()===1, 'playing '+n());
  VW.spinTo(song); await sl(400); VW.snap(); await sl(100);
  VW.up(); await sl(300);
  T('going up pauses it', n()===0, 'playing '+n());
  VW.forward(); await sl(1000); VW.snap(); await sl(100);
  T('coming back does not start it again', n()===0, 'playing '+n()+' in '+VW.state().path.join('>'));
  VW.spinTo(song); await sl(500); VW.snap(); await sl(100);
  await press();
  T('it plays again from a press', n()===1, 'playing '+n());
  VW.up(); await sl(800); VW.snap();
  T('leaving a second time pauses it again', n()===0, 'playing '+n());
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
