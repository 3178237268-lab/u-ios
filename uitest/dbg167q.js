const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const k = document.querySelector('#serverKv .row .k');
    const st = document.createElement('style');
    st.textContent = '#serverKv .row .k::after{flex:0 0 8px!important;}' ;
    document.head.appendChild(st);
    const a1 = {kW: Math.round(k.getBoundingClientRect().width)};
    st.textContent = '#serverKv .row .k::after{flex:0 0 8px!important} #serverKv .row .k{width:60px!important;flex:0 0 60px!important}';
    const a2 = {kW: Math.round(k.getBoundingClientRect().width)};
    st.remove();
    // 探针：给 after 一个可见背景看看它是不是真的存在
    const st2 = document.createElement('style');
    st2.id='dbgAfter';
    st2.textContent = '#serverKv .row .k::after{background:red!important;height:2px!important;}';
    document.head.appendChild(st2);
    const bg = getComputedStyle(k,'::after').backgroundColor;
    st2.remove();
    return {a1,a2,bg};
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
