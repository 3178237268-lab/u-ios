const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const steps = {};
  steps.v_border = await p.evaluate(()=>{ const v=document.querySelector('#serverKv .row').lastElementChild; v.style.outline='1px solid red'; return v.getBoundingClientRect().width; });
  steps.k_minwidth200 = await p.evaluate(()=>{ const k=document.querySelector('#serverKv .row .k'); const o=k.style.minWidth; k.style.minWidth='200px';
    const w=k.getBoundingClientRect().width; const lw = parseFloat(getComputedStyle(k).paddingRight); k.style.minWidth=o; k.style.paddingRight='0px'; return {w, lw}; });
  steps.after_margin = await p.evaluate(()=>{ const k=document.querySelector('#serverKv .row .k');
    const st=document.createElement('style'); st.textContent='#serverKv .row .k::after{margin:0 10px!important;flex:0 0 60px!important}'; document.head.appendChild(st);
    const w=k.getBoundingClientRect().width; st.remove(); return w; });
  console.log(JSON.stringify(steps,null,1));
  await b.close();
})();
