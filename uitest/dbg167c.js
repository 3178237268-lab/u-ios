const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport:{width:1280,height:950} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8787/admin.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(500); await p.fill('#lgUser','admin123'); await p.fill('#lgPass','admin123');
  await p.click('.login-card .btn, .login-card button'); await p.waitForTimeout(1800);
  const probe = () => p.evaluate(()=>{
    const out={};
    for (const id of ['serverKv','liveKv','dirKv','tunnelKv','portListKv','visitorKv','netKv']) {
      const kv=document.getElementById(id); if(!kv) {out[id]='missing';continue;}
      const rows=[...kv.querySelectorAll('.row')];
      out[id]={n:rows.length, h:Math.round(kv.getBoundingClientRect().height), cols:getComputedStyle(kv).gridTemplateColumns, first:rows[0]?rows[0].textContent.slice(0,40):null,
        kspans: rows.slice(0,3).map(r=>{const k=r.firstElementChild; return k?k.className+'|'+getComputedStyle(k,'::after').borderBottomStyle:'?'})};
    }
    return out;
  });
  const tabs=['live','settings','net'];
  const res={overview:await probe()};
  for(const t of tabs){
    await p.evaluate(t=>{const e=document.querySelector('[data-tab="'+t+'"]');if(e)e.click();},t);
    await p.waitForTimeout(1300);
    res[t]=await probe();
    await p.screenshot({path:'D:/deepseek/gouzuoqu/U/.tmp-test/r167c-'+t+'.png'});
  }
  console.log(JSON.stringify({res,errs},null,1));
  await b.close();
})();
