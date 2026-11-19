const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const variants = {
    baseline: '',
    flexA: '.kv .row .k{display:inline-flex!important;flex:0 0 auto!important}',
    blockA: '.kv .row .k{display:block!important;flex:0 0 auto!important}',
    noDisplay: '.kv .row .k{display:inline-block!important;flex:0 0 auto!important}',
  };
  const out = {};
  for (const [name, css] of Object.entries(variants)) {
    out[name] = await p.evaluate((css) => {
      const old = document.getElementById('probeStyle'); if (old) old.remove();
      const st = document.createElement('style'); st.id='probeStyle'; st.textContent = css; document.head.appendChild(st);
      const rw = document.querySelector('#serverKv .row');
      const k = rw.firstElementChild, v = rw.lastElementChild;
      const res = {kR:Math.round(k.getBoundingClientRect().right), vL:Math.round(v.getBoundingClientRect().left), kH:Math.round(k.getBoundingClientRect().height), disp:getComputedStyle(k).display};
      st.remove();
      return res;
    }, css);
  }
  console.log(JSON.stringify(out,null,1));
  await b.close();
})();
