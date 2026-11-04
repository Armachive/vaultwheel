(async function(){
  // the editors save for real: the bytes they hand the plugin are decoded here and checked. a song opens straight into
  // AudioMass (its menus up, no flavour text in the head); its Export / Download goes over the original when the format
  // is the original's (a wav back as a wav, an mp3 back as an mp3), beside it otherwise; a png saved over itself is a png
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const $=s=>document.querySelector(s);
  const pe=(el,t,x,y,o={})=>el.dispatchEvent(new PointerEvent(t,Object.assign({bubbles:true,clientX:x,clientY:y,button:0,pointerId:61,pointerType:'mouse'},o)));
  const mid=el=>{const r=el.getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2];};
  const until=async(f,n=100,ms=300)=>{ for(let i=0;i<n&&!f();i++) await sl(ms); return f(); };
  const ready=()=>{ try { return !!(window.VW && VW.state && VW.state().path.length && VW.items(0).length); } catch(e) { return false; } };
  for (let i = 0; i < 100 && !ready(); i++) await sl(300);
  await sl(500); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(600);
  // a 1.5 s mono tone at 8 kHz as a wav (short, so its mp3 encoding fits the test clock)
  const SR=8000, SECS=1.5, N=SR*SECS, tone=new Float32Array(N); for(let i=0;i<N;i++) tone[i]=0.5*Math.sin(2*Math.PI*440*i/SR);
  const wavOf=(pcm,sr)=>{ const n=pcm.length, out=new DataView(new ArrayBuffer(44+n*2)); const str=(o,s)=>{for(let i=0;i<s.length;i++)out.setUint8(o+i,s.charCodeAt(i));}; str(0,'RIFF'); out.setUint32(4,36+n*2,true); str(8,'WAVE'); str(12,'fmt '); out.setUint32(16,16,true); out.setUint16(20,1,true); out.setUint16(22,1,true); out.setUint32(24,sr,true); out.setUint32(28,sr*2,true); out.setUint16(32,2,true); out.setUint16(34,16,true); str(36,'data'); out.setUint32(40,n*2,true); for(let i=0;i<n;i++) out.setInt16(44+i*2,Math.max(-1,Math.min(1,pcm[i]))*32767,true); return out.buffer; };
  T('AudioMass and its workers are in the build', ['audiomass','audiomassCss','lameWorker','wavWorker','clip','mp4muxer','gifenc','cropper'].every(k=>typeof (window.__VENDOR||{})[k]==='string'), Object.keys(window.__VENDOR||{}).join(','));
  const ac=new (window.AudioContext||window.webkitAudioContext)();
  const decode=async buf=>{ const ab=await ac.decodeAudioData(buf.slice(0)); return { dur: ab.duration, ch: ab.getChannelData(0), sr: ab.sampleRate }; };
  const rms=(ch,sr,t0,t1)=>{ const a=Math.floor(t0*sr), b=Math.min(ch.length,Math.floor(t1*sr)); let s=0; for(let i=a;i<b;i++) s+=ch[i]*ch[i]; return Math.sqrt(s/Math.max(1,b-a)); };
  const files={ 'tone.wav': wavOf(tone,SR) };
  window.__VW_TEST_READ__=ref=>Promise.resolve(files[ref.name]||null);
  let written=null; window.__VW_TEST_WRITE__=(ref,buf,beside)=>{ written={name:beside||ref.name,buf,beside:!!beside}; return true; };
  window.confirm=()=>true;
  // the made-up files go on the board
  for(const n of ['tone.wav','tone.mp3']){ VWpg.testFile(n); await sl(300); VW.snap(); VW.spinTo(VW.items(0).indexOf(n)); await sl(400); VW.snap(); VW.shiftSelect(0,n); await sl(800); if(!VW.state().sel.includes(n)){ VW.selectFocused(); await sl(900); VW.snap(); await sl(200); } }
  VW.openStackView(); await sl(600);
  const sv=$('#sv'), box=n=>[...document.querySelectorAll('#sv .item')].find(b=>b.title===n);
  const dbl=async b=>{ const [x,y]=mid(b); pe(b,'pointerdown',x,y); pe(sv,'pointerup',x,y); await sl(60); pe(b,'pointerdown',x,y); pe(sv,'pointerup',x,y); await sl(500); };
  const ed=$('#sv .pged'), save=$('#sv .pged .head [data-e=save]'), why=$('#sv .pged .head .why'), note=$('#sv .pged .head .note');
  const am=()=>{ const f=$('#sv .pged iframe.am'); const w=f&&f.contentWindow; return w&&w.PKAudioEditor&&w.PKAudioEditor.engine ? w.PKAudioEditor : null; };
  const open=async n=>{ written=null; await dbl(box(n)); await until(()=>am() && am().engine.is_ready, 100, 300); await sl(800); };
  // the wav: double tap opens AudioMass itself, loaded with the song
  await open('tone.wav');
  T('a double tap on a song opens the sound editor at once', !ed.hidden && !!$('#sv .pged iframe.am') && !box('tone.wav').classList.contains('big'));
  T('AudioMass is up with the song loaded', !!am() && am().engine.is_ready, String(!!am())+' fail: '+(($('#sv .pged .fail')||{}).textContent||'')+' busy: '+($('#sv .pged .busy').hidden?'':'yes')+' frame doc: '+((($('#sv .pged iframe.am')||{}).contentDocument||{body:{innerHTML:'none'}}).body.innerHTML.slice(0,80)));
  const doc=$('#sv .pged iframe.am').contentDocument, menuText=doc.body.textContent;
  T('its menus are there', /File/.test(menuText) && /Edit/.test(menuText) && /Effects/.test(menuText) && /View/.test(menuText), menuText.slice(0,120).replace(/\s+/g,' '));
  T('no flavour text in the head', !note.textContent && !why.textContent, JSON.stringify([note.textContent,why.textContent]));
  T('Save is there, grey until an edit', !save.hidden && save.disabled);
  T('the hint and the old buttons are gone', !$('#sv .pged .hint') && !$('#sv .pged .tools .pill'), '');
  // its export, as a wav, goes over the wav
  am().engine.DownloadFile('tone.wav','wav',0,false,false,16,false);
  await until(()=>written,60,300);
  T('an export as wav is written over the wav', !!written && written.name==='tone.wav' && !written.beside && written.buf.byteLength>44, written&&JSON.stringify([written.name,written.beside,written.buf.byteLength]));
  T('the editor closes after the save', ed.hidden);
  if (written) { const d=await decode(written.buf); T('the saved wav is the tone, whole', Math.abs(d.dur-SECS)<0.02 && rms(d.ch,d.sr,0.5,1)>0.3, d.dur+" rms "+rms(d.ch,d.sr,0.5,1).toFixed(3)); }
  // an export in another format goes beside: the wav exported as an mp3 (through its lame worker)
  await open('tone.wav');
  am().engine.DownloadFile('tone.mp3','mp3',128,false,false,16,false);
  await until(()=>written,1500,300);
  T('an export as mp3 goes beside the wav', !!written && written.beside && written.name==='tone.mp3' && written.buf.byteLength>100, written&&JSON.stringify([written.name,written.beside,written.buf.byteLength]));
  if (written && written.beside) {
    const u=new Uint8Array(written.buf), head=[...u.slice(0,3)];
    T('it is an mp3', (u[0]===0xff && (u[1]&0xe0)===0xe0) || (u[0]===0x49 && u[1]===0x44 && u[2]===0x33), head.join(' '));
    const d=await decode(written.buf); T('that decodes to about its length', Math.abs(d.dur-SECS)<0.3, String(d.dur));
    files['tone.mp3']=written.buf;
  }
  // the mp3 opened and exported as mp3 goes over the mp3
  if (files['tone.mp3']) {
    await open('tone.mp3');
    T('an mp3 opens in the sound editor too', !!am() && am().engine.is_ready);
    am().engine.DownloadFile('tone.mp3','mp3',128,false,false,16,false);
    await until(()=>written,1500,300);
    T('an export as mp3 is written over the mp3', !!written && !written.beside && written.name==='tone.mp3' && written.buf.byteLength>100, written&&JSON.stringify([written.name,written.beside,written.buf.byteLength]));
  }
  // the video: a double tap opens Clip; a colour card and Save give an export, written over an mp4 or beside a webm
  // (not a playable mp4, but it carries a sound track's mark, so a silent export must not go over it)
  files["card.mp4"]=(()=>{ const u=new Uint8Array(300000); const s="....hdlr....soun"; for(let i=0;i<s.length;i++) u[100+i]=s.charCodeAt(i); return u.buffer; })();
  VWpg.testFile("card.mp4"); await sl(300); VW.snap(); VW.spinTo(VW.items(0).indexOf("card.mp4")); await sl(400); VW.snap(); VW.shiftSelect(0,"card.mp4"); await sl(800); if(!VW.state().sel.includes("card.mp4")){ VW.selectFocused(); await sl(900); VW.snap(); await sl(200); }
  VW.openStackView(); await sl(600);
  const cw=()=>{ const f=$("#sv .pged iframe.am"); const w=f&&f.contentWindow; return w&&typeof w.addFile==="function"&&typeof w.exportVideo==="function" ? w : null; };
  // (a tap on a video card's controls plays it, as on the wheel: the double tap lands near the card's corner)
  const dblCorner=async b=>{ const r=b.getBoundingClientRect(), x=r.left+14, y=r.top+14; pe(b,"pointerdown",x,y); pe(sv,"pointerup",x,y); await sl(60); pe(b,"pointerdown",x,y); pe(sv,"pointerup",x,y); await sl(500); };
  written=null; await dblCorner(box("card.mp4")); await until(()=>cw(),60,300); await sl(800);
  T("a double tap on a video opens the video editor at once", !ed.hidden && !!cw() && !box("card.mp4").classList.contains("big"), String(!!cw())+" hidden "+ed.hidden+" frame "+!!$("#sv .pged iframe.am")+" addFile "+($("#sv .pged iframe.am")?typeof $("#sv .pged iframe.am").contentWindow.addFile:"-")+" State "+($("#sv .pged iframe.am")?typeof $("#sv .pged iframe.am").contentWindow.State:"-")+" busy "+($("#sv .pged .busy").hidden?"":$("#sv .pged .busy").textContent)+" fail: "+(($("#sv .pged .fail")||{}).textContent||"")+" nm "+$("#sv .pged .nm").textContent);
  if (cw()) {
    const cd=cw().document, ids=["addBtn","saveBtn","openBtn","helpBtn"].filter(i=>cd.getElementById(i));
    T("its page-only buttons are gone and Export reads Save", !ids.length && (cd.getElementById("exportBtn")||{}).textContent==="Save", ids.join(",")+" "+(cd.getElementById("exportBtn")||{}).textContent);
    T("the editor head has no notes", !note.textContent && !why.textContent && !save.hidden, JSON.stringify([note.textContent,why.textContent]));
    cd.getElementById("addColorBtn").click(); await sl(500);
    T("a colour card goes on its timeline and Save comes alive", !cw().document.getElementById("undoBtn").disabled && !save.disabled, "undo disabled "+cw().document.getElementById("undoBtn").disabled+" save disabled "+save.disabled);
    // (its export walks the timeline frame by frame, far too slow under the test clock: it is seen to start, then cancelled;
    // the file it would hand over goes through the same catch as the sound editor's, tried here with its own download())
    save.click(); await until(()=>/Exporting/.test(cw().document.body.textContent),60,300);
    T("Save starts its export", /Exporting/.test(cw().document.body.textContent), cw().document.body.textContent.replace(/\s+/g," ").slice(-120));
    const cancel=cw().document.getElementById("modalCancel"); if (cancel) cancel.click(); await sl(600);
    cw().download(new Blob([new Uint8Array(200)],{type:"video/mp4"}),"export.mp4"); await until(()=>written,60,300);
    T("a silent, tiny export is kept beside the original, not over it", !!written && written.name==="card (edit).mp4" && written.beside && written.buf.byteLength===200, written&&JSON.stringify([written.name,written.beside,written.buf.byteLength]));
    T("the editor closes after the save", ed.hidden);
  }
  // the picture: saved over itself as a png
  const pic=VW.items(0).find(n=>/\.png$/i.test(n));
  if (pic) {
    window.__VW_TEST_READ__=null;
    VW.spinTo(VW.items(0).indexOf(pic)); await sl(400); VW.snap(); VW.shiftSelect(0,pic); await sl(800); VW.openStackView(); await sl(600);
    written=null; await dbl(box(pic)); box(pic).querySelector('.xbar [data-x=edit]').click(); await until(()=>$('#sv .pged .cropper-container'),40,300); await sl(400);
    T('Save on an untouched picture is grey', save.disabled && !save.hidden);
    $('#sv .pged .tools [data-t=rr]').click(); await sl(200);
    T('a turn brings Save alive', !save.disabled);
    save.click(); await until(()=>written,60,300);
    const u=written && new Uint8Array(written.buf);
    T('the picture is handed over as a png, to its own name', !!u && u[0]===0x89 && u[1]===0x50 && u[2]===0x4e && u[3]===0x47 && written.name===pic && !written.beside, written&&written.name);
  } else T('a png to try (none in this folder)', false);
  window.__VW_TEST_WRITE__=null;
  $('#sv .pgx').click(); await sl(300);
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
