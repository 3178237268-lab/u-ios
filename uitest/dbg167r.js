const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const rows = [...document.querySelectorAll('#serverKv .row')];
    return rows.map(rw=>{
      const k=rw.firstElementChild, v=rw.lastElementChild;
      const kr=k.getBoundingClientRect(), vr=v.getBoundingClientRect(), rr=rw.getBoundingClientRect();
      return {t:k.textContent.slice(0,6), kW:Math.round(kr.width), vW:Math.round(vr.width), sum:Math.round(kr.width+vr.width), rowW:Math.round(rr.width)};
    });
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
