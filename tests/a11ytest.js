(async function(){
  // keyboard and screen reader basics: the card in focus is spoken, the path folders open from the keyboard, the sort
  // list takes the focus and gives it back, the search opens and clears, the playground's tools and ticks work from the keyboard
  const sl=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; const T=(n,ok,i)=>out.push((ok?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
  try {
  const $=s=>document.querySelector(s);
  const kd=(el,k,o={})=>el.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o)));
  await sl(1500); VW.enter('Thornvale'); VW.snap(); await sl(900);
  const st=VW.state();
  T('the card in focus is spoken', $('#srFocus').textContent.startsWith(st.focus+', ') && / of \d+$/.test($('#srFocus').textContent), JSON.stringify($('#srFocus').textContent));
  T('the toast is a polite status', $('#toast').getAttribute('role')==='status' && $('#toast').getAttribute('aria-live')==='polite');
  T('the scene is hidden from screen readers', $('#gl').getAttribute('aria-hidden')==='true');
  // a path folder opens on Enter
  const crumb=$('#path .crumb:not(.here)'); crumb.focus(); kd(crumb,'Enter'); await sl(600);
  T('Enter on a path folder goes there', VW.state().path.length===1, JSON.stringify(VW.state().path));
  // the sort list
  const bDir=$('#bDir'); bDir.focus(); bDir.click(); await sl(200);
  T('the sort list takes the focus on the sort in use', !$('#dirPop').hidden && document.activeElement===$('#dirPop [aria-checked=true]') && bDir.getAttribute('aria-expanded')==='true', document.activeElement && document.activeElement.textContent);
  kd(document.activeElement,'ArrowDown'); await sl(50);
  T('down walks the list', document.activeElement===$('#dirPop').children[1], document.activeElement && document.activeElement.textContent);
  kd(document.activeElement,'Escape'); await sl(150);
  T('Esc closes it and the focus goes back', $('#dirPop').hidden && document.activeElement===bDir && bDir.getAttribute('aria-expanded')==='false', document.activeElement && document.activeElement.id);
  // rename, from the keyboard: F2 puts the focus in the name typed over the card, Esc takes it away again
  kd(bDir,"F2"); await sl(200);
  T("F2 puts the focus in the card's name", !$("#cardRen").hidden && document.activeElement===$("#cardRen"), document.activeElement && document.activeElement.outerHTML.slice(0,60));
  kd(document.activeElement,"Escape"); await sl(150);
  T("Esc closes it", $("#cardRen").hidden && document.activeElement!==$("#cardRen"), document.activeElement && document.activeElement.id);
  // the search: the magnifier opens the find field with the focus (on a phone its keyboard comes up), typing hides the cards
  // whose names miss, and a moment later it all clears
  bDir.blur(); await sl(100);
  const all=VW.items(0), lo=all.map(n=>n.toLowerCase());
  const frag=lo.map(n=>n.slice(0,3)).find(f=>f.trim().length===3 && lo.some(n=>!n.includes(f)));
  $('#bFind').click(); await sl(300);
  T('the magnifier opens the find field with the focus', $('#find').classList.contains('on') && document.activeElement===$('#q'), document.activeElement && document.activeElement.id);
  const qi=$('#q'); qi.value=frag; qi.dispatchEvent(new Event('input',{bubbles:true})); await sl(300);
  T('typing hides the cards whose names do not hold it', VW.items(0).length>0 && VW.items(0).length<all.length && VW.items(0).every(n=>n.toLowerCase().includes(frag)), frag+' -> '+VW.items(0).join('|'));
  await sl(2000);
  T('a moment later it clears: the column is whole and the field is the magnifier again', VW.items(0).length===all.length && !$('#find').classList.contains('on') && document.activeElement!==qi && qi.value==='', VW.items(0).length+'/'+all.length+' '+$('#find').className);
  $('#bFind').click(); await sl(100); qi.value='zzqqxx'; qi.dispatchEvent(new Event('input',{bubbles:true})); await sl(300);
  T('a search nothing matches empties the column without trouble', VW.items(0).length===0, VW.items(0).join('|'));
  kd(qi,'Escape'); await sl(300);
  T('Esc in the field clears it, the column is whole again', VW.items(0).length===all.length && !$('#find').classList.contains('on') && document.activeElement!==qi, VW.items(0).length+'/'+all.length);
  kd(document.body,frag[0]); await sl(200);
  T('typing on the page shows in the same field, and leaves the keyboard on the page', $('#find').classList.contains('on') && qi.value===frag[0] && document.activeElement!==qi, qi.value);
  kd(document.body,'Escape'); await sl(200);
  T('Esc clears it', !$('#find').classList.contains('on') && qi.value==='' && VW.items(0).length===all.length, qi.value);
  // light to dark and back goes through a view transition, set to a slow cross fade. headless hands out frames too rarely
  // to watch the fade here, so this checks it is asked for, and that the look changes soon even with no frames coming
  const th0=document.documentElement.getAttribute('data-theme'), svt=document.startViewTransition; let vts=0;
  document.startViewTransition=function(f){ vts++; return svt.call(document,f); };
  $('#bTheme').click(); await sl(700);
  document.startViewTransition=svt;
  T('the theme button asks for the cross fade and the look changes', vts===1 && document.documentElement.getAttribute('data-theme')!==th0, vts+' '+document.documentElement.getAttribute('data-theme'));
  const vtRule=[...document.styleSheets].filter(s=>!s.href).flatMap(s=>[...s.cssRules]).find(r=>/::view-transition-new\(root\)/.test(r.selectorText||''));
  T('the cross fade is about 0.9 s', !!vtRule && vtRule.style.animationDuration==='0.9s', vtRule&&vtRule.style.animationDuration);
  VW.setTheme(th0);
  // the playground
  VW.enter('Thornvale'); VW.snap(); await sl(600);
  VW.selectFocused(); await sl(900);
  T('one card carried', VW.state().sel.length===1, JSON.stringify(VW.state().sel));
  VW.openStackView(); await sl(300);
  T('the playground is a dialog and starts in its tools', $('#sv').getAttribute('role')==='dialog' && document.activeElement===$('#sv .ops [data-op=fit]'), document.activeElement && document.activeElement.outerHTML.slice(0,60));
  T('the tool icons are hidden from screen readers', [...document.querySelectorAll('#sv .ops button span')].every(s=>s.getAttribute('aria-hidden')==='true'));
  const tk=$('#sv .item .tick');
  T('a tick is a checked checkbox', tk.getAttribute('role')==='checkbox' && tk.getAttribute('aria-checked')==='true' && tk.tabIndex===0, tk.outerHTML.slice(0,120));
  tk.focus(); kd(tk,' '); await sl(150);
  T('Space on a tick unticks it', tk.getAttribute('aria-checked')==='false' && tk.parentNode.classList.contains('off'), tk.getAttribute('aria-checked'));
  kd(tk,'Enter'); await sl(150);
  T('Enter ticks it again', tk.getAttribute('aria-checked')==='true' && !tk.parentNode.classList.contains('off') && VW.stackView().open, tk.getAttribute('aria-checked'));
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await sl(300);
  T('leaving takes the focus out of the playground', !VW.stackView().open && !$('#sv').contains(document.activeElement));
  } catch(err) { out.push('FAIL threw :: '+err.message+' '+(err.stack||'').split('\n')[1]); }
  console.log('RESULTS\n'+out.join('\n'));
})();
