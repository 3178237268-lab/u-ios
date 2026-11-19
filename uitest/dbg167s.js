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
    const st = document.createElement('style');
    st.textContent = '.kv .row span:first-child::after{display:none!important}';
    document.head.appendChild(st);
    const noPad = {kW:Math.round(k.getBoundingClientRect().width), vL:Math.round(v.getBoundingClientRect().left)};
    st.textContent = '.kv .row span:first-child::after{display:none!important} .kv .row .k{padding-right:60px!important;box-sizing:border-box!important}';
    const withPad = {kW:Math.round(k.getBoundingClientRect().width), vL:Math.round(v.getBoundingClientRect().left)};
    st.remove();
    return {noPad, withPad};
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
