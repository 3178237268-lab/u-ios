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
    const h = v.innerHTML; v.innerHTML = '<i style="display:inline-block;width:40px"></i>' + h;
    const vr = v.getBoundingClientRect(), kr = k.getBoundingClientRect();
    v.innerHTML = h;
    // 把 v 强制内容宽度后看 k 是否变大
    const h2 = k.textContent; k.textContent = h2 + 'XXXXXXXXXXXXXX';
    const kr2 = k.getBoundingClientRect(), vr2 = v.getBoundingClientRect();
    k.textContent = h2;
    return { before:{kR:Math.round(kr.right), vL:Math.round(vr.left), vW:Math.round(vr.width)},
             after:{kR:Math.round(kr2.right), vL:Math.round(vr2.left), kW:Math.round(kr2.width), vW:Math.round(vr2.width)} };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
