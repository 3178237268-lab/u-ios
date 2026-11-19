const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const variants = {
    A_kflex1: '.kv .row{display:flex} .kv .row .k{flex:1 1 auto;white-space:nowrap;overflow:hidden} .kv .row .v{flex:0 0 auto;margin-left:24px}',
    B_gap24:  '.kv .row{display:flex} .kv .row .k{flex:0 1 auto;white-space:nowrap} .kv .row .v{flex:1 1 auto;margin-left:24px}',
    C_spacer: '.kv .row{display:flex} .kv .row .k{flex:0 0 auto;white-space:nowrap} .kv .row .v{margin-left:auto;flex:0 0 auto;max-width:60%}',
    D_border: '.kv .row{display:flex} .kv .row .k{flex:0 0 auto;white-space:nowrap;padding-right:12px;border-right:1px solid rgba(255,255,255,.3)} .kv .row .v{margin-left:12px;flex:0 0 auto;max-width:60%}',
  };
  const out = {};
  for (const [name, css] of Object.entries(variants)) {
    out[name] = await p.evaluate((css) => {
      const st=document.createElement('style'); st.id='v'; st.textContent=css+'.kv .row .k::after,.kv .row .k::before{display:none!important}'; document.head.appendChild(st);
      const rw=document.querySelector('#serverKv .row'); const k=rw.firstElementChild, v=rw.lastElementChild;
      const res={kW:Math.round(k.getBoundingClientRect().width), gap:Math.round(v.getBoundingClientRect().left-k.getBoundingClientRect().right), vW:Math.round(v.getBoundingClientRect().width)};
      st.remove(); return res;
    }, css);
  }
  console.log(JSON.stringify(out,null,1));
  await b.close();
})();
