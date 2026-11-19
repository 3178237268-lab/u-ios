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
    const read = () => ({kW:Math.round(k.getBoundingClientRect().width), kR:Math.round(k.getBoundingClientRect().right), vL:Math.round(v.getBoundingClientRect().left), afterPos:getComputedStyle(k,'::after').position});
    const base = read();
    const st = document.createElement('style'); st.id='t1';
    st.textContent = '.kv .row .k{display:flex!important;align-items:baseline!important;flex:1 1 auto!important;min-width:0!important;white-space:nowrap!important;color:var(--dim)!important}';
    document.head.appendChild(st);
    const grown = read(); st.remove();
    // 检查 v 是不是有 max-width
    const vs = getComputedStyle(v);
    return {base, grown, vStyle:{flex:vs.flex, maxW:vs.maxWidth, display:vs.display, textAlign:vs.textAlign}};
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
