const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const rw = document.querySelector('#serverKv .row');
    const k = rw.firstElementChild, v = rw.lastElementChild;
    const kb = k.getBoundingClientRect(), vb = v.getBoundingClientRect();
    // 强制改 ::after 之后再看
    const st = document.createElement('style');
    st.textContent = '.kv .row .k{flex:0 0 auto!important} .kv .row:not(:has(.k)) .row{} ';
    return {
      kRect:[kb.left,kb.right,kb.width,kb.height], vRect:[vb.left,vb.right,vb.width],
      kStyle:{flex:getComputedStyle(k).flex, display:getComputedStyle(k).display, minW:getComputedStyle(k).minWidth, white:getComputedStyle(k).whiteSpace},
      afterContent:getComputedStyle(k,'::after').content,
      afterW: 8,
      kInner: k.innerHTML,
      kChildren: k.children.length,
      vInner: v.innerHTML.slice(0,40),
      rowFlex: getComputedStyle(rw).display + ' ' + getComputedStyle(rw).gap,
      kScrollW: k.scrollWidth, kClientW: k.clientWidth,
      probe: (()=>{ const s=document.createElement('span'); s.className='k probe'; s.textContent='ABC'; k.parentNode.appendChild(s); const w=s.getBoundingClientRect().width; s.remove(); return w; })()
    };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
