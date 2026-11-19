const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const k = document.querySelector('#serverKv .row .k');
    k.textContent = '监听端口XXXXXXXXXXXXXXXXXXXXXXXX';
    const wide = {kW: Math.round(k.getBoundingClientRect().width)};
    k.textContent = '监';
    const narrow = {kW: Math.round(k.getBoundingClientRect().width)};
    k.textContent = '监听端口';
    return {wide, narrow};
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
