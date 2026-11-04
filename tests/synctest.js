(async function(){
  // changes made outside the page (Obsidian, Syncthing) arrive as vault changes and show without a reload; a change the
  // page made itself that comes back the same way is found already done and changes nothing twice
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const S=()=>VW.state(), has=n=>VW.items(0).includes(n);
  await sl(1500); VW.enter('Thornvale'); VW.enter('Wren Holloway'); VW.snap(); await sl(400);
  const base='Thornvale/Wren Holloway/', n0=S().n, now=Math.floor(Date.now()/1000);
  VW.vaultChange({ vw:1, t:'vaultChange', kind:'create', p: base+'From Obsidian.md', isDir:false, size:120, m:now }); await sl(800);
  T('a note made outside shows up', has('From Obsidian.md') && S().n===n0+1, JSON.stringify(VW.items(0).slice(0,3)));
  VW.vaultChange({ vw:1, t:'vaultChange', kind:'create', p: base+'Synced folder', isDir:true, m:now }); await sl(800);
  T('a folder made outside shows up', has('Synced folder'), '');
  VW.vaultChange({ vw:1, t:'vaultChange', kind:'rename', p: base+'Renamed outside.md', old: base+'From Obsidian.md', isDir:false, size:120, m:now }); await sl(800);
  T('a rename outside shows', has('Renamed outside.md') && !has('From Obsidian.md'), '');
  VW.vaultChange({ vw:1, t:'vaultChange', kind:'rename', p: 'Thornvale/Renamed outside.md', old: base+'Renamed outside.md', isDir:false, size:120, m:now }); await sl(800);
  T('a move outside takes it out of this folder', !has('Renamed outside.md') && VW.items(1).includes('Renamed outside.md'), JSON.stringify(VW.items(1).slice(0,4)));
  VW.vaultChange({ vw:1, t:'vaultChange', kind:'delete', p: 'Thornvale/Renamed outside.md', isDir:false }); await sl(800);
  T('a delete outside takes it away', !VW.items(1).includes('Renamed outside.md'), '');
  // the same change twice (the page's own, then the echo from the vault) changes nothing the second time
  const before=VW.items(0).join('|');
  VW.vaultChange({ vw:1, t:'vaultChange', kind:'delete', p: base+'No such file.md', isDir:false });
  VW.vaultChange({ vw:1, t:'vaultChange', kind:'create', p: base+'Synced folder', isDir:true, m:now });
  VW.vaultChange({ vw:1, t:'vaultChange', kind:'rename', p: base+'Gone.md', old: base+'Never there.md', isDir:false, size:1, m:now }); await sl(800);
  T('changes already made, or about things that are not there, change nothing', VW.items(0).join('|')===before, '');
  // a carried file deleted outside leaves the stack
  const f=VW.items(0).find(n=>/\.md$/.test(n)); VW.spinTo(VW.items(0).indexOf(f)); await sl(400); VW.snap(); VW.selectFocused(); await sl(600);
  VW.vaultChange({ vw:1, t:'vaultChange', kind:'delete', p: base+f, isDir:false }); await sl(800);
  T('a carried file deleted outside leaves the stack', !S().sel.includes(f) && !has(f), JSON.stringify(S().sel));
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
