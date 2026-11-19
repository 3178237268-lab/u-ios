const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    const rows=[...document.querySelectorAll('#serverKv .row')].slice(0,3);
    return rows.map(rw=>{
      const k=rw.firstElementChild;
      const cs=getComputedStyle(k);
      // 找出所有作用于该 span 的 ::after 规则
      const rules=[];
      for (const sh of document.styleSheets) {
        let rs; try { rs=sh.cssRules; } catch(e){ continue; }
        for (const rule of rs) {
          if (!rule.selectorText) continue;
          if (/\:\:after/.test(rule.selectorText) && k.matches(rule.selectorText.replace(/::after.*$/,'') || '*')) {
            rules.push(rule.selectorText + ' => ' + rule.style.cssText.slice(0,160));
          }
        }
      }
      return {cls:k.className, display:cs.display, flex:cs.flex, order:cs.order, rules:rules.slice(0,8)};
    });
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
