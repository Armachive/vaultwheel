(function(){
  // the site's pictures: they come down whole and are cut down in the browser, 360 px on the long side for a card (1280
  // for a big one); a gif goes on as itself. this runs on a live build with the server faked, so it needs no server
  const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  const now=Math.floor(Date.now()/1000), files=[['wide.jpg',900000,now],['clear.png',800000,now-5],['moves.gif',300000,now-9]];
  const big=(type)=>new Promise(r=>{const c=document.createElement('canvas'); c.width=2000; c.height=1000; const g=c.getContext('2d'); g.fillStyle='#7575b8'; g.fillRect(0,0,2000,1000); c.toBlob(r,type,0.9);});
  const gif=Uint8Array.from(atob('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='),c=>c.charCodeAt(0));
  const shrunk=[]; const tb=HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob=function(cb,type,q){ if(this.width<=1280 && this.height<=1280 && (this.width>=300 || this.height>=300)) shrunk.push([this.width,this.height,type]); return tb.call(this,cb,type,q); };
  const asked=[];
  window.fetch=async(u)=>{
    const url=new URL(u,location.href), p=url.searchParams.get('p'); asked.push(url.pathname.replace(/^.*\/api/,'/api')+(p?'?'+p:''));
    const json=o=>new Response(JSON.stringify(o),{headers:{'Content-Type':'application/json'}});
    if(/\/api\/tree$/.test(url.pathname)) return json({root:'Vault',tree:{n:'Vault',f:0,m:now,t:{},c:[{n:'Pics',f:3,m:now,t:{jpg:1,png:1,gif:1},c:[]}]}});
    if(/\/api\/files$/.test(url.pathname)) return json({files: p==='Pics'?files:[]});
    if(/\/api\/file$/.test(url.pathname)){ if(/gif$/.test(p)) return new Response(new Blob([gif],{type:'image/gif'})); return new Response(await big(/png$/.test(p)?'image/png':'image/jpeg')); }
    if(/\/api\/art$/.test(url.pathname)) return new Response('',{status:404});
    return new Response('{}',{headers:{'Content-Type':'application/json'}});
  };
  const sl=ms=>new Promise(r=>setTimeout(r,ms));
  (async()=>{ try {
    await sl(2500); VW.enter('Pics'); VW.snap();
    // the cutting down is real work the test clock does not wait for, so wait for it rather than for a set time
    for (let i = 0; i < 100 && shrunk.filter(s => s[0] === 360).length < 2; i++) await sl(300);
    T('the folder lists', VW.items(0).length===3, JSON.stringify(VW.items(0)));
    T('the jpeg is cut down to 360 px', shrunk.some(s=>s[0]===360 && s[1]===180 && s[2]==='image/jpeg'), JSON.stringify(shrunk));
    T('the png is cut down and stays a png', shrunk.some(s=>s[0]===360 && s[1]===180 && s[2]==='image/png'), JSON.stringify(shrunk));
    T('the gif goes on as itself, never cut down', !asked.some(a=>/moves\.gif/.test(a)) && shrunk.every(s=>s[1]!==s[0]), JSON.stringify(asked));
    T('each picture comes down once, for both sizes', asked.filter(a=>a==='/api/file?Pics/wide.jpg').length===1, JSON.stringify(asked.filter(a=>/wide/.test(a))));
  } catch(err){ out.push('FAIL threw :: '+err.message); }
  console.log('RESULTS\n'+out.join('\n')); })();
})();
