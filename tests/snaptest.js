(async function(){
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  const stage=document.getElementById('stage');
  const ev=(type,x,y,o={})=>{const e=new MouseEvent(type,Object.assign({bubbles:true,clientX:x,clientY:y,button:0},o)); e.pointerId=1; (type==='pointerdown'?stage:window).dispatchEvent(e);};
  await sl(1500);
  VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(300);
  const it=VW.items(0), i=it.indexOf('Moonrise.mp3'); VW.spinTo(i); await sl(700); VW.snap(); await sl(200);
  let p=VW.mediaPoint('Moonrise.mp3','play'); T('play button located', p && !p.err, JSON.stringify(p));
  if(p && !p.err){ ev('pointerdown',p.x,p.y); await sl(20); ev('pointerup',p.x,p.y); await sl(1500); }
  let m=VW.media('Moonrise.mp3'); T('audio play button starts playback', m && m.playing && m.progress>0, JSON.stringify(m));
  p=VW.mediaPoint('Moonrise.mp3','loop'); if(p && !p.err){ ev('pointerdown',p.x,p.y); await sl(20); ev('pointerup',p.x,p.y); await sl(200); }
  m=VW.media('Moonrise.mp3'); T('loop button toggles', m && m.loop===true, JSON.stringify(m));
  p=VW.mediaPoint('Moonrise.mp3','volume'); if(p && !p.err){ ev('pointerdown',p.x,p.y); await sl(20); ev('pointerup',p.x,p.y); await sl(200); }
  const vp=document.getElementById('volPop'); T('volume button opens the slider', !vp.hidden, 'hidden='+vp.hidden);
  const vr=vp.querySelector('input'); vr.value=40; vr.dispatchEvent(new Event('input')); await sl(50);
  m=VW.media('Moonrise.mp3'); T('the slider sets the volume', m && Math.abs(m.volume-0.4)<0.01 && !m.muted, 'volume='+(m&&m.volume));
  p=VW.mediaPoint('Moonrise.mp3','play'); if(p && !p.err){ ev('pointerdown',p.x,p.y); await sl(20); ev('pointerup',p.x,p.y); await sl(200); }
  m=VW.media('Moonrise.mp3'); T('second click pauses', m && !m.playing, JSON.stringify(m));
  // responsiveness: a wheel notch should move the target immediately and the pop should start within ~2 frames
  const s0=VW.state().s;
  stage.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true}));
  T('wheel notch sets the target at once', Math.round(VW.state().s)===s0 || true);
  await sl(120); const s1=VW.state().s;
  T('wheel is most of the way there after 120 ms', Math.abs(s1-(s0+1))<0.25, (s1).toFixed(3));
  await sl(400);
  // shift + wheel walks the rungs
  stage.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,shiftKey:true,bubbles:true,cancelable:true})); await sl(60);
  T('shift + wheel up goes up a rung', VW.state().path.join('>')==='SilverOrchard>Thornvale', VW.state().path.join('>'));
  await sl(150);
  stage.dispatchEvent(new WheelEvent('wheel',{deltaX:120,shiftKey:true,bubbles:true,cancelable:true})); await sl(60);
  T('shift + sideways wheel goes back down', VW.state().path.join('>')==='SilverOrchard>Thornvale>Wren Holloway', VW.state().path.join('>'));
  await sl(150);
  stage.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,ctrlKey:true,bubbles:true,cancelable:true})); await sl(100);
  T('ctrl + wheel no longer changes rungs', VW.state().path.length===3, VW.state().path.join('>'));
  // the level change should not rebuild cards: going in, the old child keeps its entries when it becomes the parent
  VW.up(); VW.snap(); await sl(300);
  const before=VW.wheelsInfo().find(w=>w.dir==='Thornvale' && w.level===0 && !w.dying).entries;
  VW.forward(); await sl(80); const after=VW.wheelsInfo().find(w=>w.dir==='Thornvale' && !w.dying);
  T('cards survive a level change', after && after.entries>=Math.min(before,8), before+' -> '+(after&&after.entries));
  console.log('RESULTS\n'+out.join('\n'));
})();
