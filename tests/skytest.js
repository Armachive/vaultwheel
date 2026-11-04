(async function(){
  // the tube's moving picture: chosen by the theme, nothing running in a theme without one, a live update of Obsidian's
  // tokens does not bring the tube band back, held still for a reduced motion setting. the tests do not draw the scene, so
  // the picture is started by hand
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  await sl(1500); VW.startSky();
  const look=px=>{ let aMax=0,sum=0; for(let i=3;i<px.length;i+=4){ if(px[i]>aMax)aMax=px[i]; sum+=px[i]; } return {aMax,mean:sum/(px.length/4)}; };
  const diff=(a,b)=>{ let d=0; for(let i=0;i<a.length;i++)d+=Math.abs(a[i]-b[i]); return d/a.length; };
  for(const [th,name,maxA,moves] of [['light','clouds',256],['retroma','water',129],['willemstad','smoke',84],
    ...[['vauxhall','nebula',70,0.005],['shimmering','shimmer',60,0.005],['tyrone','neon',115,0.002],['amiga','workbench',90,0.005],['encore','glass',90,0.002]].filter(x=>VWCards.WHEEL_THEMES[x[0]])]){
    VW.setTheme(th); const s=VW.sky();
    T(th+': its own picture, and running', s.name===name && s.running, JSON.stringify(s));
    const a=s.read(), l=look(a); await sl(1200); const s2=VW.sky(), b=s2.read(), d=diff(a,b);
    T(th+': the picture is not empty and stays under its opacity', l.mean>1 && l.aMax<maxA, JSON.stringify(l));
    if(still) T(th+': held still for reduced motion', d===0 && s2.draws===s.draws, d+' '+s.draws+' '+s2.draws);
    else T(th+': the picture moves, about twenty times a second', d>(moves||0.02) && s2.draws>s.draws, d+' '+s.draws+' '+s2.draws);
  }
  // no picture in dark mode, no loop, and the texture is given back
  VW.setTheme('dark'); const s0=VW.sky(); await sl(600); const s1=VW.sky();
  T('dark: nothing running, nothing drawn', !s0.running && !s1.running && !s1.name && !s1.tex && s1.draws===s0.draws, JSON.stringify(s1));
  VW.setTheme('light'); const s3=VW.sky();
  T('back to light: its picture again at once', s3.running && s3.name==='clouds' && s3.tex, JSON.stringify(s3));
  VW.setTheme('dark'); VW.setTheme('retroma'); VW.setTheme('dark'); VW.setTheme('willemstad');
  T('a quick run through the themes ends on the right one, running', VW.sky().running && VW.sky().name==='smoke', JSON.stringify(VW.sky()));
  // the palettes: one tube color, no band
  const r0=VW.pal('retroma'), w0=VW.pal('willemstad');
  T('retroma: one tube color', r0.a===r0.b && r0.a===r0.base && r0.sky==='water', JSON.stringify(r0));
  T('willemstad: its tube color and no second one', w0.a===w0.b && w0.a===w0.base && w0.sky==='smoke', JSON.stringify(w0));
  // Obsidian sends new tokens with a loud tube and second tube color
  const th=JSON.parse(JSON.stringify(VWCards.OBSIDIAN_THEMES));
  for(const k of Object.keys(th)){ th[k].tube='#ff0000'; th[k].tube2='#ffff00'; th[k].paper='#123456'; }
  VW.setTheme('retroma'); window.postMessage({vw:1,t:'themeTokens',themes:th},'*'); await sl(300);
  const r1=VW.pal('retroma'), w1=VW.pal('willemstad');
  T('a live update leaves retroma\'s tube alone', r1.base===r0.base && r1.a===r0.a && r1.b===r0.b && r1.uBase===r0.base && r1.uA===r0.a && r1.uB===r0.a && r1.sky==='water', JSON.stringify(r1));
  T('a live update still reaches retroma\'s page', getComputedStyle(document.documentElement).getPropertyValue('--card').trim()==='#123456', getComputedStyle(document.documentElement).getPropertyValue('--card'));
  T('and the picture keeps running', VW.sky().running && VW.sky().name==='water', JSON.stringify(VW.sky()));
  VW.setTheme('willemstad'); const w2=VW.pal('willemstad');
  T('a live update sets willemstad\'s base, with no band', w1.base==='ff0000' && w1.a==='ff0000' && w1.b==='ff0000' && w2.uBase==='ff0000' && w1.sky==='smoke', JSON.stringify(w2));
  // the wheel's own themes: on the button after the four, saved like them, and nothing sent from Obsidian reaches them
  const own=Object.keys(VWCards.WHEEL_THEMES), btn=document.querySelector('#bTheme');
  VW.setTheme('willemstad'); const seen=[];
  for(let i=0;i<own.length+1;i++){ btn.click(); await sl(600); seen.push(btn.title.match(/theme: (\S+)/)[1]); }
  T('the button goes on from willemstad through them and back to light', seen.join()===own.concat('light').join(), seen.join());
  if(own.length){
    VW.setTheme(own[0]); const before=JSON.stringify(VW.pal()), card=getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
    btn.click(); await sl(600); T('a press is saved', localStorage.getItem('vw.theme')===(own[1]||'light'), localStorage.getItem('vw.theme'));
    VW.setTheme(own[0]); const loud={}; for(const k of own) loud[k]=Object.assign({},VWCards.WHEEL_THEMES[k],{tube:'#ff0000',paper:'#123456'});
    window.postMessage({vw:1,t:'themeTokens',themes:loud},'*'); await sl(300);
    T('tokens sent from outside leave them alone', JSON.stringify(VW.pal())===before && getComputedStyle(document.documentElement).getPropertyValue('--card').trim()===card, JSON.stringify(VW.pal()));
    for(const k of own){ VW.setTheme(k); const r=VWCards.WHEEL_THEMES[k], cs=getComputedStyle(document.documentElement);
      T(k+': its cards and ink on the page, under the right mode', cs.getPropertyValue('--card').trim()===r.paper && cs.getPropertyValue('--ink').trim()===r.text && cs.getPropertyValue('color-scheme').trim()===r.mode && document.documentElement.getAttribute('data-theme')===(r.mode==='dark'?'dark':'retroma'), cs.getPropertyValue('--card')); }
    VW.setTheme('dark'); T('off them nothing is left on the page', !document.documentElement.style.getPropertyValue('--card'), document.documentElement.style.cssText);
    try { localStorage.removeItem('vw.theme'); } catch(e){ }   // (the presses saved a choice, the next suite starts clean)
  }
  } catch(e){ out.push('FAIL threw :: '+e.message); }
  console.log('RESULTS\n'+out.join('\n'));
})();
