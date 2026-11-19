const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(600);
  await p.fill('#lgUser','admin123');
  await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button');
  await p.waitForTimeout(2000);
  console.log('login card visible:', await p.evaluate(()=>{const c=document.querySelector('.login-card');return c?getComputedStyle(c).display+' '+c.offsetParent!==null:'none'}));
  // 概览
  await p.evaluate(()=>{const e=document.querySelector('[data-tab="overview"]');if(e)e.click();});
  await p.waitForTimeout(1500);
  const info = await p.evaluate(()=>{
    const kv=document.querySelector('#serverKv');
    const rows=[...kv.querySelectorAll('.row')];
    return {count:rows.length, html:kv.innerHTML.slice(0,400), first: rows.slice(0,6).map(rw=>{
      const k=rw.querySelector('span:first-child'), v=rw.querySelector('span:last-child');
      const kb=k?k.getBoundingClientRect():null, vb=v?v.getBoundingClientRect():null;
      return {t:k?k.textContent.slice(0,10):'?', kH:kb?Math.round(kb.height):null, gap:kb&&vb?Math.round(vb.left-kb.right):null, after:k?getComputedStyle(k,'::after').borderBottomStyle:'?'};
    })};
  });
  await p.screenshot({path:'D:/deepseek/gouzuoqu/U/.tmp-test/r167b-overview.png'});
  console.log(JSON.stringify({info, errs},null,1));
  await b.close();
})();
