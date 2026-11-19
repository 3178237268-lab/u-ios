const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const rw = document.querySelector('#serverKv .row');
    const k = rw.firstElementChild;
    const st = document.createElement('style'); st.id='vv';
    st.textContent = '.kv .row .k::after{display:none!important}'; document.head.appendChild(st);
    const base = Math.round(k.getBoundingClientRect().width);
    st.textContent = '.kv .row .k::after{display:none!important} .kv .row .k{padding-right:40px!important}';
    const pad = Math.round(k.getBoundingClientRect().width);
    st.remove();
    // 看看 k 自身的内容盒宽度（减去 padding）
    const cs = getComputedStyle(k);
    return {base, pad, padR:cs.paddingRight, textW: k.scrollWidth};
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
