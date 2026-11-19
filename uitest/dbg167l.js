const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  await p.evaluate(()=>window.scrollTo(0,0));
  const box = await p.evaluate(()=>{ const r=document.querySelectorAll('#serverKv')[0].getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; });
  await p.screenshot({path:'D:/deepseek/gouzuoqu/U/.tmp-test/r167-zoom.png', clip:{x:Math.max(0,box.x-10), y:Math.max(0,box.y-10), width:Math.min(1000,box.w+20), height:box.h+20}, scale:'css'});
  console.log(JSON.stringify(box));
  await b.close();
})();
