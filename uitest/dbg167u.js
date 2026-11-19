const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const variants = {
    orig: '',
    afterMinWidth20: '.kv .row .k::after{min-width:20px!important}',
    afterMargin20: '.kv .row .k::after{margin:0 20px!important}',
    noOverflowV: '.kv .row .v{overflow-wrap:normal!important}',
    kMaxNone: '.kv .row .k{max-width:none!important;flex:0 0 auto!important}',
    afterBorderSolid: '.kv .row .k::after{border-bottom:2px solid #ff0!important}',
  };
  const out = {};
  for (const [name, css] of Object.entries(variants)) {
    out[name] = await p.evaluate((css) => {
      const st = document.createElement('style'); st.id='vv'; st.textContent = css; document.head.appendChild(st);
      const rw = document.querySelector('#serverKv .row');
      const k = rw.firstElementChild, v = rw.lastElementChild;
      const a = {kW:Math.round(k.getBoundingClientRect().width), gap:Math.round(v.getBoundingClientRect().left-k.getBoundingClientRect().right)};
      st.remove();
      return a;
    }, css);
  }
  console.log(JSON.stringify(out,null,1));
  await b.close();
})();
