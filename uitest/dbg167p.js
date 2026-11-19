const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const out = [];
    for (const sel of ['#serverKv .row .k', '#addrKv .row .k', '#liveKv .row .k', '#dirKv .row .k', '.address-grid .addr-k', '.aiu-item > span:first-child', '#tunnelKv .row .k', '#portListKv .row .k', '#backupKv .row .k', '#visitorKv .row .k']) {
      const el = document.querySelector(sel); if(!el) { out.push([sel,'no-el']); continue; }
      const cs = getComputedStyle(el), a = getComputedStyle(el,'::after');
      out.push({sel, display:cs.display, flex:cs.flex, rowDisp:getComputedStyle(el.parentElement).display,
        afterW:a.width, afterMargin:a.marginLeft+'/'+a.marginRight, afterBorder:a.borderBottomWidth+' '+a.borderBottomStyle, afterFlex:a.flex});
    }
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
